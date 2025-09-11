import { checkRequirements } from '../engine/rules.js';

export function renderRoutesView(root, state){
  root.innerHTML='';
  const frame = document.createElement('div');
  frame.className='frame';
  frame.innerHTML = `
    <div class="hud-top">
      <div class="hud-panel"><strong>루트 선택</strong><span class="tag">16:9 · 1280x720</span></div>
      <div class="hud-panel legend">
        <span class="tag">활성</span>
        <span class="tag">잠금</span>
      </div>
    </div>
    <div class="viewport">
      <div class="canvas" id="canvas"></div>
    </div>
    <div class="hud-bottom">
      <div class="hud-panel">
        <button class="btn" id="btnParty">부대 정비</button>
      </div>
      <div class="hud-panel"><button class="btn primary" id="btnStart">시작</button></div>
    </div>
    <div class="mini"></div>
  `;
  root.appendChild(frame);

  const canvas = frame.querySelector('#canvas');
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('route-graph');
  // determine current route id safely (defined later). We'll init view after nodes prepared
  let view = { x:0, y:0, w:2000, h:1200 };
  // content group for explicit scaling
  const content = document.createElementNS('http://www.w3.org/2000/svg','g');
  svg.appendChild(content);
  canvas.appendChild(svg);

  // build graph and layout
  const graph = buildGraph(state);
  const layoutSize = { width:2000, height:1100 };
  const nodes = layoutRightHierarchical(graph, layoutSize, null);
  const edges = graph.edges;

  // determine current route id: 마지막으로 방문한 루트가 있으면 그 노드를, 아니면 첫 루트/다음 해금 루트를 선택
  const visitedMap = state.flags?.visitedRoutes || {};
  const visitedIdsArr = Object.keys(visitedMap).filter(k=>visitedMap[k]);
  const visitedSet = new Set(visitedIdsArr);
  const startId = state.data.routes[0]?.id;
  const lastVisitedIdx = Math.max(-1, ...state.data.routes.map((r,i)=> visitedMap[r.id] ? i : -1));
  // 포커스 대상: 마지막 방문의 '다음' 루트가 존재하고 접근 가능하면 그 노드, 아니면 마지막 방문 노드
  let curId = null;
  if(lastVisitedIdx>=0){
    const last = state.data.routes[lastVisitedIdx];
    const nextId = (last.next && last.next.startsWith('R-')) ? last.next : null;
    const nextOk = nextId ? checkRequirements(state, state.data.routes.find(r=>r.id===nextId)?.requirements) : false;
    curId = (nextOk ? nextId : last.id);
  } else {
    curId = (state.data.routes.find(r=>checkRequirements(state, r.requirements))?.id || startId || nodes[0]?.id || null);
  }

  // 가시성: 시작 노드 + 방문한 노드 + 방문한 노드에서 한 단계 나간 다음 노드만 표시
  const baseVisible = visitedIdsArr.length>0 ? new Set(visitedIdsArr) : new Set(startId ? [startId] : []);
  const nextIds = new Set();
  edges.forEach(e=>{ if(baseVisible.has(e.from)) nextIds.add(e.to); });
  const isVisible = (id)=>{
    if(visitedIdsArr.length===0) return id===startId; // 처음 시작: 시작 노드만
    return baseVisible.has(id) || nextIds.has(id);
  };

  // always center on current node when 열람 (지속 뷰 대신 항상 포커스)
  const currentNode = nodes.find(n=>curId && n.id===curId) || nodes[0];
  // World bounds 계산(노드 배치 기준)
  const minX = Math.min(...nodes.map(n=>n.x-80), 0);
  const minY = Math.min(...nodes.map(n=>n.y-30), 0);
  const maxX = Math.max(...nodes.map(n=>n.x+80), 1200);
  const maxY = Math.max(...nodes.map(n=>n.y+30), 600);
  const W = Math.ceil(maxX - Math.min(minX,0) + 200);
  const H = Math.ceil(maxY - Math.min(minY,0) + 200);
  if(currentNode){
    const zoomW = Math.min(900, W);
    const zoomH = Math.min(540, H);
    const x = Math.max(0, Math.round(currentNode.x - zoomW/2));
    const y = Math.max(0, Math.round(currentNode.y - zoomH/2));
    view = { x, y, w: zoomW, h: zoomH };
  }
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);

  // edges (only visible)
  // build obstacle rects (visible nodes only)
  const obstacles = nodes.filter(n=> isVisible(n.id))
    .map(n=>({ id:n.id, x1:n.x-80, x2:n.x+80, y1:n.y-30, y2:n.y+30 }));

  const mkRoundedPath=(ax,ay,bx,by, excludeIds=[])=>{
    const startX = ax+80, startY = ay;
    const endX = bx-80, endY = by;
    if(startY===endY){
      return `M${startX},${startY} L${endX},${endY}`;
    }
    const span = Math.max(0, endX - startX);
    const r = 12, baseDX = 80, minDX = 60, margin = 16;
    // ① 세로 구간과 겹치는 장애물 우측 끝 + 여백의 최댓값으로 레일 위치 선정
    const yMinAll = Math.min(startY, endY) + r, yMaxAll = Math.max(startY, endY) - r;
    const blockers = obstacles.filter(o=> !excludeIds.includes(o.id) && !(yMaxAll < o.y1 - margin || yMinAll > o.y2 + margin) && (o.x2 >= startX));
    let x1 = Math.max(startX + baseDX, ...(blockers.map(b=> b.x2 + margin)));
    x1 = Math.min(x1, endX - minDX);
    const dirDown = endY > startY;
    const arcSweep1 = dirDown ? 1 : 0; // 첫 코너: H→V
    const arcSweep2 = dirDown ? 0 : 1; // 둘째 코너: V→H
    const yCorner1 = startY + (dirDown ? r : -r);
    const yCorner2 = endY - (dirDown ? r : -r);
    // 경로: H → ARC → V → ARC → H (한 레일에서만 꺾음)
    return `M${startX},${startY} H${x1-r} A${r},${r} 0 0 ${arcSweep1} ${x1},${yCorner1} `+
           `V${yCorner2} A${r},${r} 0 0 ${arcSweep2} ${x1+r},${endY} H${endX}`;
  };
  edges.forEach(e=>{
    const a = nodes.find(n=>n.id===e.from);
    const b = nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    if(!isVisible(a.id) || !isVisible(b.id)) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', mkRoundedPath(a.x, a.y, b.x, b.y, [a.id,b.id]));
    path.setAttribute('class','edge');
    content.appendChild(path);
  });

  // nodes
  nodes.forEach(n=>{
    const r = state.data.routes.find(r=>r.id===n.id);
    const ok = checkRequirements(state, r.requirements);
    const visited = visitedSet.has(r.id);
    if(!isVisible(r.id)) return; // 숨김 정책
    const obf = (!visited && nextIds.has(r.id) && !ok);
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform',`translate(${n.x-80},${n.y-30})`);
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('width','160'); rect.setAttribute('height','60'); rect.setAttribute('rx','10');
    const clickable = ok && !visited; // 방문한 타일은 재실행 불가
    rect.setAttribute('class',`node ${clickable?'active':'locked'} ${visited?'visited':''} ${obf?'obf':''} ${curId && n.id===curId?'current':''}`);
    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x','80'); label.setAttribute('y','35'); label.setAttribute('text-anchor','middle');
    label.setAttribute('class','node-label');
    const isBattle = (r.next||'').startsWith('BT-');
    label.textContent = (visited || ok) ? (isBattle ? '⚔ ' + n.title : n.title) : '???';
    g.appendChild(rect); g.appendChild(label);
    g.style.cursor = clickable ? 'pointer' : 'not-allowed';
    g.addEventListener('click',()=>{
      if(!clickable) return;
      if(!state.flags.visitedRoutes) state.flags.visitedRoutes = {};
      state.flags.visitedRoutes[r.id] = true; // 방문 표시
      if(r.next?.startsWith('EP-')){ state.ui.currentEpisode = r.next; root.dispatchEvent(new CustomEvent('nav',{detail:'episode'})); }
      else if(r.next?.startsWith('BT-')){ state.ui.battle = r.next; root.dispatchEvent(new CustomEvent('nav',{detail:'battle'})); }
    });
    g.addEventListener('mousemove',(ev)=>{
      const tip = visited ? r.summary : '미확인 구간';
      if(window.UI_TIP){ window.UI_TIP.showTooltip(tip, ev.clientX, ev.clientY); }
    });
    g.addEventListener('mouseleave',()=> window.UI_TIP?.hideTooltip());
    content.appendChild(g);
  });

  // minimap
  const mini = frame.querySelector('.mini');
  const miniSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  miniSvg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  mini.appendChild(miniSvg);
  edges.forEach(e=>{
    const a = nodes.find(n=>n.id===e.from); const b = nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d', mkRoundedPath(a.x, a.y, b.x, b.y, [a.id,b.id]));
    p.setAttribute('class','edge'); miniSvg.appendChild(p);
  });
  nodes.forEach(n=>{
    const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('x',n.x-80); r.setAttribute('y',n.y-30); r.setAttribute('width',160); r.setAttribute('height',60); r.setAttribute('rx',10);
    r.setAttribute('class','node'); miniSvg.appendChild(r);
  });
  const vp = document.createElementNS('http://www.w3.org/2000/svg','rect');
  vp.setAttribute('class','vp'); miniSvg.appendChild(vp);

  function updateView(v){
    view=v; svg.setAttribute('viewBox',`${v.x} ${v.y} ${v.w} ${v.h}`);
    vp.setAttribute('x', v.x); vp.setAttribute('y', v.y); vp.setAttribute('width', v.w); vp.setAttribute('height', v.h);
  }

  enablePanZoom(canvas, svg, view, updateView, { W, H });
  enableMiniDrag(miniSvg, view, updateView, { W, H });

  frame.querySelector('#btnParty').onclick=()=>document.querySelector('nav button[data-view=party]')?.click();
  frame.querySelector('#btnStart').onclick=()=>{
    const first = state.data.routes.find(r=>checkRequirements(state, r.requirements));
    if(!first) return;
    if(first.next.startsWith('EP-')){ state.ui.currentEpisode = first.next; root.dispatchEvent(new CustomEvent('nav',{detail:'episode'})); }
    else if(first.next.startsWith('BT-')){ state.ui.battle = first.next; root.dispatchEvent(new CustomEvent('nav',{detail:'battle'})); }
  };

  // nav bridge
  root.addEventListener('nav', (e)=>{
    const viewName = e.detail; document.querySelector(`nav button[data-view=${viewName}]`)?.click();
  }, { once:true });
}

function buildGraph(state){
  const nodes = state.data.routes.map(r=>({ id:r.id, title:r.title, summary:r.summary, requirements:r.requirements, next:r.next, branches:r.branches||[] }));
  const edges = [];
  // 분기 엣지
  nodes.forEach(r=>{ (r.branches||[]).forEach(b=>{ if(b.to?.startsWith('R-')) edges.push({ from:r.id, to:b.to, label:b.label||'' }); }); });
  // 메인 진행 엣지: 실제 next가 루트(R-***)일 때만 연결
  nodes.forEach(r=>{ if((r.next||'').startsWith('R-')) edges.push({ from:r.id, to:r.next, label:'진행' }); });
  return { nodes, edges };
}

function layoutRightHierarchical(graph, size, anchorId){
  const width = size?.width||2000, height=size?.height||1100;
  const xGap = 260, yGap = 140; // 기본 간격
  const nodesById = Object.fromEntries(graph.nodes.map(n=>[n.id,n]));
  const nextsByFrom = graph.edges.reduce((m,e)=>{ (m[e.from] ||= []).push(e.to); return m; },{});
  // 1) 메인 스파인 계산(R-001부터 next 체인)
  const start = anchorId || graph.nodes[0]?.id;
  const main = []; const seen = new Set(); let cur = start;
  while(cur && !seen.has(cur)){
    seen.add(cur); main.push(cur);
    const r = nodesById[cur];
    const nx = (r?.next||'').startsWith('R-') ? r.next : null;
    cur = nx;
  }
  // 2) X 좌표: 메인은 순서대로, 브랜치는 parentX+1
  const xOf = new Map(main.map((id,i)=>[id, 140 + i*xGap]));
  const assignX = (id)=>{
    if(xOf.has(id)) return xOf.get(id);
    const parents = Object.keys(nextsByFrom).filter(k=> (nextsByFrom[k]||[]).includes(id));
    const px = parents.length? (assignX(parents[0]) + xGap) : 140; // 재결합은 첫 부모 기준
    xOf.set(id, px); return px;
  };
  graph.nodes.forEach(n=> assignX(n.id));
  // 2-1) 단조 증가 보정: 모든 엣지에 대해 childX >= parentX + xGap 유지
  const outs = nextsByFrom;
  const shiftRight=(id,delta)=>{
    const curX = xOf.get(id)||140; const nx = curX + delta; if(nx<=curX) return;
    xOf.set(id, nx); (outs[id]||[]).forEach(to=>{
      const need = xOf.get(id) + xGap - (xOf.get(to)||140);
      if(need>0) shiftRight(to, need);
    });
  };
  graph.edges.forEach(e=>{ const need = (xOf.get(e.from)||140) + xGap - (xOf.get(e.to)||140); if(need>0) shiftRight(e.to, need); });
  // 3) Y 좌표: 부모-자식 군집으로 DFS 배치
  const roots = [start];
  const yOf = new Map(); let cursorY = 160;
  const dfs=(id)=>{
    const kids = (nextsByFrom[id]||[]).filter(c=> c!==id);
    if(kids.length===0){ const y=cursorY; yOf.set(id,y); cursorY+=yGap; return y; }
    const ys = kids.map(dfs);
    const mid = Math.floor((Math.min(...ys)+Math.max(...ys))/2);
    yOf.set(id, mid); return mid;
  };
  roots.forEach(dfs);
  // 4) 나머지(재결합 등) 노드 Y 스냅: 최초 부모들의 중간으로
  graph.nodes.forEach(n=>{
    if(!yOf.has(n.id)){
      const parents = Object.keys(nextsByFrom).filter(k=> (nextsByFrom[k]||[]).includes(n.id));
      const ys = parents.map(p=> yOf.get(p)).filter(v=> typeof v==='number');
      const y = ys.length? Math.floor(ys.reduce((a,b)=>a+b,0)/ys.length) : cursorY;
      if(!ys.length) cursorY+=yGap;
      yOf.set(n.id, y);
    }
  });
  // 4-1) 메인 스파인 Y 고정: 시작 노드의 Y로 전부 스냅(브랜치 존재로 부모 평균이 내려가는 현상 방지)
  const mainSet = new Set(main);
  const baseMainY = (typeof yOf.get(start)==='number') ? yOf.get(start) : 160;
  main.forEach(id=>{ yOf.set(id, baseMainY); });
  // 5) 결과
  return graph.nodes.map(n=>({ id:n.id, title:n.title, x:xOf.get(n.id), y:yOf.get(n.id) }));
}

function enablePanZoom(container, svg, view, onChange, bounds){
  let isPanning=false, start={x:0,y:0};
  const W=bounds?.W||2000, H=bounds?.H||1200;
  const clamp=(v,min,max)=> Math.max(min, Math.min(max, v));
  const threshold=4; let panActive=false;
  container.classList.add('grab');
  container.addEventListener('mousedown', (e)=>{ isPanning=true; panActive=false; container.classList.add('grabbing'); start={x:e.clientX,y:e.clientY}; });
  window.addEventListener('mouseup', ()=>{ isPanning=false; panActive=false; container.classList.remove('grabbing'); });
  window.addEventListener('mousemove',(e)=>{ if(!isPanning) return; const dx=e.clientX-start.x, dy=e.clientY-start.y; if(!panActive && (Math.abs(dx)>threshold || Math.abs(dy)>threshold)) panActive=true; if(!panActive) return; start={x:e.clientX,y:e.clientY}; view.x=clamp(view.x-dx, 0, W-view.w); view.y=clamp(view.y-dy, 0, H-view.h); svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`); onChange?.(view); });
  // Wheel zoom to cursor
  const wheelHandler=(e)=>{
    e.preventDefault();
    if(isPanning) return; // don't zoom while dragging
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const px = mx / rect.width; const py = my / rect.height;
    const worldX = view.x + px * view.w; const worldY = view.y + py * view.h;
    const scale = e.deltaY > 0 ? 1.1 : 0.9; // default wheel zooms
    const newW = clamp(view.w * scale, 30, W); const newH = clamp(view.h * scale, 20, H);
    view.x = clamp(worldX - px * newW, 0, W - newW);
    view.y = clamp(worldY - py * newH, 0, H - newH);
    view.w = newW; view.h = newH;
    svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
    onChange?.(view);
  };
  svg.addEventListener('wheel', wheelHandler, { passive:false });
  container.addEventListener('wheel', wheelHandler, { passive:false });
}

function enableMiniDrag(miniSvg, view, onChange, bounds){
  let dragging=false; const W=bounds?.W||2000, H=bounds?.H||1200;
  miniSvg.addEventListener('mousedown',e=>{ dragging=true; move(e); });
  window.addEventListener('mouseup',()=> dragging=false);
  miniSvg.addEventListener('mousemove',e=>{ if(dragging) move(e); });
  function move(e){ const r=miniSvg.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*W; const y=(e.clientY-r.top)/r.height*H; view.x=Math.max(0,Math.min(W-view.w,x-view.w/2)); view.y=Math.max(0,Math.min(H-view.h,y-view.h/2)); onChange?.(view); }
}

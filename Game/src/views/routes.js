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

  // determine current route id: 현재 해금된 루트 중 가장 이른 노드를 포커스로 선택(방문 이력과 무관)
  const visitedMap = state.flags?.visitedRoutes || {};
  const visitedIdsArr = Object.keys(visitedMap).filter(k=>visitedMap[k]);
  const visitedSet = new Set(visitedIdsArr);
  // 회차 진행: 이번 회차에 실제로 밟은 타일
  state.flags = state.flags || {};
  const runMap = state.flags.runVisitedRoutes || {};
  const runVisitedIds = Object.keys(runMap).filter(k=>runMap[k]);
  const runVisited = new Set(runVisitedIds);
  const lastRouteId = state.flags.lastRouteId || null;
  // 현재 에피소드에 해당하는 루트(진행 중 루트)가 있으면 그 루트를 우선 포커스로 사용
  const activeRoute = state.ui.currentEpisode ? (state.data.routes||[]).find(r=> r.next===state.ui.currentEpisode) : null;
  const activeRouteId = activeRoute?.id || null;
  const startId = state.data.routes[0]?.id;
  const firstUnlocked = state.data.routes.find(r=> checkRequirements(state, r.requirements))?.id || null;
  // 프론티어 계산: lastRouteId가 있으면 해당 노드의 자식만, 없으면 runVisited 전체에서 1단계 자식
  const frontSet = new Set();
  if(runVisited.size===0){
    if(startId) frontSet.add(startId);
  } else if(lastRouteId){
    graph.edges.forEach(e=>{ if(e.from===lastRouteId) frontSet.add(e.to); });
  } else {
    // lastRouteId가 비었으면 runVisited 중 가장 뒤(정의 순서상 마지막) 노드를 추정해 사용
    let lastGuess = null;
    for(const r of state.data.routes){ if(runVisited.has(r.id)) lastGuess = r.id; }
    if(lastGuess){ graph.edges.forEach(e=>{ if(e.from===lastGuess) frontSet.add(e.to); }); }
    else { graph.edges.forEach(e=>{ if(runVisited.has(e.from)) frontSet.add(e.to); }); }
  }
  // 현재 진행 노드: 프론티어 중에서 요구조건 충족 첫 노드
  let curId = null;
  for(const r of state.data.routes){ if(frontSet.has(r.id) && checkRequirements(state, r.requirements)){ curId=r.id; break; } }
  if(activeRouteId){ curId = activeRouteId; }
  if(!curId) curId = firstUnlocked || startId || nodes[0]?.id || null;
  console.debug('[routes-cur]', { firstUnlocked, startId, curId, runVisited:[...runVisited] });

  // 가시성 정책: 과거 확인(visited) + 이번 회차 지나온(runVisited) + 그 1단계 다음 노드 표시
  // - 회차 시작(runVisited 비었을 때)은 시작 노드도 포함
  const baseVisible = new Set([...(visitedSet||[])]);
  if(runVisited.size>0){ runVisited.forEach(id=> baseVisible.add(id)); }
  else if(startId){ baseVisible.add(startId); }
  if(activeRouteId){ baseVisible.add(activeRouteId); }
  const nextIds = new Set();
  edges.forEach(e=>{ if(baseVisible.has(e.from)) nextIds.add(e.to); });
  const isVisible = (id)=>{
    if(runVisited.size===0) return baseVisible.has(id) || id===startId || nextIds.has(id);
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
    const passed = runVisited.has(r.id);
    if(!isVisible(r.id)) return; // 숨김 정책
    // 미확인 타일: 현재 프론티어의 인접 후보이지만 이번 회차에 아직 지나오지 않음 → ??? 표시
    const isNext = nextIds.has(r.id);
    const isCurrent = (curId && n.id===curId);
    // 2회차 이상에서는 과거 방문(visited) 타일은 제목이 노출되어야 한다
    const obf = (isNext && !passed && !isCurrent && !visited);
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform',`translate(${n.x-80},${n.y-30})`);
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('width','160'); rect.setAttribute('height','60'); rect.setAttribute('rx','10');
    // 진행 중 에피소드의 루트는 하이라이트만 하고 클릭 불가
    const inProgress = !!(activeRouteId && n.id===activeRouteId);
    const clickable = (!inProgress) && (curId && n.id===curId) && ok; // 현재 진행 타일만 클릭 허용(단, inProgress 제외)
    // 스타일: passed(이번 회차 지나온 타일), historicOnly(과거 확인이지만 이번 회차 미진행)
    // 인접(next) 여부와 무관하게 과거 확인이면 흐리게 보여야 한다
    const historicOnly = visited && !passed;
    const cls = ['node'];
    cls.push(clickable? 'active':'locked');
    if(passed){ cls.push('passed'); }
    else if(historicOnly){ cls.push('historic'); }
    else if(visited){ cls.push('visited'); }
    if(obf){ cls.push('obf'); }
    if(curId && n.id===curId){ cls.push('current'); }
    rect.setAttribute('class', cls.join(' '));
    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x','80'); label.setAttribute('y','35'); label.setAttribute('text-anchor','middle');
    label.setAttribute('class',`node-label ${historicOnly?'dim':''}`);
    // 전투 타일 마크는 유지하되, 현재/지나온/historic 규칙과 충돌하지 않도록 라벨만 제어
    const isBattle = (r.next||'').startsWith('BT-');
    label.textContent = obf ? '???' : (isBattle ? '⚔ ' + n.title : n.title);
    g.appendChild(rect); g.appendChild(label);
    g.style.cursor = clickable ? 'pointer' : 'not-allowed';
    g.addEventListener('click',()=>{
      if(!clickable) return;
      if(!state.flags.visitedRoutes) state.flags.visitedRoutes = {};
      state.flags.visitedRoutes[r.id] = true; // 과거 방문 기록(영구)
      // 이번 회차 진행 기록
      state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
      state.flags.runVisitedRoutes[r.id] = true;
      state.flags.lastRouteId = r.id;
      // next가 루트(R-***)면 루트를 방문 처리하고 실제 next(next of that route)로 진입
      if((r.next||'').startsWith('R-')){
        const nr = state.data.routes.find(x=>x.id===r.next);
        if(nr){ state.flags.visitedRoutes[nr.id]=true; state.flags.runVisitedRoutes[nr.id]=true; state.flags.lastRouteId = nr.id; if(nr.next?.startsWith('EP-')){ state.ui.currentEpisode=nr.next; root.dispatchEvent(new CustomEvent('nav',{detail:'episode'})); return; } if(nr.next?.startsWith('BT-')){ state.ui.battle=nr.next; root.dispatchEvent(new CustomEvent('nav',{detail:'battle'})); return; } }
      }
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

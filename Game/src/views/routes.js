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
  const nodes = layoutRightHierarchical(graph, layoutSize);
  const edges = graph.edges;

  // determine current route id safely
  const unlocked = state.data.routes.filter(r=>checkRequirements(state, r.requirements));
  const startId = state.data.routes[0]?.id;
  // prefer start node when 처음 진입(visited 없음), otherwise last unlocked
  const curId = ((state.flags?.visitedRoutes && Object.keys(state.flags.visitedRoutes).some(k=>state.flags.visitedRoutes[k]))
    ? ((unlocked.length ? unlocked[unlocked.length-1].id : startId) || nodes[0]?.id || null)
    : (startId || nodes[0]?.id || null));

  // visibility sets
  // visibility sets
  // startId already defined above
  const visitedMap = state.flags?.visitedRoutes || {};
  const visitedIds = new Set(Object.keys(visitedMap).filter(k=>visitedMap[k]));
  const baseVisible = visitedIds.size>0 ? new Set(visitedIds) : new Set(startId ? [startId] : []);
  const nextIds = new Set();
  edges.forEach(e=>{ if(baseVisible.has(e.from)) nextIds.add(e.to); });
  const isVisible = (id)=> visitedIds.has(id) || (visitedIds.size===0 && id===startId) || (visitedIds.size>0 && nextIds.has(id));

  // initialize view from persisted or center on current node
  const currentNode = nodes.find(n=>curId && n.id===curId) || nodes[0];
  if(state.ui?.routesView){
    view = { ...state.ui.routesView };
  } else if(currentNode){
    const zoomW = 900, zoomH = 540;
    const x = Math.max(0, Math.round(currentNode.x - zoomW/2));
    const y = Math.max(0, Math.round(currentNode.y - zoomH/2));
    view = { x, y, w: zoomW, h: zoomH };
  }
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);

  // edges (only visible)
  edges.forEach(e=>{
    const a = nodes.find(n=>n.id===e.from);
    const b = nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    if(!isVisible(a.id) || !isVisible(b.id)) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M${a.x+80},${a.y} C ${a.x+180},${a.y} ${b.x-180},${b.y} ${b.x-80},${b.y}`);
    path.setAttribute('class','edge');
    content.appendChild(path);
  });

  // nodes
  nodes.forEach(n=>{
    const r = state.data.routes.find(r=>r.id===n.id);
    const ok = checkRequirements(state, r.requirements);
    const visited = visitedIds.has(r.id);
    if(!isVisible(r.id)) return; // 숨김 정책
    const obf = !visited && nextIds.has(r.id) && !ok; // 선택 가능 노드는 제목 표시
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform',`translate(${n.x-80},${n.y-30})`);
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('width','160'); rect.setAttribute('height','60'); rect.setAttribute('rx','10');
    const clickable = ok && !visited; // 방문한 타일은 재실행 불가
    rect.setAttribute('class',`node ${clickable?'active':'locked'} ${visited?'visited':''} ${obf?'obf':''} ${curId && n.id===curId?'current':''}`);
    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x','80'); label.setAttribute('y','35'); label.setAttribute('text-anchor','middle');
    label.setAttribute('class','node-label');
    label.textContent = (visited || ok) ? n.title : '???';
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
  miniSvg.setAttribute('viewBox','0 0 2000 1200');
  mini.appendChild(miniSvg);
  edges.forEach(e=>{
    const a = nodes.find(n=>n.id===e.from); const b = nodes.find(n=>n.id===e.to);
    if(!a||!b) return;
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d',`M${a.x+80},${a.y} C ${a.x+180},${a.y} ${b.x-180},${b.y} ${b.x-80},${b.y}`);
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
    if(!state.ui) state.ui = {}; state.ui.routesView = { ...v };
  }

  enablePanZoom(canvas, svg, view, updateView);
  enableMiniDrag(miniSvg, view, updateView);

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
  nodes.forEach(r=>{ (r.branches||[]).forEach(b=>{ if(b.to?.startsWith('R-')) edges.push({ from:r.id, to:b.to, label:b.label||'' }); }); });
  for(let i=0;i<nodes.length-1;i++){ const from = nodes[i].id, to = nodes[i+1].id; edges.push({ from, to, label: nodes[i].branches?.length? '' : '진행' }); }
  return { nodes, edges };
}

function layoutRightHierarchical(graph, size){
  const levelMap = new Map();
  const indeg = new Map(graph.nodes.map(n=>[n.id,0]));
  graph.edges.forEach(e=>indeg.set(e.to, (indeg.get(e.to)||0)+1));
  const roots = graph.nodes.filter(n=>(indeg.get(n.id)||0)===0);
  const queue = roots.map(r=>({ id:r.id, depth:0 }));
  const visited = new Set();
  while(queue.length){
    const cur = queue.shift(); if(visited.has(cur.id)) continue; visited.add(cur.id);
    levelMap.set(cur.id, cur.depth);
    graph.edges.filter(e=>e.from===cur.id).forEach(e=>queue.push({ id:e.to, depth:cur.depth+1 }));
  }
  const grouped = {}; graph.nodes.forEach(n=>{ const d=levelMap.get(n.id)||0; (grouped[d] ||= []).push(n); });
  const width = size?.width||2000, height=size?.height||1100; const depths = Object.keys(grouped).map(Number).sort((a,b)=>a-b);
  const colGap = Math.max(260, Math.min(360, (width-200)/Math.max(1,depths.length)));
  const out=[]; depths.forEach((depth,di)=>{
    const arr = grouped[depth]; const rowGap = Math.max(110, Math.min(200, (height-200)/Math.max(1,arr.length)));
    arr.forEach((n,i)=> out.push({ id:n.id, title:n.title, x:140+di*colGap, y:160+i*rowGap }));
  }); return out;
}

function enablePanZoom(container, svg, view, onChange){
  let isPanning=false, start={x:0,y:0};
  const W=2000, H=1200;
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

function enableMiniDrag(miniSvg, view, onChange){
  let dragging=false; const W=2000, H=1200;
  miniSvg.addEventListener('mousedown',e=>{ dragging=true; move(e); });
  window.addEventListener('mouseup',()=> dragging=false);
  miniSvg.addEventListener('mousemove',e=>{ if(dragging) move(e); });
  function move(e){ const r=miniSvg.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*W; const y=(e.clientY-r.top)/r.height*H; view.x=Math.max(0,Math.min(W-view.w,x-view.w/2)); view.y=Math.max(0,Math.min(H-view.h,y-view.h/2)); onChange?.(view); }
}

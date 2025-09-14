// Visual-novel style episode engine (modular, data-driven)
// No hardcoded assets: paths come from config. DSL commands are executed sequentially.

import { applyEffects } from './rules.js';

export const EP_DEFAULT_CFG = {
  assets: {
    bgPath: 'assets/bg/',
    charPath: 'assets/char/',
    sfxPath: 'assets/sfx/',
    bgmPath: 'assets/bgm/'
  },
  typing: { speed: 24, skippable: true },
  easing: 'ease',
  // overall screen scale multiplier; 1 = fit to viewport
  scale: 1
};

// Normalize legacy EP {scene, choices} to DSL {events}
export function normalizeEpisode(ep){
  if(!ep) return { events: [] };
  if(Array.isArray(ep.events)) return ep;
  const events = [];
  (ep.scene||[]).forEach(l=>{
    events.push({ cmd:'say', speaker: l.speaker, text: l.text });
  });
  if(Array.isArray(ep.choices) && ep.choices.length){
    events.push({ cmd:'choice', items: ep.choices.map(c=>({ label:c.label, effects:c.effects||[], next:c.next||'' })) });
  }
  return { events };
}

// Evaluate when condition
function evalWhen(when, state){
  if(!when) return true;
  if(when.anyOf && Array.isArray(when.anyOf)) return when.anyOf.some(w=> evalWhen(w, state));
  if(when.all && Array.isArray(when.all)) return when.all.every(w=> evalWhen(w, state));
  if(when.flag && Array.isArray(when.flag)){
    const [key, val] = when.flag; return (state.flags||{})[key] === val;
  }
  if(typeof when['party.has'] === 'string'){
    const id = when['party.has'];
    const members = state.party?.members||[]; return members.includes(id);
  }
  return true;
}

function injectStylesOnce(){
  const id='ep-vn-styles'; if(document.getElementById(id)) return;
  const st=document.createElement('style'); st.id=id; st.textContent=`
  .ep-vn { position:relative; width:100vw; height:100vh; min-height:100vh; overflow:hidden; user-select:none; }
  .ep-vn.panel { max-width:none; padding:0; margin:0; border:none; background:transparent; }
  .ep-fit { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .ep-stage { position:relative; width:1920px; height:1080px; transform-origin:50% 50%; }
  .ep-vn .layer-bg { position:absolute; inset:0; background:#0b0f1a center/cover no-repeat; }
  .ep-vn .layer-actors { position:absolute; inset:0; pointer-events:none; }
  .ep-vn .actor { position:absolute; transform-origin:50% 100%; }
  .ep-vn .layer-ui { position:absolute; left:0; right:0; bottom:0; padding:24px 48px 96px; pointer-events:none; }
  .ep-vn .dialog { background:rgba(8,12,22,0.75); border:1px solid #2b3450; border-radius:14px; padding:18px 22px; color:#cbd5e1; max-width:1600px; margin:0 auto; font-size:26px; line-height:1.5; pointer-events:auto; will-change:transform; transform:translateZ(0); }
  .ep-vn .dialog .name { font-weight:700; color:#e6f1ff; margin-bottom:8px; font-size:28px; }
  .ep-vn .choices { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:flex; flex-direction:column; gap:16px; align-items:center; justify-content:center; }
  .ep-vn .choices .btn { font-size:28px; padding:14px 28px; min-width:420px; }
  .ep-vn .history-btn { position:absolute; right:12px; bottom:180px; }
  .ep-vn .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; }
  .ep-vn .modal { background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; padding:16px; border-radius:10px; min-width:320px; }
  `; document.head.appendChild(st);
}

const _imgCache = new Map();
const _audioCache = new Map();

function loadImage(url){
  if(_imgCache.has(url)) return _imgCache.get(url);
  const p = new Promise((res, rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=url; });
  _imgCache.set(url, p); return p;
}
function getAudio(url){
  if(_audioCache.has(url)) return _audioCache.get(url);
  const a = new Audio(url); a.preload='auto'; _audioCache.set(url, a); return a;
}

function pathForChar(cfg, id, emotion){
  return `${cfg.assets.charPath}${id}/${emotion||'default'}.png`;
}
function pathForBg(cfg, name){ return `${cfg.assets.bgPath}${name}.png`; }
function pathForSfx(cfg, name){ return `${cfg.assets.sfxPath}${name}.ogg`; }
function pathForBgm(cfg, name){ return `${cfg.assets.bgmPath}${name}.ogg`; }

// Typewriter text with skip control
async function typeText(el, text, speed, skippable){
  return await new Promise(resolve=>{
    let i=0; let skipping=false; const total=text.length; el.textContent='';
    function onClick(){ if(!skippable) return; skipping=true; el.textContent=text; cleanup(); resolve(); }
    function cleanup(){ el.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); }
    function onKey(e){ if(e.key===' '||e.key==='Enter'){ onClick(); } }
    el.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    const timer=setInterval(()=>{
      if(skipping){ clearInterval(timer); return; }
      if(i>=total){ clearInterval(timer); cleanup(); resolve(); return; }
      el.textContent += text[i++];
    }, Math.max(10, 1000/Math.max(1, speed||24)));
  });
}

// Wait for user advance (click anywhere on dialog or Space/Enter)
async function waitAdvance(clickRoot){
  return await new Promise(resolve=>{
    let armed=false; const arm=()=>{ armed=true; };
    const onClick=(e)=>{ if(!armed) return; cleanup(); resolve(); };
    const onKey=(e)=>{ if(!armed) return; if(e.key===' '||e.key==='Enter'){ cleanup(); resolve(); } };
    function cleanup(){ clickRoot.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); }
    // defer arming so that the click used to skip 타이핑은 소비되고, 다음 클릭부터 진행
    setTimeout(()=>{ arm(); }, 30);
    clickRoot.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

// Navigate after choice
function navigateAfter(state, next){
  if(!next) return;
  // END screen
  if(next==='END-01'){
    const backdrop = document.createElement('div'); backdrop.className='modal-backdrop'; backdrop.id='ep-end-backdrop';
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `<h3>End01</h3><p>현실로 귀환했습니다.</p><p style="color:#9aa0a6;">클릭하면 타이틀로 돌아갑니다.</p>`;
    backdrop.appendChild(modal); document.body.appendChild(backdrop);
    backdrop.addEventListener('click', ()=>{
      try{ import('./rules.js').then(mod=> mod.setFlag?.(state,'game.ending','END01')); }catch{}
      // 상태 초기화
      state.skillProgress = {}; state.ui.currentEpisode=null; state.ui.battle=null; delete state.ui.battleState;
      // VN DOM 완전 정리
      try{
        const epWrap = document.querySelector('.ep-vn'); if(epWrap) epWrap.remove();
        const endBd = document.getElementById('ep-end-backdrop'); if(endBd) endBd.remove();
        // 남아 있을 수 있는 히스토리 모달 제거
        document.querySelectorAll('.ep-vn .modal-backdrop, .modal-backdrop').forEach(el=>{
          try{ el.remove(); }catch{}
        });
      }catch{}
      // 타이틀로 이동
      if(typeof window.render==='function'){ window.render('title'); }
      else { const btn=document.querySelector('nav button[data-view=title]'); if(btn) btn.click(); }
    }, { once:true });
    return;
  }
  if(next.startsWith('R-')){
    const route = (state.data.routes||[]).find(r=>r.id===next);
    if(route){
      state.flags = state.flags||{}; state.flags.visitedRoutes=state.flags.visitedRoutes||{}; state.flags.runVisitedRoutes=state.flags.runVisitedRoutes||{};
      state.flags.visitedRoutes[route.id]=true; state.flags.runVisitedRoutes[route.id]=true; state.flags.lastRouteId=route.id;
      if(route.next?.startsWith('EP-')){ state.ui.currentEpisode=route.next; (window.render? window.render('episode'): document.querySelector('nav button[data-view=episode]')?.click()); return; }
      if(route.next?.startsWith('BT-')){ state.ui.battle=route.next; (window.render? window.render('battle'): document.querySelector('nav button[data-view=battle]')?.click()); return; }
    }
    const btn=document.querySelector('nav button[data-view=routes]'); if(btn) btn.click(); return;
  }
  if(next.startsWith('EP-')){ state.ui.currentEpisode=next; (window.render? window.render('episode'): document.querySelector('nav button[data-view=episode]')?.click()); return; }
  if(next.startsWith('BT-')){ state.ui.battle=next; (window.render? window.render('battle'): document.querySelector('nav button[data-view=battle]')?.click()); return; }
}

export async function renderEpisodeVN(root, state, epId, userCfg){
  injectStylesOnce();
  const cfg = { ...EP_DEFAULT_CFG, ...(userCfg||{}) };
  const epRaw = (state.data?.episodes||{})[epId];
  const ep = normalizeEpisode(epRaw);

  // Root container and layers (1920x1080 stage with scaler)
  const wrap=document.createElement('section'); wrap.className='panel ep-vn';
  const fit=document.createElement('div'); fit.className='ep-fit'; wrap.appendChild(fit);
  const stage=document.createElement('div'); stage.className='ep-stage'; fit.appendChild(stage);
  stage.innerHTML = `<div class="layer-bg" id="epBg"></div><div class="layer-actors" id="epActors"></div><div class="layer-ui"><div class="dialog" id="epDialog"><div class="name" id="epName"></div><div class="text" id="epText"></div></div></div>`;
  // ensure visible initial background (solid color) until first bg event
  stage.querySelector('#epBg').style.background = '#0b0f1a';
  const bg=stage.querySelector('#epBg'); const actors=stage.querySelector('#epActors'); const nameEl=stage.querySelector('#epName'); const textEl=stage.querySelector('#epText');
  const choicesWrap=document.createElement('div'); choicesWrap.className='choices'; stage.appendChild(choicesWrap);
  const btnHistory=document.createElement('button'); btnHistory.className='btn history-btn'; btnHistory.textContent='히스토리'; stage.appendChild(btnHistory);
  state.ui = state.ui || {}; state.ui.epHistory = state.ui.epHistory || [];

  // history modal
  btnHistory.onclick=()=>{
    const bd=document.createElement('div'); bd.className='modal-backdrop'; const m=document.createElement('div'); m.className='modal';
    const lines = (state.ui.epHistory||[]).map(h=>`<div><strong>${h.speaker}</strong>: ${h.text}</div>`).join('');
    m.innerHTML = `<h3>히스토리</h3><div style="max-height:360px; overflow:auto;">${lines||'<div style=\"color:#9aa0a6;\">기록 없음</div>'}</div><div class="actions" style="margin-top:8px; text-align:right;"><button class="btn" id="hx">닫기</button></div>`; bd.appendChild(m); document.body.appendChild(bd); m.querySelector('#hx').onclick=()=> bd.remove();
  };

  // Actor registry
  const actorMap = new Map();
  const ensureActor=(id)=>{
    if(actorMap.has(id)) return actorMap.get(id);
    const el=document.createElement('img'); el.className='actor'; el.style.left='50%'; el.style.bottom='0'; el.style.transform='translate(-50%,0) scale(1)'; actors.appendChild(el); const a={el, id, emotion:'default', x:0.5, y:1.0, scale:1}; actorMap.set(id,a); return a;
  };
  const place=(a)=>{ const px=(a.x*100).toFixed(2)+'%'; a.el.style.left=px; a.el.style.bottom=((a.y-1)*100).toFixed(2)+'%'; a.el.style.transform=`translate(-50%,0) scale(${a.scale})`; };

  // Command handlers
  const events = ep.events||[];
  const handlers={
    async bg(ev){ if(!ev.name) return; const url=pathForBg(cfg, ev.name); try{ await loadImage(url); }catch{} bg.style.backgroundImage = `url('${url}')`; },
    async show(ev){ const id=ev.id; if(!id) return; const a=ensureActor(id); a.emotion=ev.emotion||'default'; a.el.src = pathForChar(cfg, id, a.emotion); if(ev.side){ a.x = ev.side==='left'? 0.2 : ev.side==='center'? 0.5 : 0.8; } if(ev.pos){ if(typeof ev.pos.x==='number') a.x=ev.pos.x; if(typeof ev.pos.y==='number') a.y=ev.pos.y; if(typeof ev.pos.scale==='number') a.scale=ev.pos.scale; } place(a); a.el.style.opacity='0'; a.el.animate([{opacity:0, transform:`translate(-50%,0) scale(${a.scale*0.95})`},{opacity:1, transform:`translate(-50%,0) scale(${a.scale})`}], { duration: ev.dur||250, easing: cfg.easing, fill:'forwards' }); await wait(ev.dur||250); },
    async hide(ev){ const id=ev.id; const a=actorMap.get(id); if(!a) return; a.el.animate([{opacity:1},{opacity:0}], { duration: ev.dur||200, easing: cfg.easing, fill:'forwards' }); await wait(ev.dur||200); a.el.remove(); actorMap.delete(id); },
    async move(ev){ const id=ev.id; const a=actorMap.get(id); if(!a) return; if(ev.pos){ if(typeof ev.pos.x==='number') a.x=ev.pos.x; if(typeof ev.pos.y==='number') a.y=ev.pos.y; if(typeof ev.pos.scale==='number') a.scale=ev.pos.scale; } const start = a.el.getBoundingClientRect(); place(a); const end = a.el.getBoundingClientRect(); a.el.animate([{ transform:a.el.style.transform },{ transform:`translate(-50%,0) scale(${a.scale})` }], { duration: ev.dur||250, easing: cfg.easing, fill:'forwards' }); await wait(ev.dur||250); },
    async say(ev, idx){
      if(!ev.text) return; nameEl.textContent = ev.speaker||''; textEl.textContent='';
      const tp={...cfg.typing, ...(ev.type||{})};
      await typeText(textEl, String(ev.text), tp.speed, tp.skippable!==false);
      (state.ui.epHistory||[]).push({ speaker: ev.speaker||'', text: String(ev.text) });
      const dialogEl = textEl.closest('#epDialog') || textEl.parentElement;
      const next = events[idx+1];
      const shouldWait = !(next && next.cmd==='choice');
      if(dialogEl && shouldWait){ await waitAdvance(stage); }
    },
    async choice(ev){ choicesWrap.innerHTML=''; const items=(ev.items||[]).filter(it=> evalWhen(it.when, state)); if(!items.length) return; await new Promise(resolve=>{ items.forEach((it)=>{ const b=document.createElement('button'); b.className='btn'; b.textContent=it.label||'...'; b.onclick=()=>{ try{ applyEffects(state, it.effects||[]); }catch{} choicesWrap.innerHTML=''; navigateAfter(state, it.next||''); resolve(); }; choicesWrap.appendChild(b); }); }); },
    async wait(ev){ await wait(Math.max(0, ev.ms||0)); },
    async sfx(ev){ if(!ev.name) return; const a=getAudio(pathForSfx(cfg, ev.name)); a.currentTime=0; a.play().catch(()=>{}); },
    async bgm(ev){ if(!ev.name) return; const a=getAudio(pathForBgm(cfg, ev.name)); if(ev.stop){ a.pause(); a.currentTime=0; return; } a.loop = ev.loop!==false; a.volume = (typeof ev.volume==='number')? Math.max(0, Math.min(1, ev.volume)) : 1; a.play().catch(()=>{}); }
  };

  function wait(ms){ return new Promise(r=> setTimeout(r, ms)); }

  async function preload(){
    try{
      const imgs=[]; (ep.events||[]).forEach(ev=>{
        if(ev.cmd==='bg' && ev.name){ imgs.push(loadImage(pathForBg(cfg, ev.name))); }
        if(ev.cmd==='show' && ev.id){ imgs.push(loadImage(pathForChar(cfg, ev.id, ev.emotion||'default'))); }
      }); await Promise.all(imgs);
    }catch{}
  }

  async function run(){
    for(let i=0;i<events.length;i++){
      const ev = events[i]; if(!ev || !ev.cmd) continue; if(!evalWhen(ev.when, state)) continue; const fn=handlers[ev.cmd]; if(typeof fn==='function'){ /* eslint-disable no-await-in-loop */ await fn(ev, i); /* eslint-enable */ }
    }
  }

  function resize(){
    try{
      const baseW=1920, baseH=1080;
      const vpW = Math.max(1, Math.floor((window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || baseW));
      const vpH = Math.max(1, Math.floor((window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || baseH));
      const maxScale = Math.min(vpW/baseW, vpH/baseH);
      const scale = Math.max(0.5, maxScale);
      // center stage within fit box (avoid right-bottom drift)
      const fit = stage.parentElement; if(fit){
        // fill viewport fully on mobile
        fit.style.width = '100vw'; fit.style.height = '100vh';
        const tx = Math.floor((vpW - baseW*scale)/2);
        const ty = Math.floor((vpH - baseH*scale)/2);
        stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      } else {
        stage.style.transform = `scale(${scale})`;
      }
    }catch{}
  }
  root.innerHTML=''; root.appendChild(wrap); resize();
  window.addEventListener('resize', resize);
  await preload(); await run();
}



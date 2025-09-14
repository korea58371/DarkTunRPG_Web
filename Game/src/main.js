import { initState } from './state.js';
import { renderRoutesView } from './views/routes.js';
import { renderTitleView } from './views/title.js';
import { renderPartyView } from './views/party.js';
import { renderEpisodeView } from './views/episode.js';
import { renderSkillEditorView } from './views/skillEditor.js';
import { renderBattleView } from './views/battle.js';
import { renderRouteEditorView } from './views/routeEditor.js';
import * as BATTLE from './engine/battleCore.js';

const app = document.getElementById('app');
const seedSpan = document.getElementById('seed');

const state = initState();
// 전역 바인딩: 뷰에서 엔진 함수 접근
window.BATTLE = BATTLE;
window.appState = state;
if (seedSpan) seedSpan.textContent = state.rng.seed;

function render(view){
  try{
    if (window.UI_TIP && window.UI_TIP.hideTooltip) window.UI_TIP.hideTooltip();
    console.log('[render]', view);
    app.innerHTML = '';
    switch(view){
      case 'routes': return renderRoutesView(app, state);
      case 'title': return renderTitleView(app, state, ()=>{
        // 회차 시작: 새 시드 부여(한 회차 동안 고정)
        if(typeof window.newRunSeed === 'function'){
          state.rng = window.newRunSeed();
          const seedSpan2 = document.getElementById('seed'); if(seedSpan2) seedSpan2.textContent = state.rng.seed;
        }
        render('routes');
      });
      case 'party': return renderPartyView(app, state);
      case 'episode': return renderEpisodeView(app, state);
      case 'battle':
        if(!state.ui.battle){
          const ids = Object.keys(state.data.battles||{});
          state.ui.battle = ids[0] || 'BT-100';
        }
        return renderBattleView(app, state);
      case 'skillEditor':
        return renderSkillEditorView(app, state);
      case 'routeEditor':
        return renderRouteEditorView(app, state);
      default: return renderRoutesView(app, state);
    }
  }catch(err){
    console.error(err);
    app.innerHTML = `<div class="frame"><div style="padding:16px;color:#ff6b6b;">오류가 발생했습니다: ${err?.message||err}</div></div>`;
  }
}

document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click',()=>render(btn.dataset.view));
});

// 전역 리셋: 배드 엔딩 등에서 호출
window.resetState = ()=>{
  try{
    // 모달 정리
    document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove());
  }catch{}
  const fresh = initState();
  // 회차 새 시드
  if(typeof window.newRunSeed==='function') fresh.rng = window.newRunSeed();
  // 기존 객체를 재사용하도록 덮어쓰기
  Object.keys(state).forEach(k=> delete state[k]);
  Object.assign(state, fresh);
  const seedSpan2 = document.getElementById('seed'); if(seedSpan2) seedSpan2.textContent = state.rng.seed;
  render('title');
};

// 세션 최초 로드 시 seed 공급기 준비: 새 회차마다 다른 시드
window.newRunSeed = ()=>{
  const seed = Math.floor(Math.random()*0xFFFFFFFF) >>> 0;
  // 동적 import 없이 현재 번들 경로 기준 util 모듈 사용
  const mod = { exports: {} };
  // 간단 재생성: 전역 createRng가 없으므로 ESM을 흉내내지 않고 window에 캐시
  if(!window.__createRng){
    window.__createRng = (seed)=>{
      let s = seed >>> 0;
      function next(){ s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
      return { seed, next, int:(n)=>Math.floor(next()*n) };
    };
  }
  return window.__createRng(seed);
};
// ---- Fullscreen & responsive scaler (1920x1080 base) ----
function upsertViewportMeta(){
  try{
    let m = document.querySelector('meta[name="viewport"]');
    if(!m){ m=document.createElement('meta'); m.name='viewport'; document.head.appendChild(m); }
    // lock landscape-friendly scaling on mobile
    m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  }catch{}
}

function ensureFullscreenAndLandscape(){
  // Try fullscreen (may require user gesture; we also hook first interaction below)
  try{ if(document.fullscreenEnabled && !document.fullscreenElement){ document.documentElement.requestFullscreen().catch(()=>{}); } }catch{}
  // Try orientation lock to landscape on supported browsers
  try{ if(screen.orientation && screen.orientation.lock){ screen.orientation.lock('landscape').catch(()=>{}); } }catch{}
}

function applyGlobalScale(){
  try{
    const baseW = 1920, baseH = 1080;
    const vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || baseW;
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || baseH;
    const scale = Math.min(vw/baseW, vh/baseH);
    const root = app.firstElementChild; // each view creates a .frame root
    if(root && root.classList && root.classList.contains('frame')){
      root.style.transformOrigin = '0 0';
      root.style.width = baseW+'px';
      root.style.height = baseH+'px';
      root.style.transform = `scale(${scale})`;
      // center
      const px = Math.max(0, Math.floor((vw - baseW*scale)/2));
      const py = Math.max(0, Math.floor((vh - baseH*scale)/2));
      root.style.position='absolute'; root.style.left = px+'px'; root.style.top = py+'px';
      document.body.style.overflow='hidden';
      document.body.style.background = '#0b0f1a';
    }
    // Rotate prompt for portrait mobile
    const isPortrait = vh > vw;
    let prompt = document.getElementById('rotatePrompt');
    if(isPortrait){
      if(!prompt){
        prompt = document.createElement('div'); prompt.id='rotatePrompt';
        prompt.style.position='fixed'; prompt.style.inset='0'; prompt.style.background='rgba(0,0,0,0.85)';
        prompt.style.display='flex'; prompt.style.alignItems='center'; prompt.style.justifyContent='center';
        prompt.style.color='#cbd5e1'; prompt.style.fontSize='18px'; prompt.style.zIndex='9999';
        prompt.innerHTML = '<div style="text-align:center;">기기를 가로로 돌려주세요<br/><span style="font-size:12px;opacity:.8;">Landscape mode required</span></div>';
        document.body.appendChild(prompt);
      }
    } else {
      if(prompt) prompt.remove();
    }
  }catch{}
}

function afterRenderAdjust(){
  upsertViewportMeta();
  applyGlobalScale();
}

// First interaction fallback to enable fullscreen/orientation lock
let _fsTried=false;
function tryFsOnInteract(){ if(_fsTried) return; _fsTried=true; ensureFullscreenAndLandscape(); document.removeEventListener('click', tryFsOnInteract); document.removeEventListener('keydown', tryFsOnInteract); }
document.addEventListener('click', tryFsOnInteract, { once:false });
document.addEventListener('keydown', tryFsOnInteract, { once:false });
window.addEventListener('resize', applyGlobalScale);
window.addEventListener('orientationchange', ()=>{ setTimeout(applyGlobalScale, 50); });

ensureFullscreenAndLandscape();
render('title');
afterRenderAdjust();

window.render = render;

// Hook render to re-apply scaling after each view
const _origRender = window.render;
window.render = (v)=>{ _origRender(v); afterRenderAdjust(); };



import { initState } from './state.js';
import { renderRoutesView } from './views/routes.js';
import { renderTitleView } from './views/title.js';
import { renderPartyView } from './views/party.js';
import { renderEpisodeView } from './views/episode.js';
import { renderBattleView } from './views/battle.js';
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
render('title');

window.render = render;



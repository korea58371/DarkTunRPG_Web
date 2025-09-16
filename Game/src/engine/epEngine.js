// Visual-novel style episode engine (modular, data-driven)
// No hardcoded assets: paths come from config. DSL commands are executed sequentially.

import { applyEffects } from './rules.js';

export const EP_DEFAULT_CFG = {
  assets: {
    bgPath: 'assets/bg/',
    charPath: 'assets/cha/',
    popupPath: 'assets/popup/',
    sfxPath: 'assets/sfx/',
    bgmPath: 'assets/bgm/'
  },
  typing: { speed: 24, skippable: true },
  easing: 'ease',
  // overall screen scale multiplier; 1 = fit to viewport
  scale: 1,
  // 개발 중 이미지 캐시 무효화 (이미지 변경 시 즉시 반영)
  bustImageCache: true
};

// All episodes are now in DSL format
export function normalizeEpisode(ep){
  if(!ep) return { events: [] };
  if(Array.isArray(ep.events)) return ep;
  // Legacy format is no longer supported - all episodes should be converted to DSL
  console.warn('Legacy episode format detected - please convert to DSL format');
  return { events: [] };
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
  .ep-vn .layer-bg { position:absolute; inset:0; background:#0b0f1a center/cover no-repeat; z-index:1; }
  .ep-vn .layer-popup { position:absolute; inset:0; pointer-events:none; z-index:2; display:flex; align-items:center; justify-content:center; }
  .ep-vn .layer-actors { position:absolute; inset:0; pointer-events:none; z-index:3; }
  .ep-vn .actor { position:absolute; transform-origin:50% 100%; }
  .ep-vn .popup-img { max-width:80%; max-height:80%; object-fit:contain; opacity:0; transition:opacity 0.3s ease; }
  .ep-vn .layer-ui { position:absolute; left:0; right:0; bottom:0; padding:24px 48px 48px; pointer-events:none; z-index:4; }
  .ep-vn .dialog { background:rgba(8,12,22,0.85); border:1px solid #2b3450; border-radius:14px; padding:36px 44px; color:#cbd5e1; max-width:1600px; margin:0 auto; font-size:32px; line-height:1.6; pointer-events:auto; will-change:transform; transform:translateZ(0); min-height:240px; }
  .ep-vn .dialog .name { font-weight:700; color:#e6f1ff; margin-bottom:12px; font-size:36px; }
  .ep-vn .choices { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:flex; flex-direction:column; gap:16px; align-items:center; justify-content:center; z-index:10; pointer-events:auto; }
  .ep-vn .choices .btn { font-size:28px; padding:14px 28px; min-width:420px; }
  .ep-vn .history-btn { position:absolute; right:12px; bottom:180px; z-index:5; pointer-events:auto; }
  .ep-vn .skip-btn { position:absolute; right:12px; bottom:240px; background:rgba(8,12,22,0.8); border:1px solid #2b3450; color:#9aa0a6; font-size:18px; padding:8px 16px; border-radius:8px; cursor:pointer; transition:all 0.2s ease; z-index:5; pointer-events:auto; }
  .ep-vn .skip-btn:hover { background:rgba(43,52,80,0.8); color:#cbd5e1; border-color:#5cc8ff; }
  .ep-vn .skip-btn:active { transform:scale(0.95); }
  .ep-vn .save-btn { position:absolute; left:12px; bottom:240px; background:rgba(42,74,42,0.8); border:1px solid #4a6a4a; color:#a0ff9e; font-size:16px; padding:8px 16px; border-radius:8px; cursor:pointer; transition:all 0.2s ease; z-index:5; pointer-events:auto; }
  .ep-vn .save-btn:hover { background:rgba(74,106,74,0.8); color:#cbd5e1; border-color:#a0ff9e; }
  .ep-vn .save-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .ep-vn .load-btn { position:absolute; left:12px; bottom:180px; background:rgba(74,74,42,0.8); border:1px solid #6a6a4a; color:#ffd479; font-size:16px; padding:8px 16px; border-radius:8px; cursor:pointer; transition:all 0.2s ease; z-index:5; pointer-events:auto; }
  .ep-vn .load-btn:hover { background:rgba(106,106,74,0.8); color:#cbd5e1; border-color:#ffd479; }
  .ep-vn .load-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .ep-vn .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; }
  .ep-vn .modal { background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; padding:16px; border-radius:10px; min-width:320px; }
  `; document.head.appendChild(st);
}

const _imgCache = new Map();
const _audioCache = new Map();

function loadImage(url, bustCache = false){
  const cacheKey = bustCache ? `${url}?v=${Date.now()}&r=${Math.random()}` : url;
  
  // 캐시 버스팅이 활성화되면 내부 캐시도 무시
  if(bustCache) {
    _imgCache.delete(url);
  }
  
  if(!bustCache && _imgCache.has(url)) return _imgCache.get(url);
  
  const p = new Promise((res, rej)=>{
    const img=new Image();
    
    // 브라우저 캐시 완전 무효화
    if(bustCache) {
      img.crossOrigin = 'anonymous';
      // 강제 리로드를 위한 추가 헤더 설정 시도
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', cacheKey, true);
        xhr.responseType = 'blob';
        xhr.onload = () => {
          if(xhr.status === 200) {
            const blob = xhr.response;
            const objectURL = URL.createObjectURL(blob);
            img.onload = () => {
              URL.revokeObjectURL(objectURL);
              res(img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectURL);
              rej(new Error('Image load failed'));
            };
            img.src = objectURL;
          } else {
            // 폴백: 직접 로드
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = cacheKey;
          }
        };
        xhr.onerror = () => {
          // 폴백: 직접 로드
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = cacheKey;
        };
        xhr.send();
      } catch(e) {
        // 폴백: 직접 로드
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = cacheKey;
      }
    } else {
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = cacheKey;
    }
  });
  
  _imgCache.set(url, p); 
  return p;
}

// 이미지 캐시 클리어 함수
function clearImageCache(){
  _imgCache.clear();
  _audioCache.clear();
  console.log('이미지 및 오디오 캐시가 클리어되었습니다.');
}

// 강제 새로고침 함수
function forceReloadImages(){
  // 모든 img 태그의 src를 캐시 버스팅으로 업데이트
  document.querySelectorAll('.ep-vn img').forEach(img => {
    const originalSrc = img.src.split('?')[0]; // 쿼리 파라미터 제거
    img.src = `${originalSrc}?v=${Date.now()}&r=${Math.random()}`;
  });
  
  // 배경 이미지도 업데이트
  document.querySelectorAll('.ep-vn .layer-bg, .ep-vn .layer-bg > div').forEach(el => {
    const bgImage = el.style.backgroundImage;
    if(bgImage && bgImage.includes('url(')) {
      const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if(urlMatch) {
        const originalUrl = urlMatch[1].split('?')[0];
        el.style.backgroundImage = `url('${originalUrl}?v=${Date.now()}&r=${Math.random()}')`;
      }
    }
  });
  
  console.log('모든 이미지가 강제로 새로고침되었습니다.');
}

// 게임 오버 처리 함수
async function performGameOver(state){
  console.log('[GAMEOVER] 게임 오버 처리 시작');
  
  // 1. 상태 초기화
  const preserveData = {
    data: state.data // 게임 데이터는 보존
  };
  
  // 2. 모든 게임 상태 초기화
  Object.keys(state).forEach(key => {
    if(key !== 'data') delete state[key];
  });
  
  // 3. 기본 상태로 재설정
  Object.assign(state, {
    ...preserveData,
    party: { members: ['C-001'], positions: { 'C-001': 1 } },
    persist: { hp: {}, mp: {} },
    flags: {},
    skillProgress: {},
    ui: {},
    ownedUnits: { 'C-001': true }
  });
  
  // 4. 새로운 난수 시드 생성
  if(typeof window.newRunSeed === 'function') {
    state.rng = window.newRunSeed();
    const seedSpan = document.getElementById('seed'); 
    if(seedSpan) seedSpan.textContent = state.rng.seed;
  }
  
  console.log('[GAMEOVER] 상태 초기화 완료', { newSeed: state.rng?.seed });
}

// 게임 오버 트리거 함수
function triggerGameOver(state, reason = 'unknown'){
  console.log('[GAMEOVER] 게임 오버 트리거:', reason);
  
  // 전투 상태 완전 정리
  if(state.ui.battleState) {
    state.ui.battleState.gameOverTriggered = true;
    state.ui.battleState.winner = 'gameover';
  }
  
  // 게임 오버 에피소드로 이동
  state.ui.currentEpisode = 'EP-GAMEOVER';
  state.ui.battle = null;
  delete state.ui.battleState;
  
  // 게임 오버 사유 기록
  state.flags = state.flags || {};
  state.flags.gameOverReason = reason;
  
  // 모든 진행 중인 애니메이션과 타이머 정리
  try {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    clearAllBattleTimers();
  } catch(e) {
    console.warn('[gameover-cleanup-error]', e);
  }
  
  // 에피소드 화면으로 이동
  if(typeof window.render === 'function') {
    window.render('episode');
  } else {
    const btn = document.querySelector('nav button[data-view=episode]');
    if(btn) btn.click();
  }
}

// 전투 관련 타이머 정리 함수
function clearAllBattleTimers(){
  // 모든 setTimeout/setInterval 정리 (전역 타이머 ID 추적이 없으므로 DOM 기반 정리)
  try {
    const battleFrame = document.querySelector('.battle-frame');
    if(battleFrame) {
      // 전투 관련 모든 애니메이션 중지
      battleFrame.getAnimations?.().forEach(anim => anim.cancel());
      
      // 전투 관련 요소들 정리
      battleFrame.querySelectorAll('*').forEach(el => {
        try {
          el.getAnimations?.().forEach(anim => anim.cancel());
        } catch(e) {}
      });
    }
  } catch(e) {
    console.warn('[clear-timers-error]', e);
  }
}

// 전역에서 접근 가능하도록 설정
if(typeof window !== 'undefined') {
  window.clearEpisodeImageCache = clearImageCache;
  window.forceReloadEpisodeImages = forceReloadImages;
  window.performGameOver = performGameOver;
  window.triggerGameOver = triggerGameOver;
  
  // 개발 편의를 위한 단축키
  window.reloadImages = forceReloadImages;
}
function getAudio(url){
  if(_audioCache.has(url)) return _audioCache.get(url);
  const a = new Audio(url); a.preload='auto'; _audioCache.set(url, a); return a;
}

function pathForChar(cfg, id, emotion){
  // story 폴더 또는 직접 파일 경로 지원
  if (id.includes('/')) {
    return `${cfg.assets.charPath}${id}.png`;
  }
  return `${cfg.assets.charPath}${id}/${emotion||'default'}.png`;
}
function pathForBg(cfg, name){ return `${cfg.assets.bgPath}${name}.png`; }
function pathForPopup(cfg, name){ return `${cfg.assets.popupPath}${name}.png`; }
function pathForSfx(cfg, name){ return `${cfg.assets.sfxPath}${name}.ogg`; }
function pathForBgm(cfg, name){ return `${cfg.assets.bgmPath}${name}.ogg`; }

// Typewriter text with skip control
async function typeText(el, text, speed, skippable, globalSkipState){
  return await new Promise(resolve=>{
    let i=0; let skipping=false; const total=text.length; el.textContent='';
    
    // 전역 스킵이 활성화된 경우 즉시 완료
    if(globalSkipState && globalSkipState.skipToChoice) {
      el.textContent = text;
      resolve();
      return;
    }
    
    function onClick(){ 
      if(!skippable) return; 
      skipping=true; 
      el.textContent=text; 
      cleanup(); 
      resolve(); 
    }
    function cleanup(){ 
      el.removeEventListener('click', onClick); 
      document.removeEventListener('keydown', onKey); 
    }
    function onKey(e){ 
      if(e.key===' '||e.key==='Enter'){ onClick(); } 
    }
    
    // 클릭 이벤트를 대사창이 아닌 전체 스테이지에 바인딩
    const stage = el.closest('.ep-stage');
    if(stage) {
      stage.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    } else {
      el.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    }
    
    const timer=setInterval(()=>{
      // 전역 스킵 상태 확인
      if(globalSkipState && globalSkipState.skipToChoice) {
        skipping = true;
        el.textContent = text;
        clearInterval(timer);
        cleanup();
        resolve();
        return;
      }
      
      if(skipping){ clearInterval(timer); return; }
      if(i>=total){ 
        clearInterval(timer); 
        cleanup(); 
        resolve(); 
        return; 
      }
      el.textContent += text[i++];
    }, Math.max(10, 1000/Math.max(1, speed||24)));
    
    // cleanup 함수 수정
    function cleanup(){ 
      if(stage) {
        stage.removeEventListener('click', onClick);
      } else {
        el.removeEventListener('click', onClick);
      }
      document.removeEventListener('keydown', onKey); 
    }
  });
}

// Wait for user advance (click anywhere on dialog or Space/Enter)
async function waitAdvance(clickRoot, globalSkipState){
  return await new Promise(resolve=>{
    // 전역 스킵이 활성화된 경우 즉시 완료
    if(globalSkipState && globalSkipState.skipToChoice) {
      resolve();
      return;
    }
    
    let armed=false; const arm=()=>{ armed=true; };
    const onClick=(e)=>{ if(!armed) return; cleanup(); resolve(); };
    const onKey=(e)=>{ if(!armed) return; if(e.key===' '||e.key==='Enter'){ cleanup(); resolve(); } };
    function cleanup(){ clickRoot.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); }
    
    // 스킵 상태를 주기적으로 확인하는 인터벌
    const skipCheckInterval = setInterval(() => {
      if(globalSkipState && globalSkipState.skipToChoice) {
        clearInterval(skipCheckInterval);
        cleanup();
        resolve();
      }
    }, 10);
    
    // defer arming so that the click used to skip 타이핑은 소비되고, 다음 클릭부터 진행
    setTimeout(()=>{ arm(); }, 30);
    clickRoot.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    
    // cleanup 함수 수정
    function cleanup(){ 
      clearInterval(skipCheckInterval);
      clickRoot.removeEventListener('click', onClick); 
      document.removeEventListener('keydown', onKey); 
    }
  });
}

// Navigate after choice
function navigateAfter(state, next){
  if(!next) return;
  
  // GAMEOVER screen
  if(next==='GAMEOVER'){
    const backdrop = document.createElement('div'); backdrop.className='modal-backdrop'; backdrop.id='ep-gameover-backdrop';
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `<h3>Game Over</h3><p>게임이 종료되었습니다.</p><p style="color:#9aa0a6;">잠시 후 타이틀로 돌아갑니다...</p>`;
    backdrop.appendChild(modal); document.body.appendChild(backdrop);
    
    // 게임 오버 처리
    setTimeout(async () => {
      try{
        // 상태 완전 초기화
        await performGameOver(state);
        
        // VN DOM 정리
        const epWrap = document.querySelector('.ep-vn'); if(epWrap) epWrap.remove();
        const gameoverBd = document.getElementById('ep-gameover-backdrop'); if(gameoverBd) gameoverBd.remove();
        document.querySelectorAll('.modal-backdrop').forEach(el=>{ try{ el.remove(); }catch{} });
        
        // 타이틀로 이동
        if(typeof window.render==='function'){ await window.render('title'); }
        else { const btn=document.querySelector('nav button[data-view=title]'); if(btn) btn.click(); }
      }catch(e){
        console.error('[gameover-error]', e);
        // 폴백: 강제 리로드
        window.location.reload();
      }
    }, 2000);
    return;
  }
  
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
  if(next.startsWith('EXPLO-')){ state.ui.currentExploration=next; (window.render? window.render('exploration'): null); return; }
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
  stage.innerHTML = `<div class="layer-bg" id="epBg"></div><div class="layer-popup" id="epPopup"></div><div class="layer-actors" id="epActors"></div><div class="layer-ui"><div class="dialog" id="epDialog" style="display:none;"><div class="name" id="epName"></div><div class="text" id="epText"></div></div></div>`;
  // ensure visible initial background (solid color) until first bg event
  stage.querySelector('#epBg').style.background = '#0b0f1a';
  const bg=stage.querySelector('#epBg'); const popup=stage.querySelector('#epPopup'); const actors=stage.querySelector('#epActors'); const nameEl=stage.querySelector('#epName'); const textEl=stage.querySelector('#epText');
  const choicesWrap=document.createElement('div'); choicesWrap.className='choices'; stage.appendChild(choicesWrap);
  const btnHistory=document.createElement('button'); btnHistory.className='btn history-btn'; btnHistory.textContent='히스토리'; stage.appendChild(btnHistory);
  const btnSkip=document.createElement('button'); btnSkip.className='skip-btn'; btnSkip.textContent='⏭️ 스킵'; stage.appendChild(btnSkip);
  const btnSave=document.createElement('button'); btnSave.className='save-btn'; btnSave.textContent='💾 저장'; stage.appendChild(btnSave);
  const btnLoad=document.createElement('button'); btnLoad.className='load-btn'; btnLoad.textContent='📁 불러오기'; stage.appendChild(btnLoad);
  state.ui = state.ui || {}; state.ui.epHistory = state.ui.epHistory || [];
  
  // 스킵 상태 관리
  const skipState = {
    skipToChoice: false,
    isSkipping: false
  };

  // history modal
  btnHistory.onclick=()=>{
    const bd=document.createElement('div'); bd.className='modal-backdrop'; const m=document.createElement('div'); m.className='modal';
    const lines = (state.ui.epHistory||[]).map(h=>`<div><strong>${h.speaker}</strong>: ${h.text}</div>`).join('');
    m.innerHTML = `<h3>히스토리</h3><div style="max-height:360px; overflow:auto;">${lines||'<div style=\"color:#9aa0a6;\">기록 없음</div>'}</div><div class="actions" style="margin-top:8px; text-align:right;"><button class="btn" id="hx">닫기</button></div>`; bd.appendChild(m); document.body.appendChild(bd); m.querySelector('#hx').onclick=()=> bd.remove();
  };
  
  // skip button
  btnSkip.onclick=()=>{
    if(!skipState.skipToChoice) {
      skipState.skipToChoice = true;
      skipState.isSkipping = true;
      btnSkip.textContent = '⏸️ 일시정지';
      btnSkip.style.background = 'rgba(220,38,38,0.8)';
    } else {
      skipState.skipToChoice = false;
      skipState.isSkipping = false;
      btnSkip.textContent = '⏭️ 스킵';
      btnSkip.style.background = 'rgba(8,12,22,0.8)';
    }
  };
  
  // save/load buttons
  btnSave.onclick = async () => {
    try {
      const { showSaveLoadModal } = await import('../views/saveLoad.js');
      await showSaveLoadModal(state, 'save');
    } catch(e) {
      console.error('[SAVE-ERROR]', e);
    }
  };
  
  btnLoad.onclick = async () => {
    try {
      const { showSaveLoadModal } = await import('../views/saveLoad.js');
      await showSaveLoadModal(state, 'load');
    } catch(e) {
      console.error('[LOAD-ERROR]', e);
    }
  };

  // Actor registry
  const actorMap = new Map();
  let currentPopup = null;
  
  const ensureActor=(id)=>{
    if(actorMap.has(id)) return actorMap.get(id);
    const el=document.createElement('img'); el.className='actor'; el.style.left='50%'; el.style.bottom='0'; el.style.transform='translate(-50%,0) scale(1)'; actors.appendChild(el); const a={el, id, emotion:'default', x:0.5, y:1.0, scale:1, offsetX:0, offsetY:0}; actorMap.set(id,a); return a;
  };
  
  const place=(a)=>{ 
    const px=((a.x*100) + a.offsetX).toFixed(2)+'%'; 
    const py=(((a.y-1)*100) + a.offsetY).toFixed(2)+'%';
    a.el.style.left=px; 
    a.el.style.bottom=py; 
    a.el.style.transform=`translate(-50%,0) scale(${a.scale})`; 
  };

  // Command handlers
  const events = ep.events||[];
  const handlers={
    async bg(ev){ 
      if(!ev.name) return; 
      const url=pathForBg(cfg, ev.name); 
      try{ await loadImage(url, cfg.bustImageCache); }catch{} 
      
      const finalUrl = cfg.bustImageCache ? `${url}?t=${Date.now()}` : url;
      
      // 스킵 중이면 즉시 배경 변경
      if(skipState.skipToChoice) {
        bg.style.backgroundImage = `url('${finalUrl}')`;
        return;
      }
      
      // 페이드 효과와 함께 배경 변경
      const newBg = document.createElement('div');
      newBg.style.cssText = `position:absolute; inset:0; background-image:url('${finalUrl}'); background-size:cover; background-position:center; opacity:0; transition:opacity ${ev.dur||500}ms ease;`;
      bg.appendChild(newBg);
      // 애니메이션 시작
      setTimeout(() => { newBg.style.opacity = '1'; }, 10);
      // 이전 배경들 정리 (새 배경이 완전히 나타난 후)
      setTimeout(() => {
        while(bg.children.length > 1) {
          bg.removeChild(bg.firstChild);
        }
      }, (ev.dur||500) + 50);
      await wait(ev.dur||500);
    },
    async show(ev){ 
      const id=ev.id; if(!id) return; 
      const a=ensureActor(id); 
      a.emotion=ev.emotion||'default'; 
      
      // 캐릭터 이미지 경로 설정 (story 폴더 지원)
      const charPath = id.includes('/') ? pathForChar(cfg, id) : pathForChar(cfg, id, a.emotion);
      const finalPath = cfg.bustImageCache ? `${charPath}?t=${Date.now()}` : charPath;
      a.el.src = finalPath;
      
      // 위치 설정 (side, pos, offset 지원)
      if(ev.side){ 
        a.x = ev.side==='left'? 0.2 : ev.side==='center'? 0.5 : ev.side==='right'? 0.8 : 0.5; 
      }
      if(ev.pos){ 
        if(typeof ev.pos.x==='number') a.x=ev.pos.x; 
        if(typeof ev.pos.y==='number') a.y=ev.pos.y; 
        if(typeof ev.pos.scale==='number') a.scale=ev.pos.scale; 
      }
      if(ev.offset){
        if(typeof ev.offset.x==='number') a.offsetX=ev.offset.x;
        if(typeof ev.offset.y==='number') a.offsetY=ev.offset.y;
      }
      
      place(a); 
      a.el.style.opacity='0'; 
      
      // 스킵 중이면 애니메이션 생략
      if(skipState.skipToChoice) {
        a.el.style.opacity = '1';
        return;
      }
      
      a.el.animate([{opacity:0, transform:`translate(-50%,0) scale(${a.scale*0.95})`},{opacity:1, transform:`translate(-50%,0) scale(${a.scale})`}], { duration: ev.dur||250, easing: cfg.easing, fill:'forwards' }); 
      await wait(ev.dur||250); 
    },
    async hide(ev){ 
      const id=ev.id; const a=actorMap.get(id); if(!a) return; 
      
      // 스킵 중이면 즉시 제거
      if(skipState.skipToChoice) {
        a.el.remove(); 
        actorMap.delete(id); 
        return;
      }
      
      a.el.animate([{opacity:1},{opacity:0}], { duration: ev.dur||200, easing: cfg.easing, fill:'forwards' }); 
      await wait(ev.dur||200); 
      a.el.remove(); 
      actorMap.delete(id); 
    },
    async move(ev){ 
      const id=ev.id; const a=actorMap.get(id); if(!a) return; 
      if(ev.pos){ 
        if(typeof ev.pos.x==='number') a.x=ev.pos.x; 
        if(typeof ev.pos.y==='number') a.y=ev.pos.y; 
        if(typeof ev.pos.scale==='number') a.scale=ev.pos.scale; 
      }
      if(ev.offset){
        if(typeof ev.offset.x==='number') a.offsetX=ev.offset.x;
        if(typeof ev.offset.y==='number') a.offsetY=ev.offset.y;
      }
      
      // 스킵 중이면 즉시 이동
      if(skipState.skipToChoice) {
        place(a);
        return;
      }
      
      const oldTransform = a.el.style.transform;
      place(a); 
      a.el.animate([{ transform: oldTransform },{ transform: a.el.style.transform }], { duration: ev.dur||250, easing: cfg.easing, fill:'forwards' }); 
      await wait(ev.dur||250); 
    },
    async say(ev, idx){
      if(!ev.text) return; 
      
      // 첫 번째 대사가 나올 때 대사창 표시
      const dialogEl = stage.querySelector('#epDialog');
      if(dialogEl && dialogEl.style.display === 'none') {
        dialogEl.style.display = 'block';
      }
      
      nameEl.textContent = ev.speaker||''; textEl.textContent='';
      const tp={...cfg.typing, ...(ev.type||{})};
      await typeText(textEl, String(ev.text), tp.speed, tp.skippable!==false, skipState);
      (state.ui.epHistory||[]).push({ speaker: ev.speaker||'', text: String(ev.text) });
      const next = events[idx+1];
      const shouldWait = !(next && next.cmd==='choice');
      if(dialogEl && shouldWait){ await waitAdvance(stage, skipState); }
    },
    async choice(ev){ 
      choicesWrap.innerHTML=''; 
      const items=(ev.items||[]).filter(it=> evalWhen(it.when, state)); 
      if(!items.length) return; 
      
      // 선택지에 도달하면 스킵 상태 리셋
      skipState.skipToChoice = false;
      skipState.isSkipping = false;
      btnSkip.textContent = '⏭️ 스킵';
      btnSkip.style.background = 'rgba(8,12,22,0.8)';
      
      await new Promise(resolve=>{
        items.forEach((it)=>{
          const b=document.createElement('button'); 
          b.className='btn'; 
          b.textContent=it.label||'...'; 
          b.onclick=()=>{ 
            try{ applyEffects(state, it.effects||[]); }catch{} 
            choicesWrap.innerHTML=''; 
            navigateAfter(state, it.next||''); 
            resolve(); 
          }; 
          choicesWrap.appendChild(b); 
        }); 
      }); 
    },
    async wait(ev){ 
      // 스킵 중이면 대기 시간 무시
      if(skipState.skipToChoice) return;
      await wait(Math.max(0, ev.ms||0)); 
    },
    async sfx(ev){ if(!ev.name) return; const a=getAudio(pathForSfx(cfg, ev.name)); a.currentTime=0; a.play().catch(()=>{}); },
    async bgm(ev){ if(!ev.name) return; const a=getAudio(pathForBgm(cfg, ev.name)); if(ev.stop){ a.pause(); a.currentTime=0; return; } a.loop = ev.loop!==false; a.volume = (typeof ev.volume==='number')? Math.max(0, Math.min(1, ev.volume)) : 1; a.play().catch(()=>{}); },
    async popup(ev){
      if(!ev.name) return;
      const url = pathForPopup(cfg, ev.name);
      try{ await loadImage(url, cfg.bustImageCache); }catch{}
      
      // 기존 팝업 제거
      if(currentPopup){
        currentPopup.remove();
        currentPopup = null;
      }
      
      const img = document.createElement('img');
      img.className = 'popup-img';
      const finalUrl = cfg.bustImageCache ? `${url}?t=${Date.now()}` : url;
      img.src = finalUrl;
      
      // 크기 및 위치 설정
      if(ev.size){
        if(typeof ev.size.width === 'string') img.style.maxWidth = ev.size.width;
        if(typeof ev.size.height === 'string') img.style.maxHeight = ev.size.height;
      }
      
      popup.appendChild(img);
      currentPopup = img;
      
      // 스킵 중이면 즉시 표시
      if(skipState.skipToChoice) {
        img.style.opacity = '1';
        return;
      }
      
      // 페이드인 애니메이션
      setTimeout(() => { img.style.opacity = '1'; }, 10);
      await wait(ev.dur||300);
    },
    async hidePopup(ev){
      if(!currentPopup) return;
      
      // 스킵 중이면 즉시 제거
      if(skipState.skipToChoice) {
        currentPopup.remove();
        currentPopup = null;
        return;
      }
      
      currentPopup.style.opacity = '0';
      setTimeout(() => {
        if(currentPopup){
          currentPopup.remove();
          currentPopup = null;
        }
      }, ev.dur||300);
      await wait(ev.dur||300);
    }
  };

  function wait(ms){ return new Promise(r=> setTimeout(r, ms)); }

  async function preload(){
    try{
      const imgs=[]; (ep.events||[]).forEach(ev=>{
        if(ev.cmd==='bg' && ev.name){ imgs.push(loadImage(pathForBg(cfg, ev.name), cfg.bustImageCache)); }
        if(ev.cmd==='show' && ev.id){ 
          const charPath = ev.id.includes('/') ? pathForChar(cfg, ev.id) : pathForChar(cfg, ev.id, ev.emotion||'default');
          imgs.push(loadImage(charPath, cfg.bustImageCache)); 
        }
        if(ev.cmd==='popup' && ev.name){ imgs.push(loadImage(pathForPopup(cfg, ev.name), cfg.bustImageCache)); }
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



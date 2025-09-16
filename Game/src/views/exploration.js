// 탐색 이벤트 시스템

export async function renderExplorationView(root, state, explorationId) {
  console.log('[EXPLORATION] 렌더링 시작:', explorationId);
  console.log('[EXPLORATION] state.data:', state.data);
  console.log('[EXPLORATION] state.data.explorations:', state.data?.explorations);
  
  // 데이터 로딩 우선순위: localStorage > state.data > 기본 데이터
  let explorationData = null;
  let allExplorations = null;
  
  // 1. localStorage에서 로드 시도 (임시로 비활성화)
  try {
    const savedData = localStorage.getItem('game_explorations');
    if (savedData) {
      allExplorations = JSON.parse(savedData);
      explorationData = allExplorations[explorationId];
      console.log('[EXPLORATION] localStorage에서 데이터 로드:', explorationData);
      
      // 이벤트 정보가 없는 경우 기본 데이터 사용
      if (explorationData && explorationData.objects) {
        const hasEvents = explorationData.objects.some(obj => obj.event);
        if (!hasEvents) {
          console.log('[EXPLORATION] localStorage 데이터에 이벤트 없음, 기본 데이터 사용');
          explorationData = null;
        }
      }
    }
  } catch (error) {
    console.error('[EXPLORATION] localStorage 로드 실패:', error);
  }
  
  // 2. localStorage에 없으면 state.data에서 로드
  if (!explorationData) {
    explorationData = state.data?.explorations?.[explorationId];
    if (explorationData) {
      console.log('[EXPLORATION] state.data에서 데이터 발견:', explorationData);
    }
  }
  
  // 3. 둘 다 없으면 기본 데이터 로드
  if (!explorationData) {
    console.log('[EXPLORATION] state.data에서 데이터 없음, 기본 데이터 로드 시도');
    try {
      const { EXPLORATIONS } = await import('../data/explorations.js');
      explorationData = EXPLORATIONS[explorationId];
      console.log('[EXPLORATION] 기본 데이터 로드 성공:', explorationData);
    } catch (error) {
      console.error('[EXPLORATION] 기본 데이터 로드 실패:', error);
    }
  }
  
  if (!explorationData) {
    root.innerHTML = '<div class="panel">탐색 데이터를 찾을 수 없습니다.</div>';
    return;
  }
  
  const wrap = document.createElement('section');
  wrap.className = 'panel exploration-view';
  
  // 탐색 화면 스타일 주입
  injectExplorationStyles();
  
  wrap.innerHTML = `
    <div class="exploration-stage">
      <div class="exploration-bg" id="exploBg"></div>
      <div class="exploration-objects" id="exploObjects"></div>
      <div class="exploration-ui">
        <div class="exploration-info">
          <h3>${explorationData.title || explorationId}</h3>
          <p>${explorationData.description || '주변을 탐색해보세요.'}</p>
        </div>
        <div class="exploration-controls">
          <button class="btn" id="exploExit">나가기</button>
        </div>
      </div>
    </div>
  `;
  
  const bg = wrap.querySelector('#exploBg');
  const objectsContainer = wrap.querySelector('#exploObjects');
  
  // 배경 설정
  if (explorationData.background) {
    bg.style.backgroundImage = `url('${explorationData.background}')`;
  }
  
  // 탐색 객체들 배치
  (explorationData.objects || []).forEach(obj => {
    const objEl = document.createElement('div');
    objEl.className = 'exploration-object';
    objEl.dataset.objectId = obj.id;
    
    // 위치 설정
    objEl.style.left = `${obj.x || 50}%`;
    objEl.style.top = `${obj.y || 50}%`;
    objEl.style.width = `${obj.width || 100}px`;
    objEl.style.height = `${obj.height || 100}px`;
    
    // 이미지 설정
    if (obj.image) {
      objEl.style.backgroundImage = `url('${obj.image}')`;
      objEl.style.backgroundSize = 'contain';
      objEl.style.backgroundRepeat = 'no-repeat';
      objEl.style.backgroundPosition = 'center';
    } else {
      // 이미지가 없으면 기본 시각적 표시
      objEl.style.background = 'rgba(92, 200, 255, 0.2)';
      objEl.style.border = '2px dashed #5cc8ff';
      objEl.textContent = obj.id || '객체';
      objEl.style.display = 'flex';
      objEl.style.alignItems = 'center';
      objEl.style.justifyContent = 'center';
      objEl.style.color = '#cbd5e1';
      objEl.style.fontSize = '14px';
      objEl.style.fontWeight = 'bold';
    }
    
    // 툴팁 설정
    if (obj.tooltip) {
      objEl.title = obj.tooltip;
    }
    
    // 클릭 이벤트 (디버그 로그 추가)
    objEl.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[EXPLORATION-CLICK]', obj.id, 'clicked');
      await handleObjectClick(state, obj, explorationData);
    };
    
    // 추가 이벤트 리스너 (디버그용)
    objEl.onmouseenter = () => {
      console.log('[EXPLORATION-HOVER]', obj.id, 'hover start');
      objEl.style.borderColor = '#5cc8ff';
    };
    
    objEl.onmouseleave = () => {
      console.log('[EXPLORATION-HOVER]', obj.id, 'hover end');
      objEl.style.borderColor = 'transparent';
    };
    
    objectsContainer.appendChild(objEl);
  });
  
  // 나가기 버튼
  wrap.querySelector('#exploExit').onclick = () => {
    if (explorationData.exitRoute) {
      // 지정된 루트로 이동
      if (typeof window.render === 'function') {
        window.render('routes');
      }
    } else {
      // 이전 화면으로 복귀
      history.back();
    }
  };
  
  root.innerHTML = '';
  root.appendChild(wrap);
}

async function handleObjectClick(state, obj, explorationData) {
  console.log('[EXPLORATION] 객체 클릭:', obj.id);
  
  // 조건 체크
  if (obj.requirements && !(await checkExplorationRequirements(state, obj.requirements))) {
    showExplorationTooltip(obj.failMessage || '아직 상호작용할 수 없습니다.');
    return;
  }
  
  // 이벤트 상태 체크 (한번만 보상)
  const eventKey = `explo.${explorationData.id}.${obj.id}_triggered`;
  const alreadyTriggered = state.flags?.[eventKey];
  
  console.log('[EXPLORATION] 객체 정보:', obj);
  console.log('[EXPLORATION] obj.event:', obj.event);
  console.log('[EXPLORATION] obj.eventAfter:', obj.eventAfter);
  console.log('[EXPLORATION] alreadyTriggered:', alreadyTriggered);
  
  let currentEvent = obj.event;
  
  // 이미 트리거된 경우 대체 이벤트 사용
  if (alreadyTriggered && obj.eventAfter) {
    currentEvent = obj.eventAfter;
    console.log('[EXPLORATION] 대체 이벤트 사용:', obj.id);
  }
  
  console.log('[EXPLORATION] currentEvent:', currentEvent);
  
  // 이벤트 처리
  if (currentEvent) {
    handleExplorationEvent(state, currentEvent, explorationData);
  } else {
    // 이벤트가 없는 경우 기본 메시지 표시
    console.log('[EXPLORATION] 이벤트 없음:', obj.id);
    showExplorationMessage('상호작용', obj.tooltip || '이곳에는 특별한 것이 없습니다.');
  }
  
  // 효과 적용 (첫 번째 상호작용에만)
  if (!alreadyTriggered && obj.effects) {
    try {
      const { applyEffects } = await import('../engine/rules.js');
      applyEffects(state, obj.effects);
      
      // 이벤트 트리거 플래그 설정
      state.flags = state.flags || {};
      state.flags[eventKey] = true;
      
    } catch(e) {
      console.error('[EXPLORATION-EFFECTS-ERROR]', e);
    }
  }
  
  // 탐색 종료 조건 체크
  await checkExplorationExit(state, explorationData);
}

function handleExplorationEvent(state, event, explorationData) {
  switch (event.type) {
    case 'battle':
      // 전투 이벤트
      state.ui.battle = event.battleId;
      state.ui.currentEpisode = null;
      if (typeof window.render === 'function') {
        window.render('battle');
      }
      break;
      
    case 'episode':
      // 에피소드 이벤트
      state.ui.currentEpisode = event.episodeId;
      state.ui.battle = null;
      if (typeof window.render === 'function') {
        window.render('episode');
      }
      break;
      
    case 'route':
      // 루트 이동
      if (typeof window.render === 'function') {
        window.render('routes');
      }
      break;
      
    case 'message':
      // 메시지 표시
      showExplorationMessage(event.title || '발견', event.text || '');
      break;
      
    default:
      console.warn('[EXPLORATION] 알 수 없는 이벤트 타입:', event.type);
  }
}

async function checkExplorationRequirements(state, requirements) {
  try {
    const { checkRequirements } = await import('../engine/rules.js');
    return checkRequirements(state, requirements);
  } catch(e) {
    console.error('[EXPLORATION-REQ-ERROR]', e);
    return true; // 오류 시 허용
  }
}

async function checkExplorationExit(state, explorationData) {
  if (!explorationData.exitConditions) return;
  
  const canExit = await checkExplorationRequirements(state, explorationData.exitConditions);
  if (canExit) {
    showExplorationExitModal(state, explorationData);
  }
}

function showExplorationExitModal(state, explorationData) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '2001';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>탐색 완료</h3>
    <p>${explorationData.exitMessage || '탐색을 마치고 떠나시겠습니까?'}</p>
    <div class="row" style="justify-content:center; gap:8px; margin-top:12px;">
      <button class="btn" id="continueExplore">계속 탐색</button>
      <button class="btn primary" id="exitExplore">나가기</button>
    </div>
  `;
  
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  
  modal.querySelector('#continueExplore').onclick = () => backdrop.remove();
  modal.querySelector('#exitExplore').onclick = () => {
    backdrop.remove();
    
    if (explorationData.exitRoute) {
      // 지정된 루트로 이동
      const route = (state.data.routes || []).find(r => r.id === explorationData.exitRoute);
      if (route) {
        // 루트 방문 처리
        state.flags = state.flags || {};
        state.flags.visitedRoutes = state.flags.visitedRoutes || {};
        state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
        state.flags.visitedRoutes[route.id] = true;
        state.flags.runVisitedRoutes[route.id] = true;
        state.flags.lastRouteId = route.id;
      }
    }
    
    if (typeof window.render === 'function') {
      window.render('routes');
    }
  };
}

function showExplorationMessage(title, text) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '2001';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>${title}</h3>
    <p>${text}</p>
    <div class="row" style="justify-content:center; margin-top:12px;">
      <button class="btn primary" id="closeMessage">확인</button>
    </div>
  `;
  
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  
  modal.querySelector('#closeMessage').onclick = () => backdrop.remove();
}

function showExplorationTooltip(message) {
  // 간단한 툴팁 표시
  if (typeof window.UI_TIP?.showTooltip === 'function') {
    window.UI_TIP.showTooltip(message, window.innerWidth / 2, window.innerHeight / 2);
    setTimeout(() => window.UI_TIP.hideTooltip(), 2000);
  } else {
    alert(message);
  }
}

function injectExplorationStyles() {
  const id = 'exploration-styles';
  if (document.getElementById(id)) return;
  
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .exploration-view { 
      position: relative; 
      width: 100vw; 
      height: 100vh; 
      overflow: hidden; 
      background: #0b0f1a; 
    }
    
    .exploration-stage { 
      position: relative; 
      width: 100%; 
      height: 100%; 
    }
    
    .exploration-bg { 
      position: absolute; 
      inset: 0; 
      background-size: cover; 
      background-position: center; 
      background-repeat: no-repeat; 
    }
    
    .exploration-objects { 
      position: absolute; 
      inset: 0; 
      pointer-events: auto; 
      z-index: 10; 
    }
    
    .exploration-object { 
      position: absolute; 
      pointer-events: auto; 
      cursor: pointer; 
      border: 2px solid transparent; 
      border-radius: 8px; 
      transition: all 0.2s ease; 
      transform: translate(-50%, -50%); 
      z-index: 15;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .exploration-object:hover { 
      border-color: #5cc8ff; 
      box-shadow: 0 0 12px rgba(92, 200, 255, 0.3); 
      transform: translate(-50%, -50%) scale(1.05); 
    }
    
    .exploration-ui { 
      position: absolute; 
      top: 20px; 
      left: 20px; 
      right: 20px; 
      pointer-events: none; 
      z-index: 5;
    }
    
    .exploration-info { 
      background: rgba(8, 12, 22, 0.8); 
      border: 1px solid #2b3450; 
      border-radius: 8px; 
      padding: 12px 16px; 
      color: #cbd5e1; 
      margin-bottom: 12px; 
    }
    
    .exploration-controls { 
      display: flex; 
      gap: 8px; 
      justify-content: flex-end; 
    }
    
    .exploration-controls .btn { 
      pointer-events: auto; 
    }
    
    .save-slot:hover { 
      border-color: #5cc8ff !important; 
      background: #1a2332 !important; 
    }
    
    .save-slot.empty:hover { 
      background: #131720 !important; 
    }
  `;
  
  document.head.appendChild(style);
}

// 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.renderExplorationView = renderExplorationView;
}

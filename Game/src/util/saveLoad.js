// 세이브 & 로드 시스템

const SAVE_KEY = 'gameState';
const SAVE_SLOTS = 3; // 3개 슬롯

export function canSaveLoad(state) {
  // 전투 중에는 세이브/로드 불가
  return !state.ui.battle && !state.ui.battleState;
}

export function saveGame(state, slotIndex = 0) {
  if (!canSaveLoad(state)) {
    throw new Error('전투 중에는 저장할 수 없습니다.');
  }
  
  try {
    const saveData = {
      version: '1.0',
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(state))
    };
    
    const saves = getSaveList();
    saves[slotIndex] = saveData;
    
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    console.log(`[SAVE] 슬롯 ${slotIndex + 1}에 저장 완료`);
    return true;
  } catch(e) {
    console.error('[SAVE-ERROR]', e);
    return false;
  }
}

export function loadGame(slotIndex = 0) {
  try {
    const saves = getSaveList();
    const saveData = saves[slotIndex];
    
    if (!saveData) {
      throw new Error('저장된 데이터가 없습니다.');
    }
    
    console.log(`[LOAD] 슬롯 ${slotIndex + 1}에서 불러오기`);
    return saveData.state;
  } catch(e) {
    console.error('[LOAD-ERROR]', e);
    return null;
  }
}

export function getSaveList() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch(e) {
    console.error('[SAVE-LIST-ERROR]', e);
  }
  
  // 빈 슬롯 배열 반환
  return new Array(SAVE_SLOTS).fill(null);
}

export function deleteSave(slotIndex) {
  try {
    const saves = getSaveList();
    saves[slotIndex] = null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    console.log(`[DELETE] 슬롯 ${slotIndex + 1} 삭제 완료`);
    return true;
  } catch(e) {
    console.error('[DELETE-ERROR]', e);
    return false;
  }
}

export function formatSaveInfo(saveData) {
  if (!saveData) return null;
  
  const date = new Date(saveData.timestamp);
  const timeStr = date.toLocaleString('ko-KR');
  
  // 현재 위치 정보 추출
  let location = '시작 지점';
  if (saveData.state.ui?.currentEpisode) {
    location = `에피소드: ${saveData.state.ui.currentEpisode}`;
  } else if (saveData.state.flags?.lastRouteId) {
    const route = saveData.state.data?.routes?.find(r => r.id === saveData.state.flags.lastRouteId);
    location = route ? route.title : saveData.state.flags.lastRouteId;
  }
  
  // 파티 정보
  const partySize = (saveData.state.party?.members || []).filter(Boolean).length;
  
  return {
    timestamp: saveData.timestamp,
    timeStr,
    location,
    partySize,
    version: saveData.version || '1.0'
  };
}

import { saveGame, loadGame, getSaveList, deleteSave, formatSaveInfo, canSaveLoad } from '../util/saveLoad.js';
import { showGameAlert, showGameConfirm } from '../util/gameModal.js';

export async function showSaveLoadModal(state, mode = 'save') {
  if (mode === 'save' && !canSaveLoad(state)) {
    await showGameAlert('전투 중에는 저장할 수 없습니다.');
    return;
  }
  
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '2000';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.minWidth = '600px';
  
  const saves = getSaveList();
  const title = mode === 'save' ? '게임 저장' : '게임 불러오기';
  
  let slotsHTML = '';
  for (let i = 0; i < saves.length; i++) {
    const saveData = saves[i];
    const info = formatSaveInfo(saveData);
    
    if (info) {
      slotsHTML += `
        <div class="save-slot" data-slot="${i}" style="border:1px solid #2b3450; border-radius:8px; padding:12px; margin-bottom:8px; cursor:pointer; background:#131720;">
          <div class="row" style="justify-content:space-between; align-items:center;">
            <div class="col" style="gap:4px;">
              <strong>슬롯 ${i + 1}</strong>
              <div style="color:#9aa0a6; font-size:12px;">${info.timeStr}</div>
              <div style="color:#cbd5e1; font-size:14px;">${info.location}</div>
              <div style="color:#9aa0a6; font-size:12px;">파티: ${info.partySize}명</div>
            </div>
            <div class="col" style="gap:4px; align-items:flex-end;">
              <button class="btn danger delete-save" data-slot="${i}" style="padding:4px 8px; font-size:12px;">삭제</button>
            </div>
          </div>
        </div>
      `;
    } else {
      slotsHTML += `
        <div class="save-slot empty" data-slot="${i}" style="border:1px dashed #2b3450; border-radius:8px; padding:12px; margin-bottom:8px; cursor:pointer; background:#0f1524;">
          <div style="text-align:center; color:#9aa0a6;">
            <strong>슬롯 ${i + 1}</strong><br>
            <span style="font-size:12px;">비어있음</span>
          </div>
        </div>
      `;
    }
  }
  
  modal.innerHTML = `
    <h3>${title}</h3>
    <div class="save-slots" style="max-height:400px; overflow-y:auto;">
      ${slotsHTML}
    </div>
    <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
      <button class="btn" id="cancelSaveLoad">취소</button>
    </div>
  `;
  
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  
  // 이벤트 핸들러
  modal.querySelector('#cancelSaveLoad').onclick = () => backdrop.remove();
  
  // 슬롯 클릭 핸들러
  modal.querySelectorAll('.save-slot').forEach(slot => {
    slot.onclick = async () => {
      const slotIndex = Number(slot.dataset.slot);
      
      if (mode === 'save') {
        const success = saveGame(state, slotIndex);
        if (success) {
          backdrop.remove();
          await showGameAlert(`슬롯 ${slotIndex + 1}에 저장되었습니다.`);
        } else {
          await showGameAlert('저장에 실패했습니다.');
        }
      } else { // load
        const isEmpty = slot.classList.contains('empty');
        if (isEmpty) {
          await showGameAlert('빈 슬롯입니다.');
          return;
        }
        
        const confirmed = await showGameConfirm(`슬롯 ${slotIndex + 1}을 불러오시겠습니까?\n현재 진행 상황이 손실됩니다.`);
        if (confirmed) {
          const loadedState = loadGame(slotIndex);
          if (loadedState) {
            // 현재 상태를 로드된 상태로 교체
            Object.keys(state).forEach(key => delete state[key]);
            Object.assign(state, loadedState);
            
            backdrop.remove();
            
            // 화면 새로고침
            if (typeof window.render === 'function') {
              if (state.ui?.currentEpisode) {
                await window.render('episode');
              } else if (state.ui?.battle) {
                await window.render('battle');
              } else {
                await window.render('routes');
              }
            }
            
            await showGameAlert(`슬롯 ${slotIndex + 1}에서 불러왔습니다.`);
          } else {
            await showGameAlert('불러오기에 실패했습니다.');
          }
        }
      }
    };
  });
  
  // 삭제 버튼 핸들러
  modal.querySelectorAll('.delete-save').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const slotIndex = Number(btn.dataset.slot);
      
      const confirmed = await showGameConfirm(`슬롯 ${slotIndex + 1}을 삭제하시겠습니까?`);
      if (confirmed) {
        const success = deleteSave(slotIndex);
        if (success) {
          // 모달 새로고침
          backdrop.remove();
          await showSaveLoadModal(state, mode);
        } else {
          await showGameAlert('삭제에 실패했습니다.');
        }
      }
    };
  });
}

// 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.showSaveModal = (state) => showSaveLoadModal(state, 'save');
  window.showLoadModal = (state) => showSaveLoadModal(state, 'load');
}

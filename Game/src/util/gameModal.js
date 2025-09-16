// 게임 내 모달 시스템 (브라우저 alert/confirm 대체)

export function showGameAlert(message, title = '알림') {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = '10000';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.minWidth = '400px';
    modal.innerHTML = `
      <h3>${title}</h3>
      <p style="margin: 16px 0; line-height: 1.5;">${message}</p>
      <div class="row" style="justify-content:center; margin-top:16px;">
        <button class="btn primary" id="alertOk">확인</button>
      </div>
    `;
    
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    const okBtn = modal.querySelector('#alertOk');
    okBtn.focus();
    
    const cleanup = () => {
      backdrop.remove();
      resolve();
    };
    
    okBtn.onclick = cleanup;
    
    // ESC 키로 닫기
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeyDown);
        cleanup();
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

export function showGameConfirm(message, title = '확인') {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = '10000';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.minWidth = '400px';
    modal.innerHTML = `
      <h3>${title}</h3>
      <p style="margin: 16px 0; line-height: 1.5;">${message}</p>
      <div class="row" style="justify-content:center; gap:12px; margin-top:16px;">
        <button class="btn" id="confirmCancel">취소</button>
        <button class="btn primary" id="confirmOk">확인</button>
      </div>
    `;
    
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    const okBtn = modal.querySelector('#confirmOk');
    const cancelBtn = modal.querySelector('#confirmCancel');
    okBtn.focus();
    
    const cleanup = (result) => {
      backdrop.remove();
      resolve(result);
    };
    
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    
    // ESC 키로 취소
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeyDown);
        cleanup(false);
      } else if (e.key === 'Enter') {
        document.removeEventListener('keydown', onKeyDown);
        cleanup(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

export function showGamePrompt(message, defaultValue = '', title = '입력') {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = '10000';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.minWidth = '400px';
    modal.innerHTML = `
      <h3>${title}</h3>
      <p style="margin: 16px 0; line-height: 1.5;">${message}</p>
      <input id="promptInput" value="${defaultValue}" style="width: 100%; padding: 8px 12px; background: #0f1524; border: 1px solid #2b3450; color: #cbd5e1; border-radius: 6px; margin: 8px 0;"/>
      <div class="row" style="justify-content:center; gap:12px; margin-top:16px;">
        <button class="btn" id="promptCancel">취소</button>
        <button class="btn primary" id="promptOk">확인</button>
      </div>
    `;
    
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    const input = modal.querySelector('#promptInput');
    const okBtn = modal.querySelector('#promptOk');
    const cancelBtn = modal.querySelector('#promptCancel');
    
    input.focus();
    input.select();
    
    const cleanup = (result) => {
      backdrop.remove();
      resolve(result);
    };
    
    okBtn.onclick = () => cleanup(input.value);
    cancelBtn.onclick = () => cleanup(null);
    
    // Enter/ESC 키 처리
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKeyDown);
        cleanup(null);
      } else if (e.key === 'Enter') {
        document.removeEventListener('keydown', onKeyDown);
        cleanup(input.value);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });
}

// 전역 함수로 등록 (기존 alert/confirm/prompt 대체)
if (typeof window !== 'undefined') {
  window.gameAlert = showGameAlert;
  window.gameConfirm = showGameConfirm;
  window.gamePrompt = showGamePrompt;
}

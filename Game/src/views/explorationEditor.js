// 탐색 화면 배치 에디터

export function renderExplorationEditorView(root, state) {
  const wrap = document.createElement('section');
  wrap.className = 'panel';
  
  wrap.innerHTML = `
    <h2>탐색 화면 에디터</h2>
    <div class="row" style="gap:12px; align-items:flex-start;">
      <div class="panel" style="min-width:320px; max-width:380px;">
        <div class="row" style="gap:6px;">
          <input id="exploFilter" placeholder="검색(ID/제목)" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <button id="btnNewExplo" class="btn">신규 탐색</button>
          <button id="btnDeleteExplo" class="btn danger">삭제</button>
        </div>
        <div id="exploList" style="margin-top:8px; max-height:720px; overflow:auto;"></div>
      </div>
      <div class="panel" style="flex:1;">
        <div id="exploForm"></div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button id="btnDebugState" class="btn" style="background:#6b46c1;">디버그</button>
          <button id="btnPickDataDir" class="btn" style="background:#7c3aed;">데이터 폴더 지정</button>
          <button id="btnResetData" class="btn" style="background:#dc2626;">초기화</button>
          <button id="btnSaveExplo" class="btn primary">저장(explorations.js)</button>
          <button id="btnPreviewExplo" class="btn">미리보기</button>
        </div>
        <div id="exploCanvas" class="panel" style="margin-top:12px; height:500px; position:relative; background:#0b0f1a; border:2px solid #2b3450; overflow:hidden;"></div>
      </div>
    </div>
  `;
  
  // 초기 데이터 로딩 (localStorage > state.data > 기본 데이터 순서)
  let explorations = {};
  
  // 1. localStorage에서 로드 시도
  try {
    const savedData = localStorage.getItem('game_explorations');
    if (savedData) {
      explorations = JSON.parse(savedData);
      console.log('[EXPLORATION-EDITOR] localStorage에서 데이터 로드:', explorations);
    }
  } catch (error) {
    console.error('[EXPLORATION-EDITOR] localStorage 로드 실패:', error);
  }
  
  // 2. localStorage에 데이터가 없으면 state.data에서 로드
  if (Object.keys(explorations).length === 0) {
    explorations = state.data?.explorations || {};
    console.log('[EXPLORATION-EDITOR] state.data에서 데이터 로드:', explorations);
  }
  
  // 3. 둘 다 없으면 기본 데이터 로드
  if (Object.keys(explorations).length === 0) {
    import('../data/explorations.js').then(({ EXPLORATIONS }) => {
      explorations = { ...EXPLORATIONS };
      state.data = state.data || {};
      state.data.explorations = explorations;
      selectedId = Object.keys(explorations)[0] || null;
      renderList();
      renderForm();
      renderCanvas();
    });
  }
  
  let selectedId = Object.keys(explorations)[0] || null;
  let dataDirHandle = null;
  
  const listEl = wrap.querySelector('#exploList');
  const formEl = wrap.querySelector('#exploForm');
  const canvasEl = wrap.querySelector('#exploCanvas');
  const filterEl = wrap.querySelector('#exploFilter');
  
  // IndexedDB를 통한 데이터 폴더 핸들 저장
  async function idbOpen(){ 
    return await new Promise((resolve,reject)=>{ 
      const req=indexedDB.open('explorationEditorDB',1); 
      req.onupgradeneeded=()=>{ 
        try{ req.result.createObjectStore('handles'); }catch{} 
      }; 
      req.onsuccess=()=>resolve(req.result); 
      req.onerror=()=>reject(req.error); 
    }); 
  }
  async function idbGet(key){ 
    try{ 
      const db=await idbOpen(); 
      return await new Promise((res,rej)=>{ 
        const tx=db.transaction('handles'); 
        const st=tx.objectStore('handles'); 
        const r=st.get(key); 
        r.onsuccess=()=>res(r.result||null); 
        r.onerror=()=>rej(r.error); 
      }); 
    }catch{ return null; } 
  }
  async function idbSet(key,val){ 
    try{ 
      const db=await idbOpen(); 
      return await new Promise((res,rej)=>{ 
        const tx=db.transaction('handles','readwrite'); 
        const st=tx.objectStore('handles'); 
        const r=st.put(val,key); 
        r.onsuccess=()=>res(); 
        r.onerror=()=>rej(r.error); 
      }); 
    }catch{} 
  }
  
  // 저장된 데이터 폴더 핸들 로드
  (async ()=>{ 
    try{ 
      dataDirHandle = await idbGet('dataDirHandle'); 
    }catch{} 
  })();
  
  // 파일 시스템 API 헬퍼 함수들
  async function ensureDataDir(){
    if(!dataDirHandle){
      if(!window.showDirectoryPicker) return false;
      dataDirHandle = await window.showDirectoryPicker();
      await idbSet('dataDirHandle', dataDirHandle);
    }
    try{
      const p = await dataDirHandle.queryPermission?.({ mode:'readwrite' });
      if(p!=='granted'){ 
        const r = await dataDirHandle.requestPermission?.({ mode:'readwrite' }); 
        if(r!=='granted') return false; 
      }
    }catch{}
    return true;
  }
  
  async function writeToDataDir(filename, text){
    if(!(await ensureDataDir())) return false;
    try{
      const fh = await dataDirHandle.getFileHandle(filename, { create:true });
      const w = await fh.createWritable(); 
      await w.write(text); 
      await w.close();
      return true;
    }catch(e){ 
      console.error('[writeToDataDir]', filename, e); 
      return false; 
    }
  }
  
  function stringifyExplorationsJS(obj){ 
    return `export const EXPLORATIONS = ${JSON.stringify(obj, null, 2)};\n`; 
  }
  
  function renderList() {
    const q = (filterEl.value || '').toLowerCase();
    const filtered = Object.keys(explorations).filter(id => 
      !q || id.toLowerCase().includes(q) || (explorations[id].title || '').toLowerCase().includes(q)
    );
    
    listEl.innerHTML = filtered.map(id => {
      const explo = explorations[id];
      const sel = id === selectedId ? ' style="border-color:#5cc8ff;"' : '';
      return `<div class="card" data-id="${id}"${sel}><strong>${explo.title || id}</strong><div class="badge">${id}</div></div>`;
    }).join('');
    
    listEl.querySelectorAll('.card').forEach(el => {
      el.onclick = () => {
        selectedId = el.dataset.id;
        renderList();
        renderForm();
        renderCanvas();
      };
    });
  }
  
  function renderForm() {
    if (!selectedId) {
      formEl.innerHTML = '<div style="color:#9aa0a6;">좌측에서 탐색을 선택하거나 새로 만드세요.</div>';
      return;
    }
    
    const explo = explorations[selectedId] || {
      id: selectedId,
      title: '',
      description: '',
      background: '',
      objects: [],
      exitConditions: [],
      exitRoute: '',
      exitMessage: ''
    };
    
    formEl.innerHTML = `
      <div class="col" style="gap:8px;">
        <label class="row" style="gap:8px; align-items:center;">
          <span style="width:120px; color:#9aa0a6;">ID:</span>
          <input id="exploId" value="${explo.id || selectedId}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
        </label>
        <label class="row" style="gap:8px; align-items:center;">
          <span style="width:120px; color:#9aa0a6;">제목:</span>
          <input id="exploTitle" value="${explo.title || ''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
        </label>
        <label class="col" style="gap:4px;">
          <span style="color:#9aa0a6;">설명:</span>
          <textarea id="exploDesc" style="min-height:60px; padding:8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${explo.description || ''}</textarea>
        </label>
        <label class="row" style="gap:8px; align-items:center;">
          <span style="width:120px; color:#9aa0a6;">배경 이미지:</span>
          <input id="exploBg" value="${explo.background || ''}" placeholder="assets/bg/exploration_001.png" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
        </label>
        
        <div class="card" style="margin-top:12px;">
          <div class="row" style="justify-content:space-between; align-items:center;">
            <strong>탐색 객체</strong>
            <button id="btnAddObject" class="btn">객체 추가</button>
          </div>
          <div id="objectsList" style="max-height:300px; overflow-y:auto; margin-top:8px;">
            ${renderObjectsList(explo.objects || [])}
          </div>
        </div>
        
        <div class="card" style="margin-top:12px;">
          <strong>탐색 종료 설정</strong>
          <label class="row" style="gap:8px; align-items:center; margin-top:8px;">
            <span style="width:120px; color:#9aa0a6;">종료 루트:</span>
            <input id="exploExitRoute" value="${explo.exitRoute || ''}" placeholder="R-100" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          </label>
          <label class="col" style="gap:4px; margin-top:8px;">
            <span style="color:#9aa0a6;">종료 메시지:</span>
            <textarea id="exploExitMsg" style="min-height:40px; padding:8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${explo.exitMessage || ''}</textarea>
          </label>
        </div>
      </div>
    `;
    
    // 객체 추가 버튼
    formEl.querySelector('#btnAddObject').onclick = () => {
      const objects = collectObjectsFromForm();
      objects.push({
        id: `obj_${objects.length + 1}`,
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        image: '',
        tooltip: '',
        event: { type: 'message', text: '' }
      });
      renderObjectsForm(objects);
      renderCanvas();
    };
    
    renderObjectsForm(explo.objects || []);
  }
  
  function renderObjectsList(objects) {
    return objects.map((obj, i) => `
      <div class="object-item" data-idx="${i}" style="border:1px solid #2b3450; border-radius:6px; padding:8px; margin-bottom:6px;">
        <div class="row" style="gap:6px; align-items:center;">
          <strong>${obj.id || `객체 ${i + 1}`}</strong>
          <span style="color:#9aa0a6; font-size:12px;">(${obj.x || 0}%, ${obj.y || 0}%)</span>
          <button class="btn danger obj-delete" data-idx="${i}" style="padding:2px 6px; font-size:12px;">삭제</button>
        </div>
      </div>
    `).join('');
  }
  
  function renderObjectsForm(objects) {
    const container = formEl.querySelector('#objectsList');
    container.innerHTML = objects.map((obj, i) => `
      <div class="object-form" data-idx="${i}" style="border:1px solid #2b3450; border-radius:6px; padding:8px; margin-bottom:8px;">
        <div class="row" style="gap:6px; margin-bottom:6px;">
          <input class="obj-id" placeholder="객체 ID" value="${obj.id || ''}" style="flex:1; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
          <button class="btn danger obj-delete" data-idx="${i}" style="padding:4px 8px; font-size:12px;">삭제</button>
        </div>
        <div class="row" style="gap:6px; margin-bottom:6px;">
          <input class="obj-x" placeholder="X%" value="${obj.x || 50}" style="flex:0 0 60px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
          <input class="obj-y" placeholder="Y%" value="${obj.y || 50}" style="flex:0 0 60px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
          <input class="obj-w" placeholder="너비" value="${obj.width || 100}" style="flex:0 0 60px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
          <input class="obj-h" placeholder="높이" value="${obj.height || 100}" style="flex:0 0 60px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
        </div>
        <input class="obj-image" placeholder="이미지 경로" value="${obj.image || ''}" style="width:100%; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;"/>
        <input class="obj-tooltip" placeholder="툴팁" value="${obj.tooltip || ''}" style="width:100%; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;"/>
        
        <div class="row" style="gap:6px; margin-bottom:6px;">
          <select class="obj-event-type" style="flex:0 0 120px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;">
            <option value="">이벤트 없음</option>
            <option value="message"${obj.event?.type === 'message' ? ' selected' : ''}>메시지</option>
            <option value="episode"${obj.event?.type === 'episode' ? ' selected' : ''}>에피소드</option>
            <option value="battle"${obj.event?.type === 'battle' ? ' selected' : ''}>전투</option>
            <option value="route"${obj.event?.type === 'route' ? ' selected' : ''}>루트</option>
          </select>
          <input class="obj-event-title" placeholder="이벤트 제목" value="${obj.event?.title || ''}" style="flex:1; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
        </div>
        <textarea class="obj-event-text" placeholder="이벤트 내용" style="width:100%; min-height:40px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;">${obj.event?.text || ''}</textarea>
        <input class="obj-event-id" placeholder="에피소드/전투 ID (예: EP-001, BT-100)" value="${obj.event?.episodeId || obj.event?.battleId || ''}" style="width:100%; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;"/>
        
        <div class="row" style="gap:6px; margin-bottom:6px;">
          <span style="color:#9aa0a6; font-size:12px; width:80px;">대체 이벤트:</span>
          <select class="obj-event-after-type" style="flex:0 0 120px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;">
            <option value="">없음</option>
            <option value="message"${obj.eventAfter?.type === 'message' ? ' selected' : ''}>메시지</option>
            <option value="episode"${obj.eventAfter?.type === 'episode' ? ' selected' : ''}>에피소드</option>
            <option value="battle"${obj.eventAfter?.type === 'battle' ? ' selected' : ''}>전투</option>
            <option value="route"${obj.eventAfter?.type === 'route' ? ' selected' : ''}>루트</option>
          </select>
          <input class="obj-event-after-title" placeholder="대체 이벤트 제목" value="${obj.eventAfter?.title || ''}" style="flex:1; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;"/>
        </div>
        <textarea class="obj-event-after-text" placeholder="대체 이벤트 내용" style="width:100%; min-height:40px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;">${obj.eventAfter?.text || ''}</textarea>
        <input class="obj-event-after-id" placeholder="에피소드/전투 ID (예: EP-001, BT-100)" value="${obj.eventAfter?.episodeId || obj.eventAfter?.battleId || ''}" style="width:100%; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;"/>
        
        <textarea class="obj-effects" placeholder="효과 (JSON 배열)" style="width:100%; min-height:40px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px; margin-bottom:6px;">${JSON.stringify(obj.effects || [], null, 2)}</textarea>
        <textarea class="obj-requirements" placeholder="요구조건 (JSON 배열)" style="width:100%; min-height:40px; padding:4px 6px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:4px;">${JSON.stringify(obj.requirements || [], null, 2)}</textarea>
      </div>
    `).join('');
    
    // 삭제 버튼 바인딩
    container.querySelectorAll('.obj-delete').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const objects = collectObjectsFromForm();
        objects.splice(idx, 1);
        renderObjectsForm(objects);
        renderCanvas();
      };
    });
    
    // 실시간 미리보기를 위한 입력 이벤트
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        setTimeout(renderCanvas, 100); // 디바운스
      });
    });
    
    // 이벤트 타입 변경 시 관련 필드 초기화
    container.querySelectorAll('.obj-event-type').forEach(select => {
      select.addEventListener('change', (e) => {
        const form = e.target.closest('.object-form');
        const eventIdInput = form.querySelector('.obj-event-id');
        const eventTitleInput = form.querySelector('.obj-event-title');
        const eventTextInput = form.querySelector('.obj-event-text');
        
        // 이벤트 타입에 따라 placeholder 변경
        const eventType = e.target.value;
        if (eventType === 'episode') {
          eventIdInput.placeholder = '에피소드 ID (예: EP-001)';
        } else if (eventType === 'battle') {
          eventIdInput.placeholder = '전투 ID (예: BT-100)';
        } else if (eventType === 'route') {
          eventIdInput.placeholder = '루트 ID (예: R-100)';
        } else {
          eventIdInput.placeholder = '에피소드/전투 ID (예: EP-001, BT-100)';
        }
        
        // 이벤트 타입이 없으면 관련 필드 초기화
        if (!eventType) {
          eventIdInput.value = '';
          eventTitleInput.value = '';
          eventTextInput.value = '';
        }
        
        setTimeout(renderCanvas, 100);
      });
    });
    
    // 대체 이벤트 타입 변경 시 관련 필드 초기화
    container.querySelectorAll('.obj-event-after-type').forEach(select => {
      select.addEventListener('change', (e) => {
        const form = e.target.closest('.object-form');
        const eventAfterIdInput = form.querySelector('.obj-event-after-id');
        const eventAfterTitleInput = form.querySelector('.obj-event-after-title');
        const eventAfterTextInput = form.querySelector('.obj-event-after-text');
        
        // 대체 이벤트 타입에 따라 placeholder 변경
        const eventAfterType = e.target.value;
        if (eventAfterType === 'episode') {
          eventAfterIdInput.placeholder = '에피소드 ID (예: EP-001)';
        } else if (eventAfterType === 'battle') {
          eventAfterIdInput.placeholder = '전투 ID (예: BT-100)';
        } else if (eventAfterType === 'route') {
          eventAfterIdInput.placeholder = '루트 ID (예: R-100)';
        } else {
          eventAfterIdInput.placeholder = '에피소드/전투 ID (예: EP-001, BT-100)';
        }
        
        // 대체 이벤트 타입이 없으면 관련 필드 초기화
        if (!eventAfterType) {
          eventAfterIdInput.value = '';
          eventAfterTitleInput.value = '';
          eventAfterTextInput.value = '';
        }
        
        setTimeout(renderCanvas, 100);
      });
    });
  }
  
  function collectObjectsFromForm() {
    const forms = Array.from(formEl.querySelectorAll('.object-form'));
    return forms.map(form => {
      const obj = {
        id: form.querySelector('.obj-id').value || '',
        x: Number(form.querySelector('.obj-x').value) || 50,
        y: Number(form.querySelector('.obj-y').value) || 50,
        width: Number(form.querySelector('.obj-w').value) || 100,
        height: Number(form.querySelector('.obj-h').value) || 100,
        image: form.querySelector('.obj-image').value || '',
        tooltip: form.querySelector('.obj-tooltip').value || ''
      };
      
      // 이벤트 정보 수집
      const eventType = form.querySelector('.obj-event-type').value;
      if (eventType) {
        obj.event = {
          type: eventType,
          title: form.querySelector('.obj-event-title').value || '',
          text: form.querySelector('.obj-event-text').value || ''
        };
        
        // 에피소드/전투 ID 추가
        const eventId = form.querySelector('.obj-event-id').value;
        if (eventId) {
          if (eventType === 'episode') {
            obj.event.episodeId = eventId;
          } else if (eventType === 'battle') {
            obj.event.battleId = eventId;
          }
        }
      }
      
      // 대체 이벤트 정보 수집
      const eventAfterType = form.querySelector('.obj-event-after-type').value;
      if (eventAfterType) {
        obj.eventAfter = {
          type: eventAfterType,
          title: form.querySelector('.obj-event-after-title').value || '',
          text: form.querySelector('.obj-event-after-text').value || ''
        };
        
        // 대체 이벤트 에피소드/전투 ID 추가
        const eventAfterId = form.querySelector('.obj-event-after-id').value;
        if (eventAfterId) {
          if (eventAfterType === 'episode') {
            obj.eventAfter.episodeId = eventAfterId;
          } else if (eventAfterType === 'battle') {
            obj.eventAfter.battleId = eventAfterId;
          }
        }
      }
      
      // 효과 수집
      const effectsText = form.querySelector('.obj-effects').value;
      if (effectsText) {
        try {
          obj.effects = JSON.parse(effectsText);
        } catch (e) {
          console.warn('[EXPLORATION-EDITOR] 효과 JSON 파싱 실패:', e);
          obj.effects = [];
        }
      }
      
      // 요구조건 수집
      const requirementsText = form.querySelector('.obj-requirements').value;
      if (requirementsText) {
        try {
          obj.requirements = JSON.parse(requirementsText);
        } catch (e) {
          console.warn('[EXPLORATION-EDITOR] 요구조건 JSON 파싱 실패:', e);
          obj.requirements = [];
        }
      }
      
      return obj;
    });
  }
  
  function renderCanvas() {
    if (!selectedId) return;
    
    const explo = explorations[selectedId] || {};
    const bgInput = formEl.querySelector('#exploBg');
    const background = bgInput ? bgInput.value : (explo.background || '');
    
    canvasEl.innerHTML = '';
    
    // 배경 설정 (실제 탐색 화면과 동일한 스타일)
    if (background) {
      canvasEl.style.backgroundImage = `url('${background}')`;
      canvasEl.style.backgroundSize = 'cover';
      canvasEl.style.backgroundPosition = 'center';
      canvasEl.style.backgroundRepeat = 'no-repeat';
    } else {
      canvasEl.style.backgroundImage = 'none';
      canvasEl.style.background = '#0b0f1a';
    }
    
    // 객체들 렌더링
    const objects = collectObjectsFromForm();
    objects.forEach((obj, i) => {
      const objEl = document.createElement('div');
      objEl.className = 'preview-object';
      objEl.style.cssText = `
        position: absolute;
        left: ${obj.x}%;
        top: ${obj.y}%;
        width: ${obj.width}px;
        height: ${obj.height}px;
        border: 2px solid transparent;
        border-radius: 8px;
        transition: all 0.2s ease;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #cbd5e1;
        font-size: 12px;
        cursor: pointer;
        pointer-events: auto;
        z-index: 15;
        background: rgba(255, 255, 255, 0.1);
      `;
      
      if (obj.image) {
        objEl.style.backgroundImage = `url('${obj.image}')`;
        objEl.style.backgroundSize = 'contain';
        objEl.style.backgroundRepeat = 'no-repeat';
        objEl.style.backgroundPosition = 'center';
        objEl.style.border = '2px solid #5cc8ff';
        objEl.style.background = 'rgba(92, 200, 255, 0.1)';
      } else {
        // 이미지가 없으면 기본 시각적 표시 (실제 탐색 화면과 동일)
        objEl.style.background = 'rgba(92, 200, 255, 0.2)';
        objEl.style.border = '2px dashed #5cc8ff';
      }
      
      objEl.textContent = obj.id || `객체 ${i + 1}`;
      objEl.title = obj.tooltip || obj.id;
      
      // 드래그 기능
      objEl.onmousedown = (e) => startDrag(e, i);
      
      // 호버 효과 (실제 탐색 화면과 동일)
      objEl.onmouseenter = () => {
        objEl.style.borderColor = '#5cc8ff';
        objEl.style.boxShadow = '0 0 12px rgba(92, 200, 255, 0.3)';
        objEl.style.transform = 'translate(-50%, -50%) scale(1.05)';
      };
      
      objEl.onmouseleave = () => {
        objEl.style.borderColor = obj.image ? '#5cc8ff' : 'transparent';
        objEl.style.boxShadow = 'none';
        objEl.style.transform = 'translate(-50%, -50%) scale(1)';
      };
      
      // 크기 조절 핸들 추가
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: -4px;
        right: -4px;
        width: 12px;
        height: 12px;
        background: #5cc8ff;
        border: 1px solid #fff;
        border-radius: 2px;
        cursor: se-resize;
        pointer-events: auto;
      `;
      resizeHandle.onmousedown = (e) => startResize(e, i);
      
      objEl.appendChild(resizeHandle);
      canvasEl.appendChild(objEl);
    });
  }
  
  function startDrag(e, objectIndex) {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    
    function onMouseMove(e) {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      // 폼 업데이트
      const forms = formEl.querySelectorAll('.object-form');
      if (forms[objectIndex]) {
        forms[objectIndex].querySelector('.obj-x').value = Math.round(Math.max(0, Math.min(100, x)));
        forms[objectIndex].querySelector('.obj-y').value = Math.round(Math.max(0, Math.min(100, y)));
      }
      
      renderCanvas();
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  function startResize(e, objectIndex) {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    
    const forms = formEl.querySelectorAll('.object-form');
    const form = forms[objectIndex];
    if (!form) return;
    
    const startWidth = Number(form.querySelector('.obj-w').value) || 100;
    const startHeight = Number(form.querySelector('.obj-h').value) || 100;
    
    function onMouseMove(e) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newWidth = Math.max(20, startWidth + deltaX);
      const newHeight = Math.max(20, startHeight + deltaY);
      
      form.querySelector('.obj-w').value = Math.round(newWidth);
      form.querySelector('.obj-h').value = Math.round(newHeight);
      
      renderCanvas();
    }
    
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  function collectExplorationFromForm() {
    if (!selectedId) return null;
    
    const id = formEl.querySelector('#exploId')?.value || selectedId;
    const title = formEl.querySelector('#exploTitle')?.value || '';
    const description = formEl.querySelector('#exploDesc')?.value || '';
    const background = formEl.querySelector('#exploBg')?.value || '';
    const exitRoute = formEl.querySelector('#exploExitRoute')?.value || '';
    const exitMessage = formEl.querySelector('#exploExitMsg')?.value || '';
    const objects = collectObjectsFromForm();
    
    return {
      id,
      title,
      description,
      background,
      objects,
      exitRoute,
      exitMessage
    };
  }
  
  // 버튼 이벤트
  wrap.querySelector('#btnNewExplo').onclick = () => {
    const newId = prompt('새 탐색 ID (예: EXPLO-001)');
    if (!newId) return;
    if (explorations[newId]) {
      alert('이미 존재하는 ID입니다.');
      return;
    }
    
    explorations[newId] = {
      id: newId,
      title: newId,
      description: '',
      background: '',
      objects: []
    };
    
    selectedId = newId;
    renderList();
    renderForm();
    renderCanvas();
  };
  
  wrap.querySelector('#btnDeleteExplo').onclick = () => {
    if (!selectedId) return;
    if (!confirm(`${selectedId}를 삭제하시겠습니까?`)) return;
    
    delete explorations[selectedId];
    selectedId = Object.keys(explorations)[0] || null;
    renderList();
    renderForm();
    renderCanvas();
  };
  
  wrap.querySelector('#btnSaveExplo').onclick = async () => {
    if (!selectedId) return;
    
    const exploData = collectExplorationFromForm();
    if (exploData) {
      explorations[exploData.id] = exploData;
      
      // 상태에 반영
      state.data = state.data || {};
      state.data.explorations = explorations;
      
      // 데이터 폴더가 지정되어 있으면 파일에 저장
      try{
        if(await ensureDataDir()){
          const ok = await writeToDataDir('explorations.js', stringifyExplorationsJS(explorations));
          if(ok){
            // 모듈 리로드 + 런타임 반영
            const mod = await import(`../data/explorations.js?ts=${Date.now()}`);
            state.data.explorations = mod.EXPLORATIONS;
            
            // localStorage에도 백업 저장
            localStorage.setItem('game_explorations', JSON.stringify(explorations));
            
            alert('explorations.js 파일에 저장되었습니다.');
            return;
          }
        }
      }catch(e){ 
        console.error('[EXPLORATION-EDITOR] 파일 저장 실패:', e); 
      }
      
      // 파일 저장 실패 시 localStorage에만 저장
      try {
        localStorage.setItem('game_explorations', JSON.stringify(explorations));
        console.log('[EXPLORATION-EDITOR] localStorage에 저장됨:', explorations);
        alert('탐색 데이터가 localStorage에 저장되었습니다.\\n\\n참고: "데이터 폴더 지정"을 먼저 실행하면 파일에 저장됩니다.');
      } catch (error) {
        console.error('[EXPLORATION-EDITOR] localStorage 저장 실패:', error);
        alert('저장 중 오류가 발생했습니다.');
      }
    }
  };
  
  wrap.querySelector('#btnPreviewExplo').onclick = async () => {
    if (!selectedId) return;
    
    const exploData = collectExplorationFromForm();
    if (exploData) {
      // 임시로 상태에 반영
      state.data = state.data || {};
      state.data.explorations = state.data.explorations || {};
      state.data.explorations[exploData.id] = exploData;
      
      // 탐색 화면으로 이동
      try {
        const { renderExplorationView } = await import('./exploration.js');
        await renderExplorationView(root, state, exploData.id);
      } catch (error) {
        console.error('[EXPLORATION-EDITOR] 미리보기 오류:', error);
        alert('미리보기를 실행할 수 없습니다.');
      }
    }
  };
  
  filterEl.oninput = () => renderList();
  
  // 데이터 폴더 지정 버튼
  wrap.querySelector('#btnPickDataDir').onclick = async () => {
    try{
      if(!window.showDirectoryPicker){ 
        alert('이 브라우저는 디렉터리 접근을 지원하지 않습니다.'); 
        return; 
      }
      const h = await window.showDirectoryPicker(); 
      dataDirHandle = h; 
      await idbSet('dataDirHandle', h); 
      alert('데이터 폴더 설정 완료\\n\\n이제 저장 버튼을 누르면 explorations.js 파일에 자동으로 저장됩니다.');
    }catch(e){ 
      if(e.name!=='AbortError') alert('폴더 지정 실패: '+e.message); 
    }
  };
  
  // 디버그 버튼
  wrap.querySelector('#btnDebugState').onclick = () => {
    console.log('=== EXPLORATION EDITOR DEBUG ===');
    console.log('Current state:', state);
    console.log('Current state.data:', state.data);
    console.log('Current state.data.explorations:', state.data?.explorations);
    console.log('Current explorations:', explorations);
    console.log('Selected ID:', selectedId);
    console.log('Current exploration data:', explorations[selectedId]);
    console.log('Data directory handle:', dataDirHandle);
    alert('디버그 정보가 콘솔에 출력되었습니다. F12를 눌러 확인하세요.');
  };
  
  // 초기화 버튼
  wrap.querySelector('#btnResetData').onclick = async () => {
    if (!confirm('저장된 탐색 데이터를 초기화하시겠습니까?\\n\\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    try {
      // localStorage 초기화
      localStorage.removeItem('game_explorations');
      
      // 기본 데이터로 리셋
      const { EXPLORATIONS } = await import('../data/explorations.js');
      explorations = { ...EXPLORATIONS };
      
      // state 업데이트
      state.data = state.data || {};
      state.data.explorations = explorations;
      
      selectedId = Object.keys(explorations)[0] || null;
      renderList();
      renderForm();
      renderCanvas();
      
      alert('탐색 데이터가 초기화되었습니다.');
    } catch (error) {
      console.error('[EXPLORATION-EDITOR] 초기화 실패:', error);
      alert('초기화 중 오류가 발생했습니다.');
    }
  };
  
  // 초기 렌더링
  renderList();
  renderForm();
  renderCanvas();
  
  root.innerHTML = '';
  root.appendChild(wrap);
}

// 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.renderExplorationEditorView = renderExplorationEditorView;
}

import { ROUTES as CURRENT } from '../data/routes.js';
import { EPISODES as EP_CURRENT } from '../data/episodes.js';
import { BATTLES as BT_CURRENT } from '../data/battles.js';
import { FLAGS as FLAG_REG } from '../data/flags.js';

export function renderRouteEditorView(root, state){
  const wrap = document.createElement('section');
  wrap.className='panel';
  // scoped styles for tabs (once)
  try{
    const styleId = 'routeEditorStyles';
    if(!document.getElementById(styleId)){
      const st = document.createElement('style'); st.id = styleId;
      st.textContent = `
        .tab-btn{ padding:6px 10px; border:1px solid #2b3450; background:#0f1524; color:#9aa0a6; border-radius:6px; }
        .tab-btn:hover{ border-color:#3b4566; color:#cbd5e1; }
        .tab-btn.active{ background:#1b2440; color:#e6f1ff; border-color:#5cc8ff; box-shadow:0 0 0 1px rgba(92,200,255,0.2) inset; }
        .tab-pane{ animation: fadeIn 0.12s ease-in; }
        @keyframes fadeIn{ from{ opacity:0; } to{ opacity:1; } }
      `;
      document.head.appendChild(st);
    }
  }catch{}
  wrap.innerHTML = `
    <h2>시나리오 루트 에디터</h2>
    <div class="row" style="gap:12px; align-items:flex-start;">
      <div class="panel" style="min-width:320px; max-width:380px;">
        <div class="row" style="gap:6px;">
          <input id="filter" placeholder="검색(ID/제목)" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <button id="btnNew" class="btn">신규 루트</button>
          <button id="btnDelete" class="btn danger">삭제</button>
        </div>
        <div id="list" style="margin-top:8px; max-height:720px; overflow:auto;"></div>
        <div class="card" style="margin-top:8px;">
          <div class="row" style="gap:6px; flex-wrap:wrap;">
            <button id="btnValidate" class="btn">검증</button>
            <button id="btnPreview" class="btn">그래프 미리보기</button>
            <button id="btnFlags" class="btn">플래그 관리</button>
          </div>
          <div id="valOut" style="margin-top:8px; color:#9aa0a6;"></div>
        </div>
      </div>
      <div class="panel" style="flex:1;">
        <div id="form"></div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button id="btnPickDataDir" class="btn">데이터 폴더 지정</button>
          <button id="btnSave" class="btn primary">저장(routes.js)</button>
          <button id="btnApplyRuntime" class="btn accent">런타임 적용</button>
          <button id="btnLoadRoutesJs" class="btn">routes.js 불러오기</button>
          <button id="btnWriteRoutesJs" class="btn">routes.js 파일에 쓰기</button>
          <button id="btnReloadRoutes" class="btn">routes.js 모듈 리로드</button>
          <button id="btnReloadEpisodes" class="btn">episodes.js 모듈 리로드</button>
          <button id="btnReloadBattles" class="btn">battles.js 모듈 리로드</button>
          <button id="btnWriteEpisodesJs" class="btn">episodes.js 파일에 쓰기</button>
          <button id="btnWriteBattlesJs" class="btn">battles.js 파일에 쓰기</button>
          <button id="btnWriteFlagsJs" class="btn">flags.js 파일에 쓰기</button>
          <button id="btnReloadFlags" class="btn">flags.js 모듈 리로드</button>
        </div>
        <div id="graph" class="panel" style="margin-top:12px; height:700px; overflow:hidden; position:relative;"></div>
      </div>
    </div>`;

  const listEl = wrap.querySelector('#list');
  const formEl = wrap.querySelector('#form');
  const filterEl = wrap.querySelector('#filter');
  let routes = JSON.parse(JSON.stringify(CURRENT||[]));
  let episodes = JSON.parse(JSON.stringify(EP_CURRENT||{}));
  let battles = JSON.parse(JSON.stringify(BT_CURRENT||{}));
  let flags = JSON.parse(JSON.stringify(FLAG_REG||{}));
  let selectedId = (routes[0]?.id)||null;
  let routesJsHandle = null;
  let dataDirHandle = null;

  // dir handle persistence
  async function idbOpen(){ return await new Promise((resolve,reject)=>{ const req=indexedDB.open('routeEditorDB',1); req.onupgradeneeded=()=>{ try{ req.result.createObjectStore('handles'); }catch{} }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
  async function idbGet(key){ try{ const db=await idbOpen(); return await new Promise((res,rej)=>{ const tx=db.transaction('handles'); const st=tx.objectStore('handles'); const r=st.get(key); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error); }); }catch{ return null; } }
  async function idbSet(key,val){ try{ const db=await idbOpen(); return await new Promise((res,rej)=>{ const tx=db.transaction('handles','readwrite'); const st=tx.objectStore('handles'); const r=st.put(val,key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }catch{} }
  (async ()=>{ try{ dataDirHandle = await idbGet('dataDirHandle'); }catch{} })();

  function inputRow(label, id, value=''){
    return `<label class="row" style="gap:8px; align-items:center;"><div style="width:120px; color:#9aa0a6;">${label}</div><input id="${id}" value="${value??''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/></label>`;
  }
  function areaRow(label, id, value=''){
    return `<label class="col" style="gap:6px;"><div style="color:#9aa0a6;">${label}</div><textarea id="${id}" style="min-height:84px; padding:8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${value??''}</textarea></label>`;
  }

  function renderList(){
    const q = (filterEl.value||'').toLowerCase();
    listEl.innerHTML = routes.filter(r=> !q || r.id.toLowerCase().includes(q) || (r.title||'').toLowerCase().includes(q)).map(r=>{
      const sel = r.id===selectedId ? ' style="border-color:#5cc8ff;"' : '';
      return `<div class="card" data-id="${r.id}"${sel}><strong>${r.title||r.id}</strong><div class="badge">${r.id}</div></div>`;
    }).join('');
    listEl.querySelectorAll('.card').forEach(el=> el.onclick=()=>{ selectedId=el.dataset.id; renderList(); renderForm(); });
  }

  function renderForm(){
    if(!selectedId){ formEl.innerHTML='<div style="color:#9aa0a6;">좌측에서 루트를 선택하거나 새로 만드세요.</div>'; return; }
    const r = routes.find(x=>x.id===selectedId) || { id:selectedId, title:selectedId, summary:'', requirements:[], next:'', branches:[] };
    const reqText = JSON.stringify(r.requirements||[], null, 2);
    const branches = Array.isArray(r.branches)? r.branches : [];
    const routeCoreHTML = [
      inputRow('ID','f_id', r.id||selectedId),
      inputRow('제목','f_title', r.title||''),
      inputRow('요약','f_summary', r.summary||''),
      inputRow('다음(next)','f_next', r.next||''),
      `<div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between; align-items:center;"><strong>요구조건(requirements)</strong><button id="btnReqAdd" class="btn">항목 추가</button></div>
        <div id="reqList"></div>
        <details style="margin-top:8px;"><summary style="color:#9aa0a6;">JSON 미리보기</summary><pre id="reqJson" style="white-space:pre-wrap; color:#9aa0a6;">${reqText}</pre></details>
      </div>`,
      `<div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between; align-items:center;"><strong>분기(branches)</strong><button id="btnBranchAdd" class="btn">추가</button></div>
        <div id="branchList">${branches.map((b,i)=> branchRow(b,i)).join('')}</div>
      </div>`
    ].join('');
    const subHTML = linkedEditorHTML(r.next||'');
    const hasSub = !!subHTML;
    const subLabel = (r.next||'').startsWith('EP-')? '에피소드' : ((r.next||'').startsWith('BT-')? '전투' : '연결');
    const tabsBar = `<div class="row" id="tabBar" style="gap:6px; border-bottom:1px solid #2b3450; padding-bottom:6px; margin-bottom:8px;">
        <button class="tab-btn active" data-tab="route">루트</button>
        ${hasSub? `<button class=\"tab-btn\" data-tab=\"sub\">${subLabel}</button>` : ''}
      </div>`;
    formEl.innerHTML = `${tabsBar}
      <div id="tab_route" class="tab-pane">${routeCoreHTML}</div>
      ${hasSub? `<div id="tab_sub" class="tab-pane" style="display:none;">${subHTML}</div>` : ''}`;
    // Tab behavior
    const activate=(name)=>{
      const rPane=formEl.querySelector('#tab_route'); const sPane=formEl.querySelector('#tab_sub');
      formEl.querySelectorAll('.tab-btn').forEach(b=> b.classList.remove('active'));
      const btn = formEl.querySelector(`.tab-btn[data-tab="${name}"]`); if(btn) btn.classList.add('active');
      if(rPane) rPane.style.display = (name==='route')? 'block':'none';
      if(sPane) sPane.style.display = (name==='sub')? 'block':'none';
    };
    formEl.querySelectorAll('.tab-btn').forEach(b=> b.onclick=()=> activate(b.dataset.tab));
    formEl.querySelector('#btnBranchAdd').onclick=()=>{ const cur = collectBranches(); cur.push({to:'', label:''}); renderBranchList(cur); };
    // 요구조건 렌더
    renderReqList((r.requirements&&Array.isArray(r.requirements))? r.requirements : []);
    formEl.querySelector('#btnReqAdd').onclick=()=>{ const cur = collectReqFromDOM(); cur.push({ type:'flag', key:'', value:true }); renderReqList(cur); };
    // EP/BT 인라인 버튼 바인딩
    if((r.next||'').startsWith('EP-')){
      const epId = r.next;
      const ep = episodes[epId] || { events: [] };
      
      // 모든 에피소드는 DSL 형식
      bindDslButtons();
      
      // 효과 저장소 초기화
      initializeEffectsStorage(ep.events || []);
    }
    // 전투의 승/패 EP 인라인 편집 버튼 바인딩
    bindBattleEpisodeButtons();
  }
  function branchRow(b, i){
    return `<div class="row" data-idx="${i}" style="gap:6px; margin-top:6px;">
      <input class="br_to" placeholder="to(R-***)" value="${b?.to||''}" style="flex:0 0 160px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <input class="br_label" placeholder="label" value="${b?.label||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <button class="btn danger br_del">삭제</button>
    </div>`;
  }
  function renderBranchList(list){
    const host = formEl.querySelector('#branchList');
    host.innerHTML = (list||[]).map((b,i)=> branchRow(b,i)).join('');
    host.querySelectorAll('.br_del').forEach((btn,i)=> btn.onclick=()=>{ const cur=collectBranches(); cur.splice(i,1); renderBranchList(cur); });
  }
  function collectBranches(){
    const rows = Array.from(formEl.querySelectorAll('#branchList .row'));
    return rows.map(row=>({ to: row.querySelector('.br_to').value.trim(), label: row.querySelector('.br_label').value.trim() })).filter(b=> b.to);
  }
  function reqItemRowHTML(item, idx, level){
    const t = (item && item.anyOf) ? 'anyOf' : (item?.type||'flag');
    const key = item?.key||''; const val = (item?.value===true||item?.value===false)? String(item.value) : (item?.value!=null? String(item.value): 'true');
    const pad = Math.max(0, (level||0)*12);
    return `<div class="req-item" data-idx="${idx}" data-level="${level||0}" style="margin-top:6px; padding-left:${pad}px;">
      <div class="row" style="gap:6px; align-items:center;">
        <select class="req_type" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
          <option value="flag"${t==='flag'?' selected':''}>flag</option>
          <option value="anyOf"${t==='anyOf'?' selected':''}>anyOf(OR)</option>
        </select>
        <div class="req_flag" style="display:${t==='flag'?'flex':'none'}; gap:6px; flex:1;">
          ${flagKeySelectHTML(key)}
          <select class="req_val" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
            <option value="true"${val==='true'?' selected':''}>true</option>
            <option value="false"${val==='false'?' selected':''}>false</option>
            <option value="text"${(val!=='true'&&val!=='false')?' selected':''}>text…</option>
          </select>
          <input class="req_val_text" value="${(val!=='true'&&val!=='false')? val:''}" placeholder="텍스트 값" style="flex:0 0 160px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px; display:${(val!=='true'&&val!=='false')?'block':'none'};"/>
        </div>
        <div class="req_anyOf" style="display:${t==='anyOf'?'block':'none'}; flex:1;">
          <div class="req-children"></div>
          <div class="row" style="justify-content:flex-end; margin-top:6px;"><button class="btn btnChildAdd">하위 추가</button></div>
        </div>
        <button class="btn danger req_del">삭제</button>
      </div>
    </div>`;
  }
  function renderReqList(arr){
    const host = formEl.querySelector('#reqList');
    host.innerHTML = (arr||[]).map((it,i)=> reqItemRowHTML(it,i,0)).join('');
    // render children for anyOf
    (arr||[]).forEach((it,i)=>{
      if(it && it.anyOf && Array.isArray(it.anyOf)){
        const p = host.querySelector(`.req-item[data-idx="${i}"] .req-children`);
        if(p){ p.innerHTML = it.anyOf.map((c,j)=> reqItemRowHTML(c,j,1)).join(''); }
      }
    });
    // wire events
    host.querySelectorAll('.req_del').forEach((btn)=>{ btn.onclick=()=>{ const idx=Number(btn.closest('.req-item').dataset.idx||'0'); const cur=collectReqFromDOM(); cur.splice(idx,1); renderReqList(cur); updateReqJson(); }; });
    host.querySelectorAll('.btnChildAdd').forEach((btn)=>{ btn.onclick=()=>{ const parent = btn.closest('.req-item'); const idx = Number(parent.dataset.idx||'0'); const cur=collectReqFromDOM(); const parentItem = cur[idx]; if(!parentItem.anyOf) parentItem.anyOf=[]; parentItem.anyOf.push({ type:'flag', key:'', value:true }); renderReqList(cur); updateReqJson(); }; });
    host.querySelectorAll('.req_type').forEach(sel=>{ sel.onchange=()=>{ const row=sel.closest('.req-item'); const type=sel.value; row.querySelector('.req_flag').style.display = (type==='flag')?'flex':'none'; row.querySelector('.req_anyOf').style.display = (type==='anyOf')?'block':'none'; updateReqJson(); }; });
    // 플래그 키 선택 셀렉터가 'custom'이면 텍스트 입력 노출
    host.querySelectorAll('.req_key_sel').forEach(sel=>{ sel.onchange=()=>{ const row=sel.closest('.req-item'); const isCustom = sel.value==='__custom__'; const inp=row.querySelector('.req_key'); if(inp) inp.style.display = isCustom? 'block':'none'; updateReqJson(); }; });
    host.querySelectorAll('.req_val').forEach(sel=>{ sel.onchange=()=>{ const row=sel.closest('.req-item'); const showText = sel.value==='text'; const text=row.querySelector('.req_val_text'); if(text) text.style.display = showText? 'block':'none'; updateReqJson(); }; });
    // live json preview
    host.querySelectorAll('input,select').forEach(el=> el.addEventListener('input', updateReqJson));
    updateReqJson();
  }
  function flagKeySelectHTML(current){
    const keys = Object.keys(FLAG_REG||{});
    const opts = keys.map(k=>`<option value="${k}">${k}</option>`).join('');
    const isCustom = current && !keys.includes(current);
    return `<select class="req_key_sel" style="flex:0 0 260px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
      <option value="">(선택)</option>
      ${opts}
      <option value="__custom__"${isCustom?' selected':''}>직접 입력…</option>
    </select>
    <input class="req_key" placeholder="flag key (예: bt.BT-200.win)" value="${isCustom? current : ''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px; display:${isCustom?'block':'none'};"/>`;
  }
  function collectReqFromDOM(){
    const host = formEl.querySelector('#reqList');
    if(!host) return [];
    const rows = Array.from(host.querySelectorAll(':scope > .req-item'));
    const readRow=(row)=>{
      const type = row.querySelector('.req_type')?.value||'flag';
      if(type==='anyOf'){
        const kids = Array.from(row.querySelectorAll(':scope .req-children > .req-item')).map(readRow);
        return { anyOf: kids };
      } else {
        const keySel = row.querySelector('.req_key_sel');
        const keyInp = row.querySelector('.req_key');
        const key = (keySel && keySel.value)? keySel.value : (keyInp?.value?.trim()||'');
        const sel = row.querySelector('.req_val')?.value||'true';
        let value = true; if(sel==='false') value=false; if(sel==='text'){ const t=row.querySelector('.req_val_text')?.value||''; value = t; }
        return { type:'flag', key, value };
      }
    };
    return rows.map(readRow).filter(Boolean);
  }
  function updateReqJson(){
    try{ const arr = collectReqFromDOM(); const pre = formEl.querySelector('#reqJson'); if(pre) pre.textContent = JSON.stringify(arr, null, 2); }catch{}
  }

  function bindEpRowDeletes(){
    formEl.querySelectorAll('.ep_line_del').forEach(btn=>{ btn.onclick=()=>{ const row=btn.closest('.row'); row?.remove(); renumberScene(); }; });
    // Drag & drop reorder for scene lines
    const host=formEl.querySelector('#epScene'); if(host){
      let dragging=null;
      host.querySelectorAll('.ep_line').forEach(line=>{
        line.addEventListener('dragstart', (e)=>{ dragging=line; line.style.opacity='0.5'; });
        line.addEventListener('dragend', ()=>{ if(dragging){ dragging.style.opacity=''; dragging=null; renumberScene(); }});
        line.addEventListener('dragover', (e)=>{ e.preventDefault(); if(!dragging||dragging===line) return; const rect=line.getBoundingClientRect(); const before = (e.clientY - rect.top) < rect.height/2; host.insertBefore(dragging, before? line : line.nextSibling); });
      });
    }
  }
  function renumberScene(){ const rows=Array.from(formEl.querySelectorAll('#epScene .ep_line')); rows.forEach((row,i)=> row.dataset.idx=String(i)); }
  function bindChoiceRowDeletes(){
    formEl.querySelectorAll('.ep_ch_del').forEach(btn=>{ btn.onclick=()=>{ const row=btn.closest('.row'); row?.remove(); }; });
  }

  function attachChoiceTemplateHandlers(){
    const choiceRows = Array.from(formEl.querySelectorAll('#epChoices .row, #epWinChoices .row, #epLoseChoices .row'));
    const units = buildUnitOptions();
    choiceRows.forEach(row=>{
      const btnParty = row.querySelector('button[data-tpl="party.add"]');
      const btnFlag = row.querySelector('button[data-tpl="flag.set"]');
      const effectsTA = row.querySelector('.ep_effects');
      if(btnParty){
        btnParty.onclick=()=>{
          let panel = row.querySelector('.tpl-panel');
          if(panel){ panel.remove(); return; }
          panel = document.createElement('div');
          panel.className='tpl-panel';
          panel.style.marginTop='6px';
          panel.innerHTML = `<div class="row" style="gap:6px; align-items:center;">
            <select class="tpl_unit" style="flex:0 0 260px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
              ${units.map(u=>`<option value="${u.id}">${u.id} - ${u.name}</option>`).join('')}
            </select>
            <button class="btn tpl_ok">추가</button>
          </div>`;
          row.appendChild(panel);
          panel.querySelector('.tpl_ok').onclick=()=>{
            try{
              const unit = panel.querySelector('.tpl_unit').value;
              let arr=[]; try{ arr = JSON.parse(effectsTA.value||'[]'); if(!Array.isArray(arr)) arr=[]; }catch{}
              arr.push({ type:'party.add', unit });
              effectsTA.value = JSON.stringify(arr, null, 2);
              panel.remove();
            }catch{}
          };
        };
      }
      if(btnFlag){
        btnFlag.onclick=()=>{
          let panel = row.querySelector('.tpl-panel');
          if(panel){ panel.remove(); return; }
          const keys = Object.keys(flags||FLAG_REG||{});
          panel = document.createElement('div'); panel.className='tpl-panel'; panel.style.marginTop='6px';
          panel.innerHTML = `<div class="row" style="gap:6px; align-items:center;">
            <select class="tpl_flag_key" style="flex:0 0 260px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
              ${keys.map(k=>`<option value="${k}">${k}</option>`).join('')}
              <option value="__custom__">직접 입력…</option>
            </select>
            <input class="tpl_flag_key_inp" placeholder="flag key" style="display:none; flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
            <select class="tpl_flag_val" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
              <option value="true">true</option>
              <option value="false">false</option>
              <option value="text">text…</option>
            </select>
            <input class="tpl_flag_val_inp" placeholder="text value" style="display:none; flex:0 0 160px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
            <button class="btn tpl_ok">추가</button>
          </div>`;
          row.appendChild(panel);
          const keySel = panel.querySelector('.tpl_flag_key'); const keyInp = panel.querySelector('.tpl_flag_key_inp');
          const valSel = panel.querySelector('.tpl_flag_val'); const valInp = panel.querySelector('.tpl_flag_val_inp');
          keySel.onchange=()=>{ keyInp.style.display = keySel.value==='__custom__' ? 'block':'none'; };
          valSel.onchange=()=>{ valInp.style.display = valSel.value==='text' ? 'block':'none'; };
          panel.querySelector('.tpl_ok').onclick=()=>{
            try{
              const key = keySel.value==='__custom__' ? (keyInp.value||'') : keySel.value;
              let value = true; if(valSel.value==='false') value=false; if(valSel.value==='text') value = valInp.value||'';
              let arr=[]; try{ arr = JSON.parse(effectsTA.value||'[]'); if(!Array.isArray(arr)) arr=[]; }catch{}
              arr.push({ type:'flag.set', key, value });
              effectsTA.value = JSON.stringify(arr, null, 2);
              panel.remove();
            }catch{}
          };
        };
      }
    });
  }
  function collectRouteFromForm(){
    const id = formEl.querySelector('#f_id').value.trim();
    const title = formEl.querySelector('#f_title').value.trim();
    const summary = formEl.querySelector('#f_summary').value.trim();
    const next = formEl.querySelector('#f_next').value.trim();
    let requirements = collectReqFromDOM();
    const branches = collectBranches();
    // 인라인 EP/BT 편집 반영
    if(next.startsWith('EP-')){
      const ep = readInlineEpisode(next); if(ep){ episodes[next] = ep; }
    } else if(next.startsWith('BT-')){
      const bt = readInlineBattle(next); if(bt){ battles[next] = { ...(battles[next]||{}), id: next, ...bt }; }
    }
    return { id, title, summary, requirements, next, branches };
  }

  // ===== 연결 리소스(EP/BT/END) 인라인 에디터 =====
  function linkedEditorHTML(next){
    if(!next) return '';
    if(next.startsWith('EP-')){
      const ep = episodes[next] || { scene:[{speaker:'', text:''}], choices:[{label:'', effects:[], next:''}] };
      const isDSL = Array.isArray(ep.events);
      
      // 모든 에피소드는 이제 DSL 형식
      return `<div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <strong>에피소드 편집: ${next}</strong>
          <div class="row" style="gap:6px;">
            <button class="btn" id="btnDslAddBg">배경</button>
            <button class="btn" id="btnDslAddShow">캐릭터 표시</button>
            <button class="btn" id="btnDslAddSay">대사</button>
            <button class="btn" id="btnDslAddChoice">선택지</button>
            <button class="btn" id="btnDslAddPopup">팝업</button>
            <button class="btn" id="btnDslAddMove">이동</button>
          </div>
        </div>
        <div id="dslEvents" style="max-height:400px; overflow-y:auto; border:1px solid #2b3450; border-radius:6px; padding:8px; margin-top:8px;">${(ep.events||[]).map((ev,i)=> dslEventRow(ev,i)).join('')}</div>
      </div>`;
    }
    if(next.startsWith('BT-')){
      const bt = battles[next] || { id: next, enemy:[], seed: Date.now() & 0xFFFFFFFF };
      const winNext = bt.winNext||''; const loseNext = bt.loseNext||'';
      // 3x3 보드 준비(행1=전열, 행2=중열, 행3=후열)
      const grid = [[null,null,null],[null,null,null],[null,null,null]];
      (bt.enemy||[]).forEach(item=>{
        if(!item) return;
        if(typeof item === 'string'){ // 기본: 전열 0부터 채운다고 가정하지 말고 grid 첫 빈 칸에 배치
          for(let r=0;r<3;r++){ let placed=false; for(let c=0;c<3;c++){ if(!grid[r][c]){ grid[r][c] = { unit:item }; placed=true; break; } } if(placed) break; }
        } else if(typeof item==='object'){ const r=Math.max(1,Math.min(3,item.row||1)); const rr = r - 1; const c=Math.max(0,Math.min(2,item.col||0)); grid[rr][c] = { unit:item.unit, row:item.row, col:item.col }; }
      });
      const unitOpts = buildUnitOptions();
      const board = grid.map((row,r)=>`<div class="row" style="gap:6px;">${row.map((cell,c)=> btCellHTML(cell,r,c,unitOpts)).join('')}</div>`).join('');
      // 승리/패배 EP 미리보기 블록(있을 경우 편집 가능)
      const winEpId = (winNext||'').startsWith('EP-') ? winNext : '';
      const loseEpId = (loseNext||'').startsWith('EP-') ? loseNext : '';
      const winEp = winEpId ? (episodes[winEpId] || { scene:[{speaker:'', text:''}], choices:[{label:'', effects:[], next:''}] }) : null;
      const loseEp = loseEpId ? (episodes[loseEpId] || { scene:[{speaker:'', text:''}], choices:[{label:'', effects:[], next:''}] }) : null;
      
      // DSL 형식 지원
      const isWinDSL = winEp && Array.isArray(winEp.events);
      const isLoseDSL = loseEp && Array.isArray(loseEp.events);
      const epBlock=(prefix, title, epId, ep, isDSL)=>{
        if(!epId) return '';
        
        if(isDSL){
          const eventsHtml = (ep.events||[]).map((ev,i)=> dslEventRow(ev,i)).join('');
          return `<div class="card" style="margin-top:8px;">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <strong>${title} (DSL): ${epId}</strong>
              <div class="row" style="gap:6px;">
                <button class="btn" id="btnEp${prefix}DslAddBg">배경</button>
                <button class="btn" id="btnEp${prefix}DslAddSay">대사</button>
                <button class="btn" id="btnEp${prefix}DslAddChoice">선택지</button>
              </div>
            </div>
            <div id="ep${prefix}DslEvents" style="max-height:300px; overflow-y:auto; border:1px solid #2b3450; border-radius:6px; padding:8px; margin-top:8px;">${eventsHtml}</div>
          </div>`;
        } else {
          const sceneHtml = (ep.scene||[]).map((ln,i)=> epLineRow(ln,i)).join('');
          const choiceHtml = (ep.choices||[]).map((c,i)=> epChoiceRow(c,i)).join('');
          return `<div class="card" style="margin-top:8px;">
            <div class="row" style="justify-content:space-between; align-items:center;"><strong>${title}: ${epId}</strong><div class="row" style="gap:6px;"><button class="btn" id="btnEp${prefix}AddLine">행 추가</button><button class="btn" id="btnEp${prefix}AddChoice">선택 추가</button><button class="btn" id="btnEp${prefix}AddParty">동료 추가</button></div></div>
            <div id="ep${prefix}Scene" style="max-height:250px; overflow-y:auto; border:1px solid #2b3450; border-radius:6px; padding:8px; margin-top:8px;">${sceneHtml}</div>
            <div style="margin-top:8px;"><strong>선택지</strong></div>
            <div id="ep${prefix}Choices" style="max-height:150px; overflow-y:auto; border:1px solid #2b3450; border-radius:6px; padding:8px; margin-top:4px;">${choiceHtml}</div>
          </div>`;
        }
      };
      return `<div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between; align-items:center;"><strong>전투 편집: ${next}</strong></div>
        ${inputRow('Seed','bt_seed', bt.seed||0)}
        ${inputRow('승리(next)','bt_win', winNext)}
        ${inputRow('패배(next)','bt_lose', loseNext)}
        <div style="margin-top:8px;"><strong>3x3 배치</strong></div>
        <div id="btBoard" class="col" style="gap:6px;">${board}</div>
        ${epBlock('Win', '승리 에피소드 편집', winEpId, winEp, isWinDSL)}
        ${epBlock('Lose', '패배 에피소드 편집', loseEpId, loseEp, isLoseDSL)}
      </div>`;
    }
    return `<div class="card" style="margin-top:8px;"><strong>엔딩/특수: ${next}</strong><div style="color:#9aa0a6; margin-top:4px;">특별한 편집 요소는 없습니다.</div></div>`;
  }
  function epLineRow(line, i){
    return `<div class="row ep_line" draggable="true" data-idx="${i}" style="gap:6px; margin-top:6px;">
      <span class="drag-handle" style="cursor:grab; color:#9aa0a6;">↕</span>
      <input class="ep_speaker" placeholder="speaker" value="${line?.speaker||''}" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <input class="ep_text" placeholder="text" value="${line?.text||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <button class="btn danger ep_line_del">삭제</button>
    </div>`;
  }
  function epChoiceRow(ch, i){
    const eff = JSON.stringify(ch?.effects||[], null, 0);
    return `<div class="row" data-idx="${i}" style="gap:6px; margin-top:6px; align-items:flex-start;">
      <input class="ep_label" placeholder="label" value="${ch?.label||''}" style="flex:0 0 200px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <input class="ep_next" placeholder="next(EP-/BT-/R-/END-)" value="${ch?.next||''}" style="flex:0 0 200px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <textarea class="ep_effects" placeholder='effects(JSON 배열)' style="flex:1; min-height:60px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${eff}</textarea>
      <button class="btn" data-tpl="party.add">동료 추가</button>
      <button class="btn" data-tpl="flag.set">플래그</button>
      <button class="btn danger ep_ch_del">삭제</button>
    </div>`;
  }
  function enemyRow(e, i){
    const isObj = typeof e==='object'; const unit = isObj? (e.unit||'') : (e||'');
    const row = isObj? (e.row??'') : '';
    const col = isObj? (e.col??'') : '';
    return `<div class="row" data-idx="${i}" style="gap:6px; margin-top:6px;">
      <input class="bt_unit" placeholder="unit id" value="${unit}" style="flex:0 0 160px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <input class="bt_row" placeholder="row(1~3)" value="${row}" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <input class="bt_col" placeholder="col(0~2)" value="${col}" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
      <button class="btn danger bt_enemy_del">삭제</button>
    </div>`;
  }
  function buildUnitOptions(){
    const units = (state?.data?.units) || (window.appState?.data?.units) || {};
    const opts = Object.keys(units).map(id=>({ id, name: units[id]?.name||id }));
    return opts.sort((a,b)=> a.id.localeCompare(b.id));
  }
  function btCellHTML(cell, r, c, unitOpts){
    const sel = `<select class="bt_cell" data-r="${r}" data-c="${c}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
      <option value="">(비움)</option>
      ${unitOpts.map(o=>`<option value="${o.id}"${cell&&cell.unit===o.id?' selected':''}>${o.id} - ${o.name}</option>`).join('')}
    </select>`;
    return `<div class="card" style="flex:1; min-width:0; padding:8px;">${sel}</div>`;
  }
  function readInlineEpisode(epId){
    const host = formEl; if(!host) return null; if(!epId || !epId.startsWith('EP-')) return null;
    
    // DSL 형식인지 확인
    const dslHost = host.querySelector('#dslEvents');
    if(dslHost){
      // DSL 형식에서 events 수집
      const eventRows = Array.from(dslHost.querySelectorAll('.dsl-event'));
      const events = eventRows.map(row => {
        const cmd = row.querySelector('.dsl_cmd')?.value || '';
        const eventData = { cmd };
        
        // 각 명령어별 데이터 수집
        switch(cmd){
          case 'bg':
            eventData.name = row.querySelector('.dsl_bg_name')?.value || '';
            eventData.dur = Number(row.querySelector('.dsl_bg_dur')?.value || 500);
            break;
          case 'show':
            eventData.id = row.querySelector('.dsl_show_id')?.value || '';
            eventData.side = row.querySelector('.dsl_show_side')?.value || 'center';
            eventData.dur = Number(row.querySelector('.dsl_show_dur')?.value || 250);
            const offsetX = row.querySelector('.dsl_show_offset_x')?.value;
            const offsetY = row.querySelector('.dsl_show_offset_y')?.value;
            if(offsetX || offsetY){
              eventData.offset = { x: Number(offsetX || 0), y: Number(offsetY || 0) };
            }
            break;
          case 'say':
            eventData.speaker = row.querySelector('.dsl_say_speaker')?.value || '';
            eventData.text = row.querySelector('.dsl_say_text')?.value || '';
            break;
          case 'choice':
            const choiceContainer = row.querySelector('.choice-container');
            if(choiceContainer) {
              eventData.items = collectChoiceData(choiceContainer);
            } else {
              eventData.items = [];
            }
            break;
          case 'popup':
            eventData.name = row.querySelector('.dsl_popup_name')?.value || '';
            eventData.dur = Number(row.querySelector('.dsl_popup_dur')?.value || 300);
            const width = row.querySelector('.dsl_popup_width')?.value;
            const height = row.querySelector('.dsl_popup_height')?.value;
            if(width || height){
              eventData.size = { width: width || '80%', height: height || '80%' };
            }
            break;
          case 'hidePopup':
            eventData.dur = Number(row.querySelector('.dsl_hide_popup_dur')?.value || 300);
            break;
          case 'move':
            eventData.id = row.querySelector('.dsl_move_id')?.value || '';
            eventData.side = row.querySelector('.dsl_move_side')?.value || 'center';
            eventData.dur = Number(row.querySelector('.dsl_move_dur')?.value || 250);
            const moveOffsetX = row.querySelector('.dsl_move_offset_x')?.value;
            const moveOffsetY = row.querySelector('.dsl_move_offset_y')?.value;
            if(moveOffsetX || moveOffsetY){
              eventData.offset = { x: Number(moveOffsetX || 0), y: Number(moveOffsetY || 0) };
            }
            break;
        }
        
        return eventData;
      }).filter(ev => ev.cmd); // 빈 명령어 제외
      
      return { events };
    } else {
      // 레거시 형식에서 scene/choices 수집
      const sceneRows = Array.from(host.querySelectorAll('#epScene .row'));
      const scene = sceneRows.map(r=>({ speaker: r.querySelector('.ep_speaker')?.value||'', text: r.querySelector('.ep_text')?.value||'' }));
      const choiceRows = Array.from(host.querySelectorAll('#epChoices .row'));
      const choices = choiceRows.map(r=>{ let effects=[]; const raw=r.querySelector('.ep_effects')?.value||'[]'; try{ const v=JSON.parse(raw); if(Array.isArray(v)) effects=v; }catch{} return { label: r.querySelector('.ep_label')?.value||'', next: r.querySelector('.ep_next')?.value||'', effects }; });
      return { scene, choices };
    }
  }
  function readInlineBattle(btId){
    const host = formEl; if(!host) return null; if(!btId || !btId.startsWith('BT-')) return null;
    const seed = Number(host.querySelector('#bt_seed')?.value||'0');
    const winNext = host.querySelector('#bt_win')?.value||''; const loseNext = host.querySelector('#bt_lose')?.value||'';
    // 3x3 보드에서 수집
    const cells = Array.from(host.querySelectorAll('#btBoard .bt_cell'));
    const grid = [[null,null,null],[null,null,null],[null,null,null]];
    cells.forEach(sel=>{ const r=Number(sel.dataset.r||'0'); const c=Number(sel.dataset.c||'0'); const v=sel.value||''; const row = r + 1; grid[r][c] = v? { unit:v, row, col:c } : null; });
    const enemy=[]; for(let r=0;r<3;r++){ for(let c=0;c<3;c++){ const it=grid[r][c]; if(it) enemy.push(it); } }
    // 승/패가 EP로 이어지면 인라인 EP 폼에서 즉시 수집하여 반영
    if((winNext||'').startsWith('EP-')){ const winEp = readInlineEpisodeForPrefix('Win'); if(winEp){ episodes[winNext] = winEp; } }
    if((loseNext||'').startsWith('EP-')){ const loseEp = readInlineEpisodeForPrefix('Lose'); if(loseEp){ episodes[loseNext] = loseEp; } }
    return { seed, winNext, loseNext, enemy };
  }

  // 보조: 전투 내 승/패 EP 인라인 수집
  function readInlineEpisodeForPrefix(prefix){
    try{
      // DSL 형식 확인
      const dslHost = formEl.querySelector(`#ep${prefix}DslEvents`);
      if(dslHost){
        // DSL 형식에서 events 수집
        const eventRows = Array.from(dslHost.querySelectorAll('.dsl-event'));
        const events = eventRows.map(row => {
          const cmd = row.querySelector('.dsl_cmd')?.value || '';
          const eventData = { cmd };
          
          // 각 명령어별 데이터 수집
          switch(cmd){
            case 'bg':
              eventData.name = row.querySelector('.dsl_bg_name')?.value || '';
              eventData.dur = Number(row.querySelector('.dsl_bg_dur')?.value || 500);
              break;
            case 'show':
              eventData.id = row.querySelector('.dsl_show_id')?.value || '';
              eventData.side = row.querySelector('.dsl_show_side')?.value || 'center';
              eventData.dur = Number(row.querySelector('.dsl_show_dur')?.value || 250);
              const offsetX = row.querySelector('.dsl_show_offset_x')?.value;
              const offsetY = row.querySelector('.dsl_show_offset_y')?.value;
              if(offsetX || offsetY){
                eventData.offset = { x: Number(offsetX || 0), y: Number(offsetY || 0) };
              }
              break;
            case 'say':
              eventData.speaker = row.querySelector('.dsl_say_speaker')?.value || '';
              eventData.text = row.querySelector('.dsl_say_text')?.value || '';
              break;
            case 'choice':
              const choiceText = row.querySelector('.dsl_choice_items')?.value || '[]';
              try{ eventData.items = JSON.parse(choiceText); }catch{ eventData.items = []; }
              break;
            case 'popup':
              eventData.name = row.querySelector('.dsl_popup_name')?.value || '';
              eventData.dur = Number(row.querySelector('.dsl_popup_dur')?.value || 300);
              const width = row.querySelector('.dsl_popup_width')?.value;
              const height = row.querySelector('.dsl_popup_height')?.value;
              if(width || height){
                eventData.size = { width: width || '80%', height: height || '80%' };
              }
              break;
            case 'hidePopup':
              eventData.dur = Number(row.querySelector('.dsl_hide_popup_dur')?.value || 300);
              break;
            case 'move':
              eventData.id = row.querySelector('.dsl_move_id')?.value || '';
              eventData.side = row.querySelector('.dsl_move_side')?.value || 'center';
              eventData.dur = Number(row.querySelector('.dsl_move_dur')?.value || 250);
              const moveOffsetX = row.querySelector('.dsl_move_offset_x')?.value;
              const moveOffsetY = row.querySelector('.dsl_move_offset_y')?.value;
              if(moveOffsetX || moveOffsetY){
                eventData.offset = { x: Number(moveOffsetX || 0), y: Number(moveOffsetY || 0) };
              }
              break;
          }
          
          return eventData;
        }).filter(ev => ev.cmd); // 빈 명령어 제외
        
        return { events };
      } else {
        // 레거시 형식에서 scene/choices 수집
        const sceneRows = Array.from(formEl.querySelectorAll(`#ep${prefix}Scene .row`));
        const scene = sceneRows.map(r=>({ speaker: r.querySelector('.ep_speaker')?.value||'', text: r.querySelector('.ep_text')?.value||'' }));
        const choiceRows = Array.from(formEl.querySelectorAll(`#ep${prefix}Choices .row`));
        const choices = choiceRows.map(r=>{ let effects=[]; const raw=r.querySelector('.ep_effects')?.value||'[]'; try{ const v=JSON.parse(raw); if(Array.isArray(v)) effects=v; }catch{} return { label: r.querySelector('.ep_label')?.value||'', next: r.querySelector('.ep_next')?.value||'', effects }; });
        return { scene, choices };
      }
    }catch{ return null; }
  }

  function buildGraph(rs){
    const nodes = rs.map(r=>({ id:r.id, title:r.title, next:r.next, branches:r.branches||[] }));
    const edges = [];
    const order = Object.fromEntries(rs.map((r,i)=>[r.id,i]));
    nodes.forEach(r=>{ (r.branches||[]).forEach(b=>{ if(b.to?.startsWith('R-')) edges.push({ from:r.id, to:b.to }); }); });
    nodes.forEach(r=>{ if((r.next||'').startsWith('R-')) edges.push({ from:r.id, to:r.next }); });
    // EP 선택지 기반 간선: 편집 폼 데이터(episodes)에서 to가 뒤 칼럼(정의 순서상 이후)인 것만 표시
    nodes.forEach(r=>{
      if((r.next||'').startsWith('EP-')){
        try{
          const ep = (episodes||{})[r.next]; const choices = ep?.choices||[];
          choices.forEach(c=>{ const to=c?.next||''; if(to.startsWith('R-') && (order[to] > (order[r.id]??-1))) edges.push({ from:r.id, to }); });
        }catch{}
      }
    });
    return { nodes, edges };
  }
  function layout(graph){
    const xGap=260, yGap=120; const start=graph.nodes[0]?.id;
    const outs = graph.edges.reduce((m,e)=>{ (m[e.from] ||= []).push(e.to); return m; },{});
    Object.keys(outs).forEach(k=> outs[k]=Array.from(new Set(outs[k])));
    // 깊이(BFS)
    const depth=new Map(graph.nodes.map(n=>[n.id, Number.NEGATIVE_INFINITY])); depth.set(start,0);
    const q=[start]; while(q.length){ const u=q.shift(); const du=depth.get(u); for(const v of (outs[u]||[])){ const cand=du+1; if(cand>(depth.get(v)??-1)){ depth.set(v,cand); q.push(v); } } }
    graph.nodes.forEach(n=>{ if(!Number.isFinite(depth.get(n.id))) depth.set(n.id,0); });
    const xOf=new Map(graph.nodes.map(n=>[n.id, 140 + (depth.get(n.id)||0)*xGap]));
    // 메인 라인(진행 우선)
    const edgeFrom = graph.edges.reduce((m,e)=>{ (m[e.from] ||= []).push(e); return m; },{});
    const main=[]; let cur=start; const seen=new Set(); while(cur && !seen.has(cur)){ main.push(cur); seen.add(cur); const es=(edgeFrom[cur]||[]).filter(e=> depth.get(e.to)===depth.get(cur)+1); const prefer = es.find(e=> e.label==='진행') || es.sort((a,b)=> xOf.get(a.to)-xOf.get(b.to))[0]; cur = prefer?.to || null; }
    // Y: 다음 칼럼 자식만 군집
    const yOf=new Map(); let cy=160; const dfs=(id)=>{ if(yOf.has(id)) return yOf.get(id); const kids=(outs[id]||[]).filter(v=> depth.get(v)===depth.get(id)+1); if(kids.length===0){ const y=cy; yOf.set(id,y); cy+=yGap; return y; } const ys=kids.map(dfs); const mid=Math.floor((Math.min(...ys)+Math.max(...ys))/2); yOf.set(id,mid); return mid; };
    if(start) dfs(start); graph.nodes.forEach(n=>{ if(!yOf.has(n.id)){ const y=cy; yOf.set(n.id,y); cy+=yGap; } });
    const baseMainY=yOf.get(start)||160; main.forEach(id=> yOf.set(id, baseMainY));
    return graph.nodes.map(n=>({ id:n.id, title:n.title, x:xOf.get(n.id)||140, y:yOf.get(n.id)||160 }));
  }
  function drawGraph(){
    const host = wrap.querySelector('#graph'); host.innerHTML='';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('route-graph'); svg.style.width='100%'; svg.style.height='100%';
    const g = buildGraph(routes); const nodes = layout(g); const content = document.createElementNS('http://www.w3.org/2000/svg','g'); svg.appendChild(content);
    const edges = g.edges;
    // 장애물(노드) 목록
    const obstacles = nodes.map(n=>({ id:n.id, x1:n.x-80, x2:n.x+80, y1:n.y-30, y2:n.y+30 }));
    const mkRoundedPath=(ax,ay,bx,by, excludeIds=[])=>{
      const startX=ax+80, startY=ay; const endX=bx-80, endY=by; const r=10, margin=14;
      if(startY===endY){
        const between = obstacles.filter(o=> !excludeIds.includes(o.id) && o.x1<endX && o.x2>startX && !(o.y2<startY || o.y1>startY));
        if(between.length===0) return `M${startX},${startY} L${endX},${endY}`;
        const topY=Math.min(...between.map(o=>o.y1)); const botY=Math.max(...between.map(o=>o.y2));
        let railY = topY - margin; if(!(railY < startY - 8)) railY = botY + margin;
        const firstBlockX1 = Math.min(...between.map(o=>o.x1)); const railX = Math.max(startX+24, Math.min(firstBlockX1 - margin, startX + 80));
        const lastRight = Math.max(...between.map(o=> o.x2));
        const bendX = Math.max(railX + 80, Math.min(endX - 60, lastRight + 40));
        if(railY < startY){
          return `M${startX},${startY} `+
                 `H${railX} Q${railX},${startY} ${railX},${startY - r} `+
                 `V${railY + r} Q${railX},${railY} ${railX + r},${railY} `+
                 `H${bendX - r} Q${bendX},${railY} ${bendX},${railY + r} `+
                 `V${endY - r} Q${bendX},${endY} ${bendX + r},${endY} `+
                 `H${endX}`;
        } else {
          return `M${startX},${startY} `+
                 `H${railX} Q${railX},${startY} ${railX},${startY + r} `+
                 `V${railY - r} Q${railX},${railY} ${railX + r},${railY} `+
                 `H${bendX - r} Q${bendX},${railY} ${bendX},${railY - r} `+
                 `V${endY + r} Q${bendX},${endY} ${bendX + r},${endY} `+
                 `H${endX}`;
        }
      }
      // 세로 구간과 겹치는 장애물 우회, 둥근 코너 두 번
      const yMinAll=Math.min(startY,endY)+r, yMaxAll=Math.max(startY,endY)-r; const blockers=obstacles.filter(o=> !excludeIds.includes(o.id) && !(yMaxAll<o.y1-margin || yMinAll>o.y2+margin) && (o.x2>=startX));
      let x1=Math.max(startX+80, ...(blockers.map(b=> b.x2+margin))); x1=Math.min(x1, endX-60);
      const dirDown=endY>startY; const yCorner1=startY + (dirDown? r : -r); const yCorner2=endY - (dirDown? r : -r);
      return `M${startX},${startY} H${x1-r} Q${x1},${startY} ${x1},${yCorner1} V${yCorner2} Q${x1},${endY} ${x1+r},${endY} H${endX}`;
    };
    edges.forEach(e=>{ const a=nodes.find(n=>n.id===e.from); const b=nodes.find(n=>n.id===e.to); if(!a||!b) return; const p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', mkRoundedPath(a.x,a.y,b.x,b.y, [a.id,b.id])); p.setAttribute('class','edge'); content.appendChild(p); });
    nodes.forEach(n=>{ const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('x', n.x-80); r.setAttribute('y', n.y-30); r.setAttribute('width',160); r.setAttribute('height',60); r.setAttribute('rx',10); const cls=['node']; if(selectedId && n.id===selectedId) cls.push('current'); r.setAttribute('class',cls.join(' ')); const t=document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x', n.x); t.setAttribute('y', n.y+6); t.setAttribute('text-anchor','middle'); t.textContent=n.title||n.id; const onPick=()=>{ selectedId=n.id; renderList(); renderForm(); drawGraph(); }; r.style.cursor='pointer'; t.style.cursor='pointer'; r.addEventListener('click', onPick); t.addEventListener('click', onPick); content.appendChild(r); content.appendChild(t); });
    // world bounds
    const minX = Math.min(...nodes.map(n=>n.x-100), 0), minY = Math.min(...nodes.map(n=>n.y-60), 0);
    const maxX = Math.max(...nodes.map(n=>n.x+100), 1200), maxY = Math.max(...nodes.map(n=>n.y+60), 800);
    const W = Math.ceil(maxX - Math.min(minX,0) + 200);
    const H = Math.ceil(maxY - Math.min(minY,0) + 200);
    let view = { x:0, y:0, w: Math.min(W, 1200), h: Math.min(H, 800) };
    // focus to selected node
    if(selectedId){ const cur = nodes.find(n=> n.id===selectedId); if(cur){ const x = Math.max(0, Math.round(cur.x - view.w/2)); const y = Math.max(0, Math.round(cur.y - view.h/2)); view.x = Math.min(Math.max(0,x), Math.max(0, W-view.w)); view.y = Math.min(Math.max(0,y), Math.max(0, H-view.h)); } }
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    host.appendChild(svg);
    enablePanZoom(host, svg, view, { W, H });
  }

  function enablePanZoom(container, svg, view, bounds){
    const W=bounds.W||2000, H=bounds.H||1200;
    let isPanning=false, start={x:0,y:0}; const clamp=(v,min,max)=> Math.max(min, Math.min(max, v));
    container.classList.add('grab');
    container.addEventListener('mousedown', (e)=>{ isPanning=true; container.classList.add('grabbing'); start={x:e.clientX,y:e.clientY}; });
    window.addEventListener('mouseup', ()=>{ isPanning=false; container.classList.remove('grabbing'); });
    window.addEventListener('mousemove',(e)=>{ if(!isPanning) return; const dx=e.clientX-start.x, dy=e.clientY-start.y; start={x:e.clientX,y:e.clientY}; view.x=clamp(view.x-dx, 0, W-view.w); view.y=clamp(view.y-dy, 0, H-view.h); svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`); });
    const wheelHandler=(e)=>{ e.preventDefault(); const rect=svg.getBoundingClientRect(); const mx=e.clientX-rect.left, my=e.clientY-rect.top; const px=mx/rect.width, py=my/rect.height; const worldX=view.x + px*view.w, worldY=view.y + py*view.h; const scale=e.deltaY>0? 1.1:0.9; const newW=clamp(view.w*scale, 80, W); const newH=clamp(view.h*scale, 60, H); view.x=clamp(worldX - px*newW, 0, W-newW); view.y=clamp(worldY - py*newH, 0, H-newH); view.w=newW; view.h=newH; svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`); };
    svg.addEventListener('wheel', wheelHandler, { passive:false });
    container.addEventListener('wheel', wheelHandler, { passive:false });
  }

  function validate(){
    const out = [];
    try{
      const ids = new Set();
      routes.forEach(r=>{ if(ids.has(r.id)) out.push(`중복 ID: ${r.id}`); ids.add(r.id); });
      // refs
      routes.forEach(r=>{
        if(r.next){
          if(r.next.startsWith('R-') && !routes.find(x=>x.id===r.next)) out.push(`[${r.id}] next 미존재 루트: ${r.next}`);
          if(r.next.startsWith('EP-') && !episodes[r.next]) out.push(`[${r.id}] next 미존재 에피소드: ${r.next}`);
          if(r.next.startsWith('BT-') && !battles[r.next]) out.push(`[${r.id}] next 미존재 전투: ${r.next}`);
        }
        (r.branches||[]).forEach(b=>{ if(b.to && !routes.find(x=>x.id===b.to)) out.push(`[${r.id}] 분기 대상 미존재: ${b.to}`); });
        // flag registry cross-check
        try{
          const reqs = Array.isArray(r.requirements)? r.requirements : [];
          reqs.forEach(rr=> walkReq(rr, (node)=>{
            if(node?.type==='flag' && node.key){
              import('../data/flags.js').then(mod=>{
                const reg = mod.FLAGS||{}; const hasExact = !!reg[node.key];
                const hasWildcard = Object.keys(reg).some(p=> p.includes('*') && new RegExp('^'+p.split('*').map(x=> x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(node.key));
                if(!hasExact && !hasWildcard){ out.push(`[${r.id}] 레지스트리에 없는 플래그 키: ${node.key}`); }
                wrap.querySelector('#valOut').innerHTML = out.length? out.map(s=>`<div>• ${s}</div>`).join('') : '<div style="color:#4ade80;">문제 없음</div>';
              });
            }
          }));
        }catch{}
      });
      // reachability (requirements 무시, 구조만)
      const graph = buildGraph(routes); const seen=new Set(); const q=[routes[0]?.id]; while(q.length){ const x=q.shift(); if(!x||seen.has(x)) continue; seen.add(x); graph.edges.filter(e=>e.from===x).forEach(e=> q.push(e.to)); const nxt = (routes.find(r=>r.id===x)?.next)||''; if(nxt.startsWith('R-')) q.push(nxt); }
      routes.forEach(r=>{ if(!seen.has(r.id)) out.push(`비도달 루트: ${r.id}`); });
    }catch(e){ out.push('검증 중 오류: '+e.message); }
    wrap.querySelector('#valOut').innerHTML = out.length? out.map(s=>`<div>• ${s}</div>`).join('') : '<div style="color:#4ade80;">문제 없음</div>';
    drawGraph();
  }

  function walkReq(node, fn){ if(!node) return; fn(node); if(Array.isArray(node.anyOf)) node.anyOf.forEach(n=> walkReq(n, fn)); }

  // 효과 렌더링 함수들
  function renderEffectsList(effects){
    if(!effects || !effects.length) return '<div style="color:#9aa0a6; font-style:italic;">효과 없음</div>';
    
    return effects.map((effect, idx) => {
      let description = '';
      switch(effect.type) {
        case 'flag.set':
          description = `플래그: ${effect.key} = ${effect.value}`;
          break;
        case 'party.add':
          description = `동료 합류: ${effect.unit}`;
          break;
        case 'party.remove':
          description = `동료 제거: ${effect.unit}`;
          break;
        default:
          description = `${effect.type}: ${JSON.stringify(effect)}`;
      }
      
      return `<div class="effect-item" data-idx="${idx}" style="background:#1a2332; padding:4px 8px; border-radius:4px; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#cbd5e1;">${description}</span>
        <button class="btn danger effect-del" data-idx="${idx}" style="padding:2px 6px; font-size:12px;">×</button>
      </div>`;
    }).join('');
  }
  
  function collectChoiceData(choiceContainer){
    const choiceItems = Array.from(choiceContainer.querySelectorAll('.choice-item'));
    return choiceItems.map(item => {
      const label = item.querySelector('.choice_label')?.value || '';
      const next = item.querySelector('.choice_next')?.value || '';
      
      // 효과 수집
      const effects = [];
      const effectItems = Array.from(item.querySelectorAll('.effect-item'));
      effectItems.forEach(effectEl => {
        const idx = Number(effectEl.dataset.idx);
        const choiceIdx = Number(item.dataset.idx);
        const storedEffects = getStoredEffects(choiceIdx) || [];
        if(storedEffects[idx]) {
          effects.push(storedEffects[idx]);
        }
      });
      
      return { label, next, effects };
    });
  }
  
  // 효과 저장소 (임시)
  const effectsStorage = new Map();
  
  function getStoredEffects(choiceIdx){
    return effectsStorage.get(choiceIdx) || [];
  }
  
  function setStoredEffects(choiceIdx, effects){
    effectsStorage.set(choiceIdx, effects);
  }
  
  function initializeEffectsStorage(events){
    effectsStorage.clear();
    
    events.forEach(event => {
      if(event.cmd === 'choice' && event.items) {
        event.items.forEach((item, idx) => {
          setStoredEffects(idx, item.effects || []);
        });
      }
    });
  }
  
  function addEffectToChoice(choiceIdx, effect){
    const effects = getStoredEffects(choiceIdx);
    effects.push(effect);
    setStoredEffects(choiceIdx, effects);
  }
  
  function removeEffectFromChoice(choiceIdx, effectIdx){
    const effects = getStoredEffects(choiceIdx);
    effects.splice(effectIdx, 1);
    setStoredEffects(choiceIdx, effects);
  }
  
  function collectAvailableFlags(){
    const flagSet = new Set();
    const flagList = [];
    
    // FLAGS 레지스트리에서 수집
    Object.keys(flags || FLAG_REG || {}).forEach(key => {
      const flag = (flags || FLAG_REG || {})[key];
      if(!key.includes('*')) { // 와일드카드가 아닌 것만
        flagSet.add(key);
        flagList.push({
          key: key,
          desc: flag?.desc || '',
          type: flag?.type || 'boolean',
          source: 'registry'
        });
      }
    });
    
    // 현재 에피소드들에서 사용된 플래그들 수집
    Object.values(episodes || {}).forEach(ep => {
      if(ep.events) {
        ep.events.forEach(event => {
          if(event.cmd === 'choice' && event.items) {
            event.items.forEach(item => {
              (item.effects || []).forEach(effect => {
                if(effect.type === 'flag.set' && effect.key && !flagSet.has(effect.key)) {
                  flagSet.add(effect.key);
                  flagList.push({
                    key: effect.key,
                    desc: '에피소드에서 사용됨',
                    type: typeof effect.value === 'boolean' ? 'boolean' : typeof effect.value,
                    source: 'episode'
                  });
                }
              });
            });
          }
        });
      }
    });
    
    // 루트에서 사용된 플래그들도 수집
    (routes || []).forEach(route => {
      (route.requirements || []).forEach(req => {
        if(req.type === 'flag' && req.key && !flagSet.has(req.key)) {
          flagSet.add(req.key);
          flagList.push({
            key: req.key,
            desc: '루트 조건에서 사용됨',
            type: typeof req.value === 'boolean' ? 'boolean' : typeof req.value,
            source: 'route'
          });
        }
      });
    });
    
    return flagList.sort((a, b) => a.key.localeCompare(b.key));
  }
  
  function collectAvailableUnits(){
    const units = (state?.data?.units) || (window.appState?.data?.units) || {};
    return Object.keys(units)
      .filter(id => id.startsWith('C-')) // 동료만 (C-로 시작)
      .map(id => ({
        id: id,
        name: units[id]?.name || id,
        desc: `HP: ${units[id]?.hp || 0}, ATK: ${units[id]?.atk || 0}`
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  
  function refreshEffectsList(choiceIdx){
    const effectsList = formEl.querySelector(`.effects-list[data-idx="${choiceIdx}"]`);
    if(effectsList) {
      const effects = getStoredEffects(choiceIdx);
      effectsList.innerHTML = renderEffectsList(effects);
      bindChoiceEventHandlers(formEl.querySelector('#dslEvents'));
    }
  }
  
  function showFlagEffectModal(choiceIdx){
    const availableFlags = collectAvailableFlags();
    
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="min-width:500px;">
        <h3>플래그 설정</h3>
        <div class="col" style="gap:8px;">
          <label class="col" style="gap:4px;">
            <span style="color:#9aa0a6;">플래그 키:</span>
            <div class="row" style="gap:6px;">
              <select id="flagKeySelect" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
                <option value="">기존 플래그 선택...</option>
                ${availableFlags.map(flag => `<option value="${flag.key}">${flag.key}${flag.desc ? ` - ${flag.desc}` : ''}</option>`).join('')}
                <option value="__custom__">🆕 새 플래그 직접 입력</option>
              </select>
            </div>
            <input id="flagKeyCustom" placeholder="새 플래그 키 (예: ep.EP-001.newChoice)" style="display:none; margin-top:4px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          </label>
          <label class="row" style="gap:8px; align-items:center; margin-top:8px;">
            <span style="width:80px;">값:</span>
            <select id="flagValueType" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
              <option value="true">true</option>
              <option value="false">false</option>
              <option value="text">텍스트</option>
              <option value="number">숫자</option>
            </select>
            <input id="flagValue" placeholder="값" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px; display:none;"/>
          </label>
        </div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button class="btn" id="flagCancel">취소</button>
          <button class="btn primary" id="flagOk">추가</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const flagKeySelect = modal.querySelector('#flagKeySelect');
    const flagKeyCustom = modal.querySelector('#flagKeyCustom');
    const flagValueType = modal.querySelector('#flagValueType');
    const flagValue = modal.querySelector('#flagValue');
    
    // 플래그 키 선택 이벤트
    flagKeySelect.onchange = () => {
      if(flagKeySelect.value === '__custom__') {
        flagKeyCustom.style.display = 'block';
        flagKeyCustom.focus();
      } else {
        flagKeyCustom.style.display = 'none';
        
        // 선택된 플래그의 타입에 맞게 값 타입 자동 설정
        if(flagKeySelect.value) {
          const selectedFlag = availableFlags.find(f => f.key === flagKeySelect.value);
          if(selectedFlag) {
            flagValueType.value = selectedFlag.type === 'string' ? 'text' : 
                                 selectedFlag.type === 'number' ? 'number' : 
                                 selectedFlag.type === 'boolean' ? 'true' : 'true';
            flagValueType.onchange(); // 값 입력 필드 표시/숨김 트리거
          }
        }
      }
    };
    
    // 값 타입 변경 이벤트
    flagValueType.onchange = () => {
      flagValue.style.display = (flagValueType.value === 'true' || flagValueType.value === 'false') ? 'none' : 'block';
      if(flagValueType.value === 'number') {
        flagValue.type = 'number';
        flagValue.placeholder = '숫자 값';
      } else {
        flagValue.type = 'text';
        flagValue.placeholder = '텍스트 값';
      }
    };
    
    modal.querySelector('#flagCancel').onclick = () => modal.remove();
    modal.querySelector('#flagOk').onclick = () => {
      let key;
      
      if(flagKeySelect.value === '__custom__') {
        key = flagKeyCustom.value.trim();
        if(!key) {
          alert('새 플래그 키를 입력하세요.');
          flagKeyCustom.focus();
          return;
        }
        // 플래그 키 형식 검증
        if(!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(key)) {
          alert('플래그 키는 영문자로 시작하고 영문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.');
          flagKeyCustom.focus();
          return;
        }
      } else {
        key = flagKeySelect.value;
        if(!key) {
          alert('플래그를 선택하거나 새로 입력하세요.');
          return;
        }
      }
      
      let value;
      switch(flagValueType.value) {
        case 'true': value = true; break;
        case 'false': value = false; break;
        case 'number': 
          value = Number(flagValue.value);
          if(isNaN(value)) {
            alert('올바른 숫자를 입력하세요.');
            flagValue.focus();
            return;
          }
          break;
        default: value = flagValue.value || '';
      }
      
      const effect = {
        type: 'flag.set',
        key: key,
        value: value
      };
      
      addEffectToChoice(choiceIdx, effect);
      refreshEffectsList(choiceIdx);
      modal.remove();
    };
  }
  
  function showPartyEffectModal(choiceIdx){
    const availableUnits = collectAvailableUnits();
    
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="min-width:500px;">
        <h3>동료 관리</h3>
        <div class="col" style="gap:8px;">
          <label class="row" style="gap:8px; align-items:center;">
            <span style="width:80px;">동작:</span>
            <select id="partyAction" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
              <option value="add">합류</option>
              <option value="remove">제거</option>
            </select>
          </label>
          <label class="col" style="gap:4px;">
            <span style="color:#9aa0a6;">동료 선택:</span>
            <select id="partyUnit" style="padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
              ${availableUnits.length > 0 ? 
                availableUnits.map(u => `<option value="${u.id}">${u.name} (${u.id}) - ${u.desc}</option>`).join('') :
                '<option value="">사용 가능한 동료가 없습니다</option>'
              }
            </select>
            ${availableUnits.length > 0 ? `
              <div style="color:#9aa0a6; font-size:12px; margin-top:4px;">
                💡 동료는 C-로 시작하는 유닛만 표시됩니다
              </div>
            ` : `
              <div style="color:#f87171; font-size:12px; margin-top:4px;">
                ⚠️ units.js에서 C-로 시작하는 유닛을 추가하세요
              </div>
            `}
          </label>
        </div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button class="btn" id="partyCancel">취소</button>
          <button class="btn primary" id="partyOk" ${availableUnits.length === 0 ? 'disabled' : ''}>추가</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#partyCancel').onclick = () => modal.remove();
    modal.querySelector('#partyOk').onclick = () => {
      if(availableUnits.length === 0) {
        alert('사용 가능한 동료가 없습니다.');
        return;
      }
      
      const action = modal.querySelector('#partyAction').value;
      const unit = modal.querySelector('#partyUnit').value;
      
      if(!unit) {
        alert('동료를 선택하세요.');
        return;
      }
      
      const effect = {
        type: `party.${action}`,
        unit: unit
      };
      
      addEffectToChoice(choiceIdx, effect);
      refreshEffectsList(choiceIdx);
      modal.remove();
    };
  }
  
  function showCustomEffectModal(choiceIdx){
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="min-width:500px;">
        <h3>커스텀 효과</h3>
        <div class="col" style="gap:8px;">
          <label class="col" style="gap:4px;">
            <span style="color:#9aa0a6;">JSON 형식으로 입력하세요:</span>
            <textarea id="customEffect" placeholder='{"type": "custom", "data": "value"}' style="min-height:100px; padding:8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"></textarea>
          </label>
        </div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button class="btn" id="customCancel">취소</button>
          <button class="btn primary" id="customOk">추가</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#customCancel').onclick = () => modal.remove();
    modal.querySelector('#customOk').onclick = () => {
      const jsonText = modal.querySelector('#customEffect').value.trim();
      if(!jsonText) {
        alert('효과를 입력하세요.');
        return;
      }
      
      try {
        const effect = JSON.parse(jsonText);
        addEffectToChoice(choiceIdx, effect);
        refreshEffectsList(choiceIdx);
        modal.remove();
      } catch(e) {
        alert('올바른 JSON 형식이 아닙니다: ' + e.message);
      }
    };
  }

  // DSL 관련 함수들
  function dslEventRow(event, i){
    const cmd = event?.cmd || '';
    let fields = '';
    
    switch(cmd){
      case 'bg':
        fields = `<input class="dsl_bg_name" placeholder="배경 이름 (예: BG_001)" value="${event.name||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_bg_dur" placeholder="지속시간(ms)" value="${event.dur||500}" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
        break;
      case 'show':
        fields = `<input class="dsl_show_id" placeholder="캐릭터 ID (예: story/cha_001)" value="${event.id||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <select class="dsl_show_side" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
                    <option value="left"${event.side==='left'?' selected':''}>왼쪽</option>
                    <option value="center"${event.side==='center'?' selected':''}>중앙</option>
                    <option value="right"${event.side==='right'?' selected':''}>오른쪽</option>
                  </select>
                  <input class="dsl_show_offset_x" placeholder="X오프셋" value="${event.offset?.x||''}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_show_offset_y" placeholder="Y오프셋" value="${event.offset?.y||''}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_show_dur" placeholder="시간" value="${event.dur||250}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
        break;
      case 'say':
        fields = `<input class="dsl_say_speaker" placeholder="화자" value="${event.speaker||''}" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_say_text" placeholder="대사 내용" value="${event.text||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
        break;
      case 'choice':
        const items = event.items || [{label:'', next:'', effects:[]}];
        const choiceRows = items.map((item, idx) => `
          <div class="choice-item" data-idx="${idx}" style="border:1px solid #2b3450; border-radius:6px; padding:8px; margin-top:6px;">
            <div class="row" style="gap:6px; margin-bottom:6px;">
              <input class="choice_label" placeholder="선택지 텍스트" value="${item.label||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
              <input class="choice_next" placeholder="다음 (R-/EP-/BT-)" value="${item.next||''}" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
              <button class="btn danger choice_del">삭제</button>
            </div>
            <div class="choice-effects" style="margin-top:6px;">
              <div style="color:#9aa0a6; margin-bottom:4px;">효과:</div>
              <div class="effects-list" data-idx="${idx}">${renderEffectsList(item.effects || [])}</div>
              <div class="row" style="gap:6px; margin-top:4px;">
                <button class="btn effect-add-flag" data-choice="${idx}">플래그 설정</button>
                <button class="btn effect-add-party" data-choice="${idx}">동료 합류</button>
                <button class="btn effect-add-custom" data-choice="${idx}">커스텀</button>
              </div>
            </div>
          </div>
        `).join('');
        fields = `
          <div class="choice-container">
            ${choiceRows}
            <button class="btn choice-add" style="margin-top:6px;">선택지 추가</button>
          </div>
        `;
        break;
      case 'popup':
        fields = `<input class="dsl_popup_name" placeholder="팝업 이미지 이름" value="${event.name||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_popup_width" placeholder="너비 (예: 60%)" value="${event.size?.width||''}" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_popup_height" placeholder="높이 (예: 60%)" value="${event.size?.height||''}" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_popup_dur" placeholder="시간" value="${event.dur||300}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
        break;
      case 'hidePopup':
        fields = `<input class="dsl_hide_popup_dur" placeholder="페이드아웃 시간(ms)" value="${event.dur||300}" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
        break;
      case 'move':
        fields = `<input class="dsl_move_id" placeholder="캐릭터 ID" value="${event.id||''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <select class="dsl_move_side" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
                    <option value="left"${event.side==='left'?' selected':''}>왼쪽</option>
                    <option value="center"${event.side==='center'?' selected':''}>중앙</option>
                    <option value="right"${event.side==='right'?' selected':''}>오른쪽</option>
                  </select>
                  <input class="dsl_move_offset_x" placeholder="X오프셋" value="${event.offset?.x||''}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_move_offset_y" placeholder="Y오프셋" value="${event.offset?.y||''}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
                  <input class="dsl_move_dur" placeholder="시간" value="${event.dur||250}" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
        break;
      default:
        fields = `<input placeholder="명령어별 설정" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;" disabled/>`;
    }
    
    return `<div class="dsl-event" data-idx="${i}" style="margin-top:6px; padding:8px; border:1px solid #2b3450; border-radius:6px;">
      <div class="row" style="gap:6px; align-items:center; margin-bottom:6px;">
        <span class="drag-handle" style="cursor:grab; color:#9aa0a6;">↕</span>
        <select class="dsl_cmd" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">
          <option value="">(선택)</option>
          <option value="bg"${cmd==='bg'?' selected':''}>배경</option>
          <option value="show"${cmd==='show'?' selected':''}>캐릭터 표시</option>
          <option value="say"${cmd==='say'?' selected':''}>대사</option>
          <option value="choice"${cmd==='choice'?' selected':''}>선택지</option>
          <option value="popup"${cmd==='popup'?' selected':''}>팝업</option>
          <option value="hidePopup"${cmd==='hidePopup'?' selected':''}>팝업 숨김</option>
          <option value="move"${cmd==='move'?' selected':''}>이동</option>
          <option value="wait"${cmd==='wait'?' selected':''}>대기</option>
        </select>
        <button class="btn danger dsl_del">삭제</button>
      </div>
      <div class="row" style="gap:6px; align-items:flex-start;">
        ${fields}
      </div>
    </div>`;
  }
  
  function bindDslButtons(){
    const host = formEl.querySelector('#dslEvents');
    if(!host) return;
    
    // 명령어 추가 버튼들
    const btnBg = formEl.querySelector('#btnDslAddBg');
    const btnShow = formEl.querySelector('#btnDslAddShow');
    const btnSay = formEl.querySelector('#btnDslAddSay');
    const btnChoice = formEl.querySelector('#btnDslAddChoice');
    const btnPopup = formEl.querySelector('#btnDslAddPopup');
    const btnMove = formEl.querySelector('#btnDslAddMove');
    const btnToLegacy = formEl.querySelector('#btnDslToLegacy');
    
    if(btnBg){ btnBg.onclick = () => addDslEvent({cmd:'bg', name:'', dur:500}); }
    if(btnShow){ btnShow.onclick = () => addDslEvent({cmd:'show', id:'', side:'center', dur:250}); }
    if(btnSay){ btnSay.onclick = () => addDslEvent({cmd:'say', speaker:'', text:''}); }
    if(btnChoice){ btnChoice.onclick = () => addDslEvent({cmd:'choice', items:[{label:'', next:''}]}); }
    if(btnPopup){ btnPopup.onclick = () => addDslEvent({cmd:'popup', name:'', dur:300}); }
    if(btnMove){ btnMove.onclick = () => addDslEvent({cmd:'move', id:'', side:'center', dur:250}); }
    if(btnToLegacy){ btnToLegacy.onclick = () => convertDslToLegacy(); }
    
    // 기존 이벤트 행들의 삭제 버튼과 명령어 변경 바인딩
    bindDslEventRows();
  }
  
  function addDslEvent(event){
    const host = formEl.querySelector('#dslEvents');
    if(!host) return;
    
    const idx = host.querySelectorAll('.dsl-event').length;
    const div = document.createElement('div');
    div.innerHTML = dslEventRow(event, idx);
    host.appendChild(div.firstChild);
    bindDslEventRows();
  }
  
  function bindDslEventRows(){
    const host = formEl.querySelector('#dslEvents');
    if(!host) return;
    
    // 삭제 버튼
    host.querySelectorAll('.dsl_del').forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest('.dsl-event');
        if(row) row.remove();
      };
    });
    
    // 선택지 관련 이벤트 핸들러
    bindChoiceEventHandlers(host);
    
    // 명령어 변경시 필드 재생성
    host.querySelectorAll('.dsl_cmd').forEach(sel => {
      sel.onchange = () => {
        const row = sel.closest('.dsl-event');
        const idx = row.dataset.idx;
        const newCmd = sel.value;
        const newEvent = { cmd: newCmd };
        
        // 기본값 설정
        switch(newCmd){
          case 'bg': newEvent.name = ''; newEvent.dur = 500; break;
          case 'show': newEvent.id = ''; newEvent.side = 'center'; newEvent.dur = 250; break;
          case 'say': newEvent.speaker = ''; newEvent.text = ''; break;
          case 'choice': newEvent.items = [{label:'', next:'', effects:[]}]; break;
          case 'popup': newEvent.name = ''; newEvent.dur = 300; break;
          case 'hidePopup': newEvent.dur = 300; break;
          case 'move': newEvent.id = ''; newEvent.side = 'center'; newEvent.dur = 250; break;
        }
        
        row.outerHTML = dslEventRow(newEvent, idx);
        bindDslEventRows();
      };
    });
  }
  
  function bindChoiceEventHandlers(host){
    // 선택지 추가 버튼
    host.querySelectorAll('.choice-add').forEach(btn => {
      btn.onclick = () => {
        const container = btn.closest('.choice-container');
        const choiceCount = container.querySelectorAll('.choice-item').length;
        const newChoiceHTML = `
          <div class="choice-item" data-idx="${choiceCount}" style="border:1px solid #2b3450; border-radius:6px; padding:8px; margin-top:6px;">
            <div class="row" style="gap:6px; margin-bottom:6px;">
              <input class="choice_label" placeholder="선택지 텍스트" value="" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
              <input class="choice_next" placeholder="다음 (R-/EP-/BT-)" value="" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
              <button class="btn danger choice_del">삭제</button>
            </div>
            <div class="choice-effects" style="margin-top:6px;">
              <div style="color:#9aa0a6; margin-bottom:4px;">효과:</div>
              <div class="effects-list" data-idx="${choiceCount}">${renderEffectsList([])}</div>
              <div class="row" style="gap:6px; margin-top:4px;">
                <button class="btn effect-add-flag" data-choice="${choiceCount}">플래그 설정</button>
                <button class="btn effect-add-party" data-choice="${choiceCount}">동료 합류</button>
                <button class="btn effect-add-custom" data-choice="${choiceCount}">커스텀</button>
              </div>
            </div>
          </div>
        `;
        
        const div = document.createElement('div');
        div.innerHTML = newChoiceHTML;
        container.insertBefore(div.firstChild, btn);
        
        // 효과 저장소 초기화
        setStoredEffects(choiceCount, []);
        
        bindChoiceEventHandlers(host);
      };
    });
    
    // 선택지 삭제 버튼
    host.querySelectorAll('.choice_del').forEach(btn => {
      btn.onclick = () => {
        const choiceItem = btn.closest('.choice-item');
        const choiceIdx = Number(choiceItem.dataset.idx);
        
        // 효과 저장소에서 제거
        effectsStorage.delete(choiceIdx);
        
        choiceItem.remove();
        bindChoiceEventHandlers(host);
      };
    });
    
    // 효과 추가 버튼들
    host.querySelectorAll('.effect-add-flag').forEach(btn => {
      btn.onclick = () => showFlagEffectModal(Number(btn.dataset.choice));
    });
    
    host.querySelectorAll('.effect-add-party').forEach(btn => {
      btn.onclick = () => showPartyEffectModal(Number(btn.dataset.choice));
    });
    
    host.querySelectorAll('.effect-add-custom').forEach(btn => {
      btn.onclick = () => showCustomEffectModal(Number(btn.dataset.choice));
    });
    
    // 효과 삭제 버튼
    host.querySelectorAll('.effect-del').forEach(btn => {
      btn.onclick = () => {
        const effectItem = btn.closest('.effect-item');
        const effectIdx = Number(btn.dataset.idx);
        const choiceIdx = Number(effectItem.closest('.choice-item').dataset.idx);
        
        removeEffectFromChoice(choiceIdx, effectIdx);
        refreshEffectsList(choiceIdx);
      };
    });
  }
  
  function convertLegacyToDsl(epId){
    if(!confirm('레거시 형식을 DSL 형식으로 변환하시겠습니까?')) return;
    
    const ep = episodes[epId] || {};
    const events = [];
    
    // scene을 say 명령어로 변환
    (ep.scene || []).forEach(line => {
      if(line.speaker || line.text){
        events.push({
          cmd: 'say',
          speaker: line.speaker || '',
          text: line.text || ''
        });
      }
    });
    
    // choices를 choice 명령어로 변환
    if(ep.choices && ep.choices.length > 0){
      events.push({
        cmd: 'choice',
        items: ep.choices.map(c => ({
          label: c.label || '',
          next: c.next || '',
          effects: c.effects || []
        }))
      });
    }
    
    episodes[epId] = { events };
    renderForm();
  }
  
  function convertDslToLegacy(){
    if(!confirm('DSL 형식을 레거시 형식으로 변환하시겠습니까? (일부 기능이 손실될 수 있습니다)')) return;
    
    const epId = (routes.find(r => r.id === selectedId)?.next) || '';
    if(!epId.startsWith('EP-')) return;
    
    const ep = episodes[epId] || {};
    const scene = [];
    let choices = [];
    
    // events에서 say와 choice만 추출
    (ep.events || []).forEach(event => {
      if(event.cmd === 'say'){
        scene.push({
          speaker: event.speaker || '',
          text: event.text || ''
        });
      } else if(event.cmd === 'choice'){
        choices = event.items || [];
      }
    });
    
    episodes[epId] = { scene, choices };
    renderForm();
  }
  
  function bindBattleEpisodeButtons(){
    // Win DSL 버튼들
    const btnWinDslBg = formEl.querySelector('#btnEpWinDslAddBg');
    const btnWinDslSay = formEl.querySelector('#btnEpWinDslAddSay');
    const btnWinDslChoice = formEl.querySelector('#btnEpWinDslAddChoice');
    
    if(btnWinDslBg){ btnWinDslBg.onclick = () => addDslEventToHost('#epWinDslEvents', {cmd:'bg', name:'', dur:500}); }
    if(btnWinDslSay){ btnWinDslSay.onclick = () => addDslEventToHost('#epWinDslEvents', {cmd:'say', speaker:'', text:''}); }
    if(btnWinDslChoice){ btnWinDslChoice.onclick = () => addDslEventToHost('#epWinDslEvents', {cmd:'choice', items:[{label:'', next:''}]}); }
    
    // Lose DSL 버튼들
    const btnLoseDslBg = formEl.querySelector('#btnEpLoseDslAddBg');
    const btnLoseDslSay = formEl.querySelector('#btnEpLoseDslAddSay');
    const btnLoseDslChoice = formEl.querySelector('#btnEpLoseDslAddChoice');
    
    if(btnLoseDslBg){ btnLoseDslBg.onclick = () => addDslEventToHost('#epLoseDslEvents', {cmd:'bg', name:'', dur:500}); }
    if(btnLoseDslSay){ btnLoseDslSay.onclick = () => addDslEventToHost('#epLoseDslEvents', {cmd:'say', speaker:'', text:''}); }
    if(btnLoseDslChoice){ btnLoseDslChoice.onclick = () => addDslEventToHost('#epLoseDslEvents', {cmd:'choice', items:[{label:'', next:''}]}); }
    
    // 레거시 버튼들
    const btnWinL = formEl.querySelector('#btnEpWinAddLine');
    const btnWinC = formEl.querySelector('#btnEpWinAddChoice');
    const btnWinP = formEl.querySelector('#btnEpWinAddParty');
    if(btnWinL){ btnWinL.onclick=()=>{ const host=formEl.querySelector('#epWinScene'); const idx=host.querySelectorAll('.row').length; const div=document.createElement('div'); div.innerHTML=epLineRow({speaker:'', text:''}, idx); host.appendChild(div.firstChild); bindEpRowDeletes(); }; }
    if(btnWinC){ btnWinC.onclick=()=>{ const host=formEl.querySelector('#epWinChoices'); const idx=host.querySelectorAll('.row').length; const div=document.createElement('div'); div.innerHTML=epChoiceRow({label:'', next:'', effects:[]}, idx); host.appendChild(div.firstChild); bindChoiceRowDeletes(); attachChoiceTemplateHandlers(); }; }
    if(btnWinP){ btnWinP.onclick=()=>{ const host=formEl.querySelector('#epWinChoices'); const idx=host.querySelectorAll('.row').length; const unitId = (buildUnitOptions()[0]?.id)||'C-001'; const choice = { label:'동료 합류', next:'', effects:[{ type:'party.add', unit: unitId }] }; const div=document.createElement('div'); div.innerHTML=epChoiceRow(choice, idx); host.appendChild(div.firstChild); bindChoiceRowDeletes(); attachChoiceTemplateHandlers(); }; }
    const btnLoseL = formEl.querySelector('#btnEpLoseAddLine');
    const btnLoseC = formEl.querySelector('#btnEpLoseAddChoice');
    const btnLoseP = formEl.querySelector('#btnEpLoseAddParty');
    if(btnLoseL){ btnLoseL.onclick=()=>{ const host=formEl.querySelector('#epLoseScene'); const idx=host.querySelectorAll('.row').length; const div=document.createElement('div'); div.innerHTML=epLineRow({speaker:'', text:''}, idx); host.appendChild(div.firstChild); bindEpRowDeletes(); }; }
    if(btnLoseC){ btnLoseC.onclick=()=>{ const host=formEl.querySelector('#epLoseChoices'); const idx=host.querySelectorAll('.row').length; const div=document.createElement('div'); div.innerHTML=epChoiceRow({label:'', next:'', effects:[]}, idx); host.appendChild(div.firstChild); bindChoiceRowDeletes(); attachChoiceTemplateHandlers(); }; }
    if(btnLoseP){ btnLoseP.onclick=()=>{ const host=formEl.querySelector('#epLoseChoices'); const idx=host.querySelectorAll('.row').length; const unitId = (buildUnitOptions()[0]?.id)||'C-001'; const choice = { label:'동료 합류', next:'', effects:[{ type:'party.add', unit: unitId }] }; const div=document.createElement('div'); div.innerHTML=epChoiceRow(choice, idx); host.appendChild(div.firstChild); bindChoiceRowDeletes(); attachChoiceTemplateHandlers(); }; }
    
    // DSL 이벤트 행들 바인딩
    bindDslEventRowsInHost('#epWinDslEvents');
    bindDslEventRowsInHost('#epLoseDslEvents');
  }
  
  function addDslEventToHost(hostSelector, event){
    const host = formEl.querySelector(hostSelector);
    if(!host) return;
    
    const idx = host.querySelectorAll('.dsl-event').length;
    const div = document.createElement('div');
    div.innerHTML = dslEventRow(event, idx);
    host.appendChild(div.firstChild);
    bindDslEventRowsInHost(hostSelector);
  }
  
  function bindDslEventRowsInHost(hostSelector){
    const host = formEl.querySelector(hostSelector);
    if(!host) return;
    
    // 삭제 버튼
    host.querySelectorAll('.dsl_del').forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest('.dsl-event');
        if(row) row.remove();
      };
    });
    
    // 명령어 변경시 필드 재생성
    host.querySelectorAll('.dsl_cmd').forEach(sel => {
      sel.onchange = () => {
        const row = sel.closest('.dsl-event');
        const idx = row.dataset.idx;
        const newCmd = sel.value;
        const newEvent = { cmd: newCmd };
        
        // 기본값 설정
        switch(newCmd){
          case 'bg': newEvent.name = ''; newEvent.dur = 500; break;
          case 'show': newEvent.id = ''; newEvent.side = 'center'; newEvent.dur = 250; break;
          case 'say': newEvent.speaker = ''; newEvent.text = ''; break;
          case 'choice': newEvent.items = [{label:'', next:''}]; break;
          case 'popup': newEvent.name = ''; newEvent.dur = 300; break;
          case 'hidePopup': newEvent.dur = 300; break;
          case 'move': newEvent.id = ''; newEvent.side = 'center'; newEvent.dur = 250; break;
        }
        
        row.outerHTML = dslEventRow(newEvent, idx);
        bindDslEventRowsInHost(hostSelector);
      };
    });
  }

  // file helpers (routes.js 전용)
  function extractExportArray(source, exportName){
    const key = `export const ${exportName} = [`; const start = source.indexOf(key); if(start<0) throw new Error(`${exportName} export not found`); const head=start+key.length; let i=head, depth=1; while(i<source.length && depth>0){ const ch=source[i++]; if(ch==='[') depth++; else if(ch===']') depth--; } const end=i-1; const body = source.slice(head, end); return { start, head, end, body, key };
  }
  function safeEvalArrayLiteral(text){ return Function(`"use strict"; return ([${text}]);`)(); }
  function stringifyRoutesJS(arr){
    const q = (s)=> `'${String(s)}'`;
    const rows = arr.map(r=>{
      const req = JSON.stringify(r.requirements||[]);
      const br = JSON.stringify(r.branches||[]);
      return `  { id:${q(r.id)}, title:${q(r.title||'')}, summary:${q(r.summary||'')}, requirements:${req}, next:${q(r.next||'')}, branches:${br} }`;
    }).join(',\n');
    return `export const ROUTES = [\n${rows}\n];\n`;
  }

  async function pickRoutesJs(){ if(!window.showOpenFilePicker){ alert('파일 시스템 API 미지원'); return null; } const [h]=await window.showOpenFilePicker({ types:[{ description:'JavaScript', accept:{ 'text/javascript':['.js'] } }] }); routesJsHandle=h; return h; }
  async function writeRoutesToHandle(handle){ try{ if(!handle) return false; const file=await handle.getFile(); const src=await file.text(); const obj=extractExportArray(src,'ROUTES'); const before=src.slice(0,obj.start); const afterStart=src.indexOf('\n', obj.end+1); const tail= afterStart>0? src.slice(afterStart) : '\n'; const jsBlock=stringifyRoutesJS(routes); const newText=before+jsBlock+tail; const w=await handle.createWritable(); await w.write(newText); await w.close(); return true; }catch(e){ alert('쓰기 실패: '+e.message); return false; } }

  // Pick data directory once and remember; infer EP/BT/ROUTES file handles under it
  wrap.querySelector('#btnPickDataDir').onclick=async ()=>{
    try{
      if(!window.showDirectoryPicker){ alert('이 브라우저는 디렉터리 접근을 지원하지 않습니다.'); return; }
      const h = await window.showDirectoryPicker(); dataDirHandle = h; await idbSet('dataDirHandle', h); alert('데이터 폴더 설정 완료');
    }catch(e){ if(e.name!=='AbortError') alert('폴더 지정 실패: '+e.message); }
  };

  async function getFileHandleFromDir(filename){
    if(!dataDirHandle) dataDirHandle = await idbGet('dataDirHandle');
    if(!dataDirHandle) return null;
    try{ return await dataDirHandle.getFileHandle(filename, { create:false }); }catch{ return null; }
  }
  async function ensureDataDir(){
    if(!dataDirHandle){
      if(!window.showDirectoryPicker) return false;
      dataDirHandle = await window.showDirectoryPicker();
      await idbSet('dataDirHandle', dataDirHandle);
    }
    try{
      const p = await dataDirHandle.queryPermission?.({ mode:'readwrite' });
      if(p!=='granted'){ const r = await dataDirHandle.requestPermission?.({ mode:'readwrite' }); if(r!=='granted') return false; }
    }catch{}
    return true;
  }
  async function writeToDataDir(filename, text){
    if(!(await ensureDataDir())) return false;
    try{
      const fh = await dataDirHandle.getFileHandle(filename, { create:true });
      const w = await fh.createWritable(); await w.write(text); await w.close();
      return true;
    }catch(e){ console.error('[writeToDataDir]', filename, e); return false; }
  }
  function stringifyEpisodesJS(obj){ return `export const EPISODES = ${JSON.stringify(obj, null, 2)};\n`; }
  function stringifyBattlesJS(obj){ return `export const BATTLES = ${JSON.stringify(obj, null, 2)};\n`; }
  function stringifyFlagsJS(obj){ return `export const FLAGS = ${JSON.stringify(obj, null, 2)};\n`; }

  // actions
  wrap.querySelector('#btnNew').onclick=()=>{ const nid = prompt('새 루트 ID(예: R-999)'); if(!nid) return; if(routes.find(r=>r.id===nid)){ alert('이미 존재'); return; } routes.push({ id:nid, title:nid, summary:'', requirements:[], next:'', branches:[] }); selectedId=nid; renderList(); renderForm(); };
  wrap.querySelector('#btnDelete').onclick=()=>{ if(!selectedId) return; if(!confirm(`${selectedId} 삭제?`)) return; routes = routes.filter(r=> r.id!==selectedId); selectedId = routes[0]?.id||null; renderList(); renderForm(); };
  wrap.querySelector('#btnValidate').onclick=()=> validate();
  wrap.querySelector('#btnPreview').onclick=()=> drawGraph();
  wrap.querySelector('#btnFlags').onclick=()=>{
    const panel = document.createElement('div'); panel.className='modal-backdrop';
    const box = document.createElement('div'); box.className='modal'; box.style.maxWidth='800px';
    const list = Object.keys(flags||{}).sort();
    const rows = list.map(k=>`<tr><td style="white-space:nowrap;">${k}</td><td>${flags[k]?.type||''}</td><td>${String(flags[k]?.default)}</td><td>${flags[k]?.desc||''}</td><td><button class="btn danger" data-del="${k}">삭제</button></td></tr>`).join('');
    box.innerHTML = `<h3>플래그 관리</h3>
      <div class="row" style="gap:6px; align-items:center;">
        <input id="fk" placeholder="key (예: ep.EP-205.sacrifice)" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
        <select id="ft" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"><option value="boolean">boolean</option><option value="number">number</option><option value="string">string</option></select>
        <input id="fd" placeholder="default" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
        <input id="fs" placeholder="설명" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
        <button id="fAdd" class="btn">추가/업데이트</button>
      </div>
      <div style="margin-top:8px; max-height:380px; overflow:auto;">
        <table class="table" style="width:100%; border-collapse:collapse;">
          <thead><tr><th>key</th><th>type</th><th>default</th><th>desc</th><th></th></tr></thead>
          <tbody id="flagRows">${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:8px; color:#9aa0a6; font-size:12px;" id="flagUsage"></div>
      <div class="row" style="justify-content:flex-end; gap:6px; margin-top:12px;"><button class="btn" id="fClose">닫기</button></div>`;
    panel.appendChild(box); document.body.appendChild(panel);
    box.querySelector('#fClose').onclick=()=> panel.remove();
    box.querySelectorAll('[data-del]').forEach(btn=> btn.addEventListener('click', ()=>{ const k=btn.getAttribute('data-del'); delete flags[k]; btn.closest('tr').remove(); }));
    box.querySelector('#fAdd').onclick=()=>{
      const k = box.querySelector('#fk').value.trim(); const t=box.querySelector('#ft').value; const d=box.querySelector('#fd').value; const s=box.querySelector('#fs').value;
      if(!k){ alert('key 입력'); return; }
      let def = d; if(t==='boolean'){ def = (String(d).toLowerCase()==='true'); } else if(t==='number'){ def = Number(d||0); }
      flags[k] = { type:t, default:def, desc:s };
      const tr = document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${t}</td><td>${String(def)}</td><td>${s}</td><td><button class="btn danger" data-del="${k}">삭제</button></td>`; box.querySelector('#flagRows').appendChild(tr);
      tr.querySelector('[data-del]').onclick=()=>{ delete flags[k]; tr.remove(); };
    };
    // 사용처 스캔
    try{
      const usages = {};
      (routes||[]).forEach(r=>{ (r.requirements||[]).forEach(rr=> walkReq(rr, (node)=>{ if(node?.type==='flag' && node.key){ (usages[node.key] ||= []).push(r.id); } })); });
      const text = Object.keys(usages).length ? Object.entries(usages).map(([k,arr])=>`• ${k} → ${Array.from(new Set(arr)).join(', ')}`).join('<br/>') : '사용처가 감지되지 않았습니다.';
      box.querySelector('#flagUsage').innerHTML = text;
    }catch{}
  };
  wrap.querySelector('#btnSave').onclick=async ()=>{
    if(!selectedId) return; // 수집 및 반영
    const r = collectRouteFromForm(); const idx = routes.findIndex(x=>x.id===selectedId); if(idx>=0) routes[idx]=r; else routes.push(r);
    // 인라인 EP/BT 변경분을 상태 데이터에 반영
    state.data = state.data || {};
    if(r.next && r.next.startsWith('EP-')){ const ep = readInlineEpisode(r.next); if(ep){ state.data.episodes = state.data.episodes || {}; state.data.episodes[r.next] = ep; } }
    if(r.next && r.next.startsWith('BT-')){ const bt = readInlineBattle(r.next); if(bt){ state.data.battles = state.data.battles || {}; state.data.battles[r.next] = { ...(state.data.battles[r.next]||{}), id:r.next, ...bt }; } }
    // 일괄 저장: 데이터 폴더가 지정되어 있으면 routes/episodes/battles 모두 저장 + 모듈 리로드
    try{
      if(await ensureDataDir()){
        const okR = await writeToDataDir('routes.js', stringifyRoutesJS(routes));
        const okE = await writeToDataDir('episodes.js', stringifyEpisodesJS(state.data.episodes||episodes));
        const okB = await writeToDataDir('battles.js', stringifyBattlesJS(state.data.battles||battles));
        // 모듈 리로드 + 런타임 반영
        const [modR, modE, modB] = await Promise.all([
          import(`../data/routes.js?ts=${Date.now()}`),
          import(`../data/episodes.js?ts=${Date.now()}`),
          import(`../data/battles.js?ts=${Date.now()}`)
        ]);
        state.data.routes = modR.ROUTES; state.data.episodes = modE.EPISODES; state.data.battles = modB.BATTLES;
        if(state.ui && state.ui.battleState){ delete state.ui.battleState; }
        alert(`저장 완료${(!okR||!okE||!okB)? ' (일부 실패 포함)': ''}`);
        return;
      }
    }catch(e){ console.error('[save-all]', e); }
    // 폴더 미지정 시 기존 단일 파일 저장 동작 유지
    let handle = routesJsHandle; if(!handle){ handle = await getFileHandleFromDir('routes.js'); }
    if(!handle && !dataDirHandle){ try{ const h = await pickRoutesJs(); handle=h; }catch{} }
    if(handle){ const ok = await writeRoutesToHandle(handle); if(ok){ alert('routes.js 저장 완료'); return; } }
    alert('데이터 폴더가 지정되지 않았습니다. "데이터 폴더 지정"을 먼저 실행하세요.');
  };
  wrap.querySelector('#btnApplyRuntime').onclick=()=>{ try{ state.data = state.data||{}; state.data.routes = routes; alert('런타임에 적용되었습니다.'); }catch(e){ alert('오류: '+e.message); } };
  wrap.querySelector('#btnLoadRoutesJs').onclick=async ()=>{
    try{
      const h = await pickRoutesJs(); if(!h) return; const f=await h.getFile(); const text=await f.text(); const obj=extractExportArray(text,'ROUTES'); const data = safeEvalArrayLiteral(obj.body); routes = data; selectedId=routes[0]?.id||null; routesJsHandle=h; renderList(); renderForm(); alert('routes.js 불러오기 완료');
    }catch(e){ alert('불러오기 실패: '+e.message); }
  };
  wrap.querySelector('#btnWriteRoutesJs').onclick=async ()=>{
    try{ let h = routesJsHandle; if(!h){ h = await pickRoutesJs(); } if(!h) return; const ok = await writeRoutesToHandle(h); if(ok) alert('routes.js 파일에 적용되었습니다.'); }catch(e){ alert('쓰기 실패: '+e.message); }
  };
  // episodes/battles 쓰기(간단 직렬화)
  wrap.querySelector('#btnWriteEpisodesJs').onclick=async ()=>{
    try{
      let h = await getFileHandleFromDir('episodes.js');
      if(!h){ if(!window.showOpenFilePicker){ alert('파일 시스템 API 미지원'); return; } [h] = await window.showOpenFilePicker({ types:[{ description:'JavaScript', accept:{ 'text/javascript':['.js'] } }] }); }
      const body = JSON.stringify(state.data.episodes||episodes, null, 2);
      const text = `export const EPISODES = \n${body}\n;\n`;
      const w = await h.createWritable(); await w.write(text); await w.close(); alert('episodes.js 저장 완료');
    }catch(e){ alert('episodes.js 쓰기 실패: '+e.message); }
  };
  wrap.querySelector('#btnWriteBattlesJs').onclick=async ()=>{
    try{
      let h = await getFileHandleFromDir('battles.js');
      if(!h){ if(!window.showOpenFilePicker){ alert('파일 시스템 API 미지원'); return; } [h] = await window.showOpenFilePicker({ types:[{ description:'JavaScript', accept:{ 'text/javascript':['.js'] } }] }); }
      const body = JSON.stringify(state.data.battles||battles, null, 2);
      const text = `export const BATTLES = \n${body}\n;\n`;
      const w = await h.createWritable(); await w.write(text); await w.close(); alert('battles.js 저장 완료');
    }catch(e){ alert('battles.js 쓰기 실패: '+e.message); }
  };
  // flags 쓰기/리로드
  wrap.querySelector('#btnWriteFlagsJs').onclick=async ()=>{
    try{
      let h = await getFileHandleFromDir('flags.js');
      if(!h){ if(!window.showOpenFilePicker){ alert('파일 시스템 API 미지원'); return; } [h] = await window.showOpenFilePicker({ types:[{ description:'JavaScript', accept:{ 'text/javascript':['.js'] } }] }); }
      const text = stringifyFlagsJS(flags);
      const w = await h.createWritable(); await w.write(text); await w.close(); alert('flags.js 저장 완료');
    }catch(e){ alert('flags.js 쓰기 실패: '+e.message); }
  };
  wrap.querySelector('#btnReloadFlags').onclick=async ()=>{
    try{ const mod = await import(`../data/flags.js?ts=${Date.now()}`); flags = JSON.parse(JSON.stringify(mod.FLAGS||{})); alert('flags.js 모듈 리로드 완료'); }catch(e){ alert('리로드 실패: '+e.message); }
  };
  wrap.querySelector('#btnReloadRoutes').onclick=async ()=>{
    try{ const mod = await import(`../data/routes.js?ts=${Date.now()}`); state.data = state.data||{}; state.data.routes = mod.ROUTES; alert('routes.js 모듈 리로드 완료'); }catch(e){ alert('리로드 실패: '+e.message); }
  };
  wrap.querySelector('#btnReloadEpisodes').onclick=async ()=>{
    try{ const mod = await import(`../data/episodes.js?ts=${Date.now()}`); state.data = state.data||{}; state.data.episodes = mod.EPISODES; alert('episodes.js 모듈 리로드 완료'); }catch(e){ alert('리로드 실패: '+e.message); }
  };
  wrap.querySelector('#btnReloadBattles').onclick=async ()=>{
    try{
      const mod = await import(`../data/battles.js?ts=${Date.now()}`);
      state.data = state.data||{}; state.data.battles = mod.BATTLES;
      // 기존 캐시된 전투 상태 초기화(변경 반영)
      if(state.ui && state.ui.battleState){ delete state.ui.battleState; }
      alert('battles.js 모듈 리로드 완료(전투 상태 초기화)');
    }catch(e){ alert('리로드 실패: '+e.message); }
  };
  filterEl.oninput=()=> renderList();

  // init
  renderList();
  renderForm();
  drawGraph();
  root.innerHTML=''; root.appendChild(wrap);
  
  // CSS 스타일 추가 (DSL 에디터용)
  try{
    const dslStyleId = 'dslEditorStyles';
    if(!document.getElementById(dslStyleId)){
      const st = document.createElement('style'); st.id = dslStyleId;
      st.textContent = `
        .dsl-event { transition: all 0.2s ease; }
        .dsl-event:hover { background-color: rgba(43, 52, 80, 0.3); }
        .drag-handle { user-select: none; }
        .dsl-event .row { align-items: center; }
        
        /* 스크롤바 스타일링 */
        #dslEvents::-webkit-scrollbar, #epScene::-webkit-scrollbar, #epChoices::-webkit-scrollbar,
        [id*="DslEvents"]::-webkit-scrollbar, [id*="Scene"]::-webkit-scrollbar, [id*="Choices"]::-webkit-scrollbar {
          width: 8px;
        }
        
        #dslEvents::-webkit-scrollbar-track, #epScene::-webkit-scrollbar-track, #epChoices::-webkit-scrollbar-track,
        [id*="DslEvents"]::-webkit-scrollbar-track, [id*="Scene"]::-webkit-scrollbar-track, [id*="Choices"]::-webkit-scrollbar-track {
          background: #0f1524;
          border-radius: 4px;
        }
        
        #dslEvents::-webkit-scrollbar-thumb, #epScene::-webkit-scrollbar-thumb, #epChoices::-webkit-scrollbar-thumb,
        [id*="DslEvents"]::-webkit-scrollbar-thumb, [id*="Scene"]::-webkit-scrollbar-thumb, [id*="Choices"]::-webkit-scrollbar-thumb {
          background: #2b3450;
          border-radius: 4px;
        }
        
        #dslEvents::-webkit-scrollbar-thumb:hover, #epScene::-webkit-scrollbar-thumb:hover, #epChoices::-webkit-scrollbar-thumb:hover,
        [id*="DslEvents"]::-webkit-scrollbar-thumb:hover, [id*="Scene"]::-webkit-scrollbar-thumb:hover, [id*="Choices"]::-webkit-scrollbar-thumb:hover {
          background: #3b4566;
        }
        
        /* 스크롤 영역 내부 요소들 간격 조정 */
        #dslEvents > .dsl-event:first-child, #epScene > .row:first-child, #epChoices > .row:first-child,
        [id*="DslEvents"] > .dsl-event:first-child, [id*="Scene"] > .row:first-child, [id*="Choices"] > .row:first-child {
          margin-top: 0;
        }
      `;
      document.head.appendChild(st);
    }
  }catch{}
}



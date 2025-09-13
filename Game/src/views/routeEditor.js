import { ROUTES as CURRENT } from '../data/routes.js';
import { EPISODES as EP_CURRENT } from '../data/episodes.js';
import { BATTLES as BT_CURRENT } from '../data/battles.js';
import { FLAGS as FLAG_REG } from '../data/flags.js';

export function renderRouteEditorView(root, state){
  const wrap = document.createElement('section');
  wrap.className='panel';
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
    formEl.innerHTML = [
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
      </div>`,
      linkedEditorHTML(r.next||'')
    ].join('');
    formEl.querySelector('#btnBranchAdd').onclick=()=>{ const cur = collectBranches(); cur.push({to:'', label:''}); renderBranchList(cur); };
    // 요구조건 렌더
    renderReqList((r.requirements&&Array.isArray(r.requirements))? r.requirements : []);
    formEl.querySelector('#btnReqAdd').onclick=()=>{ const cur = collectReqFromDOM(); cur.push({ type:'flag', key:'', value:true }); renderReqList(cur); };
    // EP/BT 인라인 버튼 바인딩
    if((r.next||'').startsWith('EP-')){
      const epId = r.next;
      const btnLine = formEl.querySelector('#btnEpAddLine');
      const btnChoice = formEl.querySelector('#btnEpAddChoice');
      const btnParty = formEl.querySelector('#btnEpAddParty');
      if(btnLine){ btnLine.onclick=()=>{ const host=formEl.querySelector('#epScene'); const idx=host.querySelectorAll('.row').length; const div=document.createElement('div'); div.innerHTML=epLineRow({speaker:'', text:''}, idx); host.appendChild(div.firstChild); bindEpRowDeletes(); } }
      if(btnChoice){ btnChoice.onclick=()=>{ const host=formEl.querySelector('#epChoices'); const idx=host.querySelectorAll('.row').length; const div=document.createElement('div'); div.innerHTML=epChoiceRow({label:'', next:'', effects:[]}, idx); host.appendChild(div.firstChild); bindChoiceRowDeletes(); attachChoiceTemplateHandlers(); } }
      if(btnParty){ btnParty.onclick=()=>{ const host=formEl.querySelector('#epChoices'); const idx=host.querySelectorAll('.row').length; const unitId = (buildUnitOptions()[0]?.id)||'C-001'; const choice = { label:'동료 합류', next:'', effects:[{ type:'party.add', unit: unitId }] }; const div=document.createElement('div'); div.innerHTML=epChoiceRow(choice, idx); host.appendChild(div.firstChild); bindChoiceRowDeletes(); attachChoiceTemplateHandlers(); } }
      bindEpRowDeletes(); bindChoiceRowDeletes(); attachChoiceTemplateHandlers();
    }
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
    formEl.querySelectorAll('.ep_line_del').forEach(btn=>{ btn.onclick=()=>{ const row=btn.closest('.row'); row?.remove(); }; });
  }
  function bindChoiceRowDeletes(){
    formEl.querySelectorAll('.ep_ch_del').forEach(btn=>{ btn.onclick=()=>{ const row=btn.closest('.row'); row?.remove(); }; });
  }

  function attachChoiceTemplateHandlers(){
    const choiceRows = Array.from(formEl.querySelectorAll('#epChoices .row'));
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
          const keys = Object.keys(FLAG_REG||{});
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
      return `<div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between; align-items:center;"><strong>에피소드 편집: ${next}</strong><div class="row" style="gap:6px;"><button class="btn" id="btnEpAddLine">행 추가</button><button class="btn" id="btnEpAddChoice">선택 추가</button><button class="btn" id="btnEpAddParty">동료 추가</button></div></div>
        <div id="epScene">${(ep.scene||[]).map((ln,i)=> epLineRow(ln,i)).join('')}</div>
        <div style="margin-top:8px;"><strong>선택지</strong></div>
        <div id="epChoices">${(ep.choices||[]).map((c,i)=> epChoiceRow(c,i)).join('')}</div>
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
      return `<div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between; align-items:center;"><strong>전투 편집: ${next}</strong></div>
        ${inputRow('Seed','bt_seed', bt.seed||0)}
        ${inputRow('승리(next)','bt_win', winNext)}
        ${inputRow('패배(next)','bt_lose', loseNext)}
        <div style="margin-top:8px;"><strong>3x3 배치</strong></div>
        <div id="btBoard" class="col" style="gap:6px;">${board}</div>
      </div>`;
    }
    return `<div class="card" style="margin-top:8px;"><strong>엔딩/특수: ${next}</strong><div style="color:#9aa0a6; margin-top:4px;">특별한 편집 요소는 없습니다.</div></div>`;
  }
  function epLineRow(line, i){
    return `<div class="row" data-idx="${i}" style="gap:6px; margin-top:6px;">
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
    const sceneRows = Array.from(host.querySelectorAll('#epScene .row'));
    const scene = sceneRows.map(r=>({ speaker: r.querySelector('.ep_speaker')?.value||'', text: r.querySelector('.ep_text')?.value||'' }));
    const choiceRows = Array.from(host.querySelectorAll('#epChoices .row'));
    const choices = choiceRows.map(r=>{ let effects=[]; const raw=r.querySelector('.ep_effects')?.value||'[]'; try{ const v=JSON.parse(raw); if(Array.isArray(v)) effects=v; }catch{} return { label: r.querySelector('.ep_label')?.value||'', next: r.querySelector('.ep_next')?.value||'', effects }; });
    return { scene, choices };
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
    return { seed, winNext, loseNext, enemy };
  }

  function buildGraph(rs){
    const nodes = rs.map(r=>({ id:r.id, title:r.title, next:r.next, branches:r.branches||[] }));
    const edges = [];
    nodes.forEach(r=>{ (r.branches||[]).forEach(b=>{ if(b.to?.startsWith('R-')) edges.push({ from:r.id, to:b.to }); }); });
    nodes.forEach(r=>{ if((r.next||'').startsWith('R-')) edges.push({ from:r.id, to:r.next }); });
    return { nodes, edges };
  }
  function layout(graph){
    const xGap=260, yGap=120; const start=graph.nodes[0]?.id; const nexts={}; graph.edges.forEach(e=>{ (nexts[e.from] ||= []).push(e.to); });
    const xOf=new Map(), yOf=new Map(); const seen=new Set(); let cur=start; const main=[];
    while(cur && !seen.has(cur)){ seen.add(cur); main.push(cur); const n=graph.nodes.find(n=>n.id===cur); const nx=(n?.next||'').startsWith('R-')? n.next:null; cur=nx; }
    main.forEach((id,i)=> xOf.set(id,140+i*xGap));
    const assignX=(id)=>{ if(xOf.has(id)) return xOf.get(id); const parents=Object.keys(nexts).filter(k=> (nexts[k]||[]).includes(id)); const px=parents.length? (assignX(parents[0])+xGap) : 140; xOf.set(id,px); return px; };
    graph.nodes.forEach(n=> assignX(n.id));
    // push right to avoid overlap
    const shiftRight=(id,delta)=>{ const cur=xOf.get(id)||140; const nx=cur+delta; if(nx<=cur) return; xOf.set(id,nx); (nexts[id]||[]).forEach(to=>{ const need = xOf.get(id)+xGap-(xOf.get(to)||140); if(need>0) shiftRight(to,need); }); };
    graph.edges.forEach(e=>{ const need = (xOf.get(e.from)||140)+xGap - (xOf.get(e.to)||140); if(need>0) shiftRight(e.to, need); });
    // Y by DFS
    let cy=160; const dfs=(id)=>{ const kids=(nexts[id]||[]).filter(k=>k!==id); if(kids.length===0){ const y=cy; yOf.set(id,y); cy+=yGap; return y; } const ys=kids.map(dfs); const mid=Math.floor((Math.min(...ys)+Math.max(...ys))/2); yOf.set(id,mid); return mid; };
    if(start) dfs(start); graph.nodes.forEach(n=>{ if(!yOf.has(n.id)){ yOf.set(n.id, cy); cy+=yGap; }});
    return graph.nodes.map(n=>({ id:n.id, title:n.title, x:xOf.get(n.id)||140, y:yOf.get(n.id)||160 }));
  }
  function drawGraph(){
    const host = wrap.querySelector('#graph'); host.innerHTML='';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('route-graph'); svg.style.width='100%'; svg.style.height='100%';
    const g = buildGraph(routes); const nodes = layout(g); const content = document.createElementNS('http://www.w3.org/2000/svg','g'); svg.appendChild(content);
    const edges = g.edges; const mkPath=(ax,ay,bx,by)=>`M${ax+80},${ay} H${bx-80}`;
    edges.forEach(e=>{ const a=nodes.find(n=>n.id===e.from); const b=nodes.find(n=>n.id===e.to); if(!a||!b) return; const p=document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', mkPath(a.x,a.y,b.x,b.y)); p.setAttribute('class','edge'); content.appendChild(p); });
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

  // actions
  wrap.querySelector('#btnNew').onclick=()=>{ const nid = prompt('새 루트 ID(예: R-999)'); if(!nid) return; if(routes.find(r=>r.id===nid)){ alert('이미 존재'); return; } routes.push({ id:nid, title:nid, summary:'', requirements:[], next:'', branches:[] }); selectedId=nid; renderList(); renderForm(); };
  wrap.querySelector('#btnDelete').onclick=()=>{ if(!selectedId) return; if(!confirm(`${selectedId} 삭제?`)) return; routes = routes.filter(r=> r.id!==selectedId); selectedId = routes[0]?.id||null; renderList(); renderForm(); };
  wrap.querySelector('#btnValidate').onclick=()=> validate();
  wrap.querySelector('#btnPreview').onclick=()=> drawGraph();
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
}



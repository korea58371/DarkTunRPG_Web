import { SKILLS as CURRENT } from '../data/skills.js';

export function renderSkillEditorView(root, state){
  const wrap = document.createElement('section');
  wrap.className='panel';
  wrap.innerHTML = `
    <h2>스킬 에디터</h2>
    <div class="row" style="gap:12px; align-items:flex-start;">
      <div class="panel" style="min-width:320px; max-width:380px;">
        <div class="row" style="gap:6px;">
          <input id="filter" placeholder="검색(ID/이름)" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <button id="btnNew" class="btn">신규</button>
          <button id="btnDelete" class="btn danger">삭제</button>
        </div>
        <div id="list" style="margin-top:8px; max-height:560px; overflow:auto;"></div>
      </div>
      <div class="panel" style="flex:1;">
        <div id="form"></div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button id="btnAttach" class="btn">유닛에 부여</button>
          <button id="btnSave" class="btn primary">저장</button>
          <button id="btnApplyRuntime" class="btn accent">런타임 적용</button>
          <button id="btnStoreSave" class="btn">브라우저 저장</button>
          <button id="btnStoreLoad" class="btn">브라우저 불러오기</button>
          <button id="btnFileSave" class="btn">파일로 저장(JSON)</button>
          <button id="btnFileLoad" class="btn">파일에서 불러오기</button>
          <button id="btnLoadSkillsJs" class="btn">skills.js 불러오기</button>
          <button id="btnWriteSkillsJs" class="btn">skills.js 파일에 쓰기</button>
          <button id="btnReloadModule" class="btn">skills.js 모듈 리로드</button>
        </div>
      </div>
    </div>`;

  const listEl = wrap.querySelector('#list');
  const formEl = wrap.querySelector('#form');
  const filterEl = wrap.querySelector('#filter');
  let skills = JSON.parse(JSON.stringify(CURRENT||{}));
  let selectedId = Object.keys(skills)[0] || null;
  // 파일 시스템 핸들(한 번 설정해두고 계속 사용)
  let skillsJsHandle = null;

  // ---- IndexedDB 유틸(파일 핸들 저장용) ----
  function idbOpen(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open('skillEditorDB', 1);
      req.onupgradeneeded = ()=>{ try{ req.result.createObjectStore('handles'); }catch(_){} };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }
  async function idbGet(key){
    try{
      const db = await idbOpen();
      return await new Promise((resolve, reject)=>{
        const tx = db.transaction('handles');
        const st = tx.objectStore('handles');
        const r = st.get(key);
        r.onsuccess = ()=> resolve(r.result||null);
        r.onerror = ()=> reject(r.error);
      });
    }catch{ return null; }
  }
  async function idbSet(key, val){
    try{
      const db = await idbOpen();
      return await new Promise((resolve, reject)=>{
        const tx = db.transaction('handles','readwrite');
        const st = tx.objectStore('handles');
        const r = st.put(val, key);
        r.onsuccess = ()=> resolve();
        r.onerror = ()=> reject(r.error);
      });
    }catch{ /* noop */ }
  }
  async function initSavedHandle(){
    try{ skillsJsHandle = await idbGet('skillsJsHandle'); }catch{ skillsJsHandle=null; }
  }
  initSavedHandle();

  async function requestWritePermission(handle){
    if(!handle) return false;
    try{
      if(handle.requestPermission){
        const p = await handle.queryPermission?.({mode:'readwrite'}) || 'prompt';
        if(p==='granted') return true;
        const res = await handle.requestPermission({mode:'readwrite'});
        return res==='granted';
      }
      return true;
    }catch{ return false; }
  }
  async function pickSkillsJsHandle(){
    if(!window.showOpenFilePicker){ alert('이 브라우저는 파일 시스템 API를 지원하지 않습니다.'); return null; }
    const [handle] = await window.showOpenFilePicker({ types:[{ description:'JavaScript', accept:{ 'text/javascript':['.js'], 'application/javascript':['.js'] } }] });
    skillsJsHandle = handle; try{ await idbSet('skillsJsHandle', handle); }catch{}
    return handle;
  }
  async function writeSkillsToHandle(handle){
    try{
      if(!handle) return false;
      const ok = await requestWritePermission(handle); if(!ok){ alert('파일 쓰기 권한이 거부되었습니다.'); return false; }
      const file = await handle.getFile(); const src = await file.text();
      const obj = extractExportObject(src, 'SKILLS');
      const before = src.slice(0, obj.start);
      const afterStart = src.indexOf('\n', obj.end+1);
      const tail = afterStart>0 ? src.slice(afterStart) : '\n';
      const jsBlock = stringifySkillsJS(skills);
      const newText = before + jsBlock + tail;
      const writable = await handle.createWritable(); await writable.write(newText); await writable.close();
      return true;
    }catch(e){ alert('쓰기 실패: '+e.message); return false; }
  }

  function renderList(){
    const q = (filterEl.value||'').toLowerCase();
    const ids = Object.keys(skills).sort();
    listEl.innerHTML = ids.filter(id=>{
      const s = skills[id];
      return !q || id.toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q);
    }).map(id=>{
      const s = skills[id];
      const sel = (id===selectedId) ? ' style="border-color:#5cc8ff;"' : '';
      return `<div data-id="${id}" class="card"${sel}><strong>${s.name||id}</strong><div class="badge">${id}</div></div>`;
    }).join('');
    listEl.querySelectorAll('.card').forEach(el=>{
      el.onclick=()=>{ selectedId = el.dataset.id; renderList(); renderForm(); };
    });
  }

  function inputRow(label, id, value=''){
    return `<label class="row" style="gap:8px; align-items:center;"><div style="width:120px; color:#9aa0a6;">${label}</div><input id="${id}" value="${value??''}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/></label>`;
  }
  function selRow(label, id, options, value){
    const opts = options.map(o=>`<option value="${o}"${String(o)===String(value)?' selected':''}>${o}</option>`).join('');
    return `<label class="row" style="gap:8px; align-items:center;"><div style="width:120px; color:#9aa0a6;">${label}</div><select id="${id}" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${opts}</select></label>`;
  }
  function checkRow(label, id, checked){
    return `<label class="row" style="gap:8px; align-items:center;"><div style="width:120px; color:#9aa0a6;">${label}</div><input type="checkbox" id="${id}" ${checked?'checked':''}/></label>`;
  }
  function dirPills(idPrefix, selected=[]){
    const dirs = ['forward','back','up','down','upLeft','upRight','downLeft','downRight'];
    return `<div class="row" style="gap:6px; flex-wrap:wrap;">`+
      dirs.map(d=>`<label class="tag"><input type="checkbox" id="${idPrefix}_${d}" ${selected.includes(d)?'checked':''}/> ${d}</label>`).join('')+`</div>`;
  }

  function renderForm(){
    if(!selectedId){ formEl.innerHTML = '<div style="color:#9aa0a6;">좌측에서 스킬을 선택하거나 새로 만드세요.</div>'; return; }
    const s = skills[selectedId] || { id:selectedId };
    const move = s.move||{};
    const bleed = s.bleed||null;
    const upgrades = Array.isArray(s.upgrades)? s.upgrades : [];
    formEl.innerHTML = [
      inputRow('ID','f_id', s.id||selectedId),
      inputRow('이름','f_name', s.name||''),
      selRow('사거리(range)','f_range',['melee','ranged','ally','move'], s.range||'melee'),
      selRow('타입(type)','f_type',['strike','multi','row','line','poison','heal','regen','shield','move'], s.type||'strike'),
      inputRow('타수(hits)','f_hits', s.hits??1),
      inputRow('명중(acc 0~1)','f_acc', s.acc??1),
      inputRow('추가명중(accAdd 0~1)','f_accAdd', s.accAdd??0),
      inputRow('계수(coeff)','f_coeff', s.coeff??1),
      inputRow('MP(cost.mp)','f_mp', s.cost?.mp??0),
      selRow('피해속성(damageType)','f_damageType',['','slash','pierce','magic','blunt'], s.damageType||''),
      // Move section toggle + fields
      `<div class="card" style="margin-top:8px;">`+
      checkRow('이동 활성화','f_move_en', !!s.move)+
      `<div id="moveFields" style="display:${s.move?'block':'none'}; margin-top:8px;">`+
        selRow('이동 주체','f_move_who',['actor','target'], move.who||'actor')+
        selRow('방향(dir)','f_move_dir',['forward','back','up','down','upLeft','upRight','downLeft','downRight'], move.dir||'forward')+
        inputRow('칸수(tiles)','f_move_tiles', move.tiles??1)+
        checkRow('필수(required)','f_move_req', move.required!==false && !!s.move)+
        `<div style="margin:6px 0 0 120px;">허용 방향(allowedDirs)</div>`+
        `<div style="margin-left:120px;">${dirPills('f_move_allow', Array.isArray(move.allowedDirs)? move.allowedDirs: [])}</div>`+
      `</div></div>`+
      // Bleed section
      `<div class="card" style="margin-top:8px;">`+
      checkRow('출혈 효과','f_bleed_en', !!bleed)+
      `<div id="bleedFields" style="display:${bleed?'block':'none'}; margin-top:8px;">`+
        inputRow('확률(0~1)','f_bleed_ch', bleed?.chance??0.5)+
        inputRow('지속턴','f_bleed_du', bleed?.duration??3)+
        inputRow('계수(공격력 비율)','f_bleed_cf', bleed?.coeff??0.3)+
      `</div></div>`+
      // Upgrades section
      `<div class="card" style="margin-top:8px;">`+
      checkRow('업그레이드','f_up_en', upgrades.length>0)+
      `<div id="upFields" style="display:${upgrades.length>0?'block':'none'}; margin-top:8px;">`+
        `<div id="upList"></div>`+
        `<div class="row" style="justify-content:flex-end; margin-top:6px;"><button id="btnUpAdd" class="btn">항목 추가</button></div>`+
      `</div></div>`
    ].join('');

    // dynamic show/hide
    const mvChk = wrap.querySelector('#f_move_en');
    const mvBox = wrap.querySelector('#moveFields');
    mvChk.onchange=()=>{ mvBox.style.display = mvChk.checked? 'block':'none'; };
    const blChk = wrap.querySelector('#f_bleed_en');
    const blBox = wrap.querySelector('#bleedFields');
    blChk.onchange=()=>{ blBox.style.display = blChk.checked? 'block':'none'; };
    const upChk = wrap.querySelector('#f_up_en');
    const upBox = wrap.querySelector('#upFields');
    upChk.onchange=()=>{ upBox.style.display = upChk.checked? 'block':'none'; };

    // upgrades renderer
    const upListEl = wrap.querySelector('#upList');
    let __currentSkillId = s.id||selectedId;
    function defaultEffects(skillId, upId){
      const T={};
      // SK-01: 베기
      T['SK-01:SK01_ROW'] = [ { path:'type', op:'set', value:'row' }, { path:'to', op:'set', value:[1] } ];
      T['SK-01:SK01_DMG30'] = [ { path:'coeff', op:'mul', value:1.3 } ];
      T['SK-01:SK01_BLEED'] = [ { path:'bleed', op:'set', value:{ chance:1, duration:3, coeff:0.3 } } ];
      // SK-13: 검막
      T['SK-13:SK13_SHIELD5'] = [ { path:'amount', op:'add', value:5 } ];
      T['SK-13:SK13_BLOCK50'] = [ { path:'_blockBonus', op:'add', value:0.5 } ];
      T['SK-13:SK13_COUNTER'] = [ { path:'_counterOnBlock', op:'set', value:true } ];
      return T[`${skillId}:${upId}`] || null;
    }
    const PATH_OPTS = ['coeff','type','to','damageType','acc','accAdd','hits','amount','move.who','move.dir','move.tiles','move.required','bleed','_blockBonus','_counterOnBlock'];
    const TYPE_OPTS = ['strike','multi','row','line','poison','heal','regen','shield','move'];
    const DMGTYPE_OPTS = ['slash','pierce','magic','blunt'];
    const DIR_OPTS = ['forward','back','up','down','upLeft','upRight','downLeft','downRight'];
    function effectValueEditorHTML(path, val, idx, eIdx){
      const sel = (opts, v, cls)=>`<select class="${cls}" data-idx="${idx}" data-eidx="${eIdx}" style="padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${opts.map(o=>`<option value="${o}"${String(o)===String(v)?' selected':''}>${o}</option>`).join('')}</select>`;
      const num = (v, cls)=>`<input type="number" step="any" class="${cls}" data-idx="${idx}" data-eidx="${eIdx}" value="${Number(v??0)}" style="width:120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
      const txt = (v, cls)=>`<input class="${cls}" data-idx="${idx}" data-eidx="${eIdx}" value='${(v==null?'':(typeof v==='object'? JSON.stringify(v) : String(v)))}' style="flex:1; min-width:200px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>`;
      const chk = (v, cls)=>`<label class="row" style="gap:6px; align-items:center;"><input type="checkbox" class="${cls}" data-idx="${idx}" data-eidx="${eIdx}" ${v?'checked':''}/> <span style="color:#9aa0a6;">true/false</span></label>`;
      if(path==='bleed'){
        const b = (val&&typeof val==='object')? val : { chance:1, duration:3, coeff:0.3 };
        return `<div class="row" style="gap:6px; align-items:center;">
          <label class="row" style="gap:4px; align-items:center; color:#9aa0a6;">확률 ${num(b.chance,'eff_val_bleed_ch')}</label>
          <label class="row" style="gap:4px; align-items:center; color:#9aa0a6;">지속 ${num(b.duration,'eff_val_bleed_du')}</label>
          <label class="row" style="gap:4px; align-items:center; color:#9aa0a6;">계수 ${num(b.coeff,'eff_val_bleed_cf')}</label>
        </div>`;
      }
      if(path==='damageType') return sel(DMGTYPE_OPTS, val, 'eff_val_sel');
      if(path==='type') return sel(TYPE_OPTS, val, 'eff_val_sel');
      if(path==='move.dir') return sel(DIR_OPTS, val, 'eff_val_sel');
      if(path==='move.who') return sel(['actor','target'], val, 'eff_val_sel');
      if(path==='move.required' || path==='_counterOnBlock') return chk(!!val, 'eff_val_chk');
      if(['coeff','acc','accAdd','hits','amount','_blockBonus','move.tiles'].includes(path)) return num(val, 'eff_val_num');
      // complex/array/object paths (to, bleed, etc.)
      return txt(val, 'eff_val_text');
    }
    function effectRow(eff, idx, eIdx){
      const opSel = ['set','add','mul'].map(o=>`<option value="${o}"${(eff?.op||'set')===o?' selected':''}>${o}</option>`).join('');
      const pathSel = PATH_OPTS.map(p=>`<option value="${p}"${(eff?.path||'')===p?' selected':''}>${p}</option>`).join('');
      const valHTML = effectValueEditorHTML(eff?.path||'coeff', eff?.value, idx, eIdx);
      return `<div class="row eff" data-idx="${idx}" data-eidx="${eIdx}" style="gap:6px; margin-top:6px; align-items:center;">
        <select class="eff_path" style="flex:0 0 160px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${pathSel}</select>
        <select class="eff_op" style="flex:0 0 80px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${opSel}</select>
        <div class="eff_val" style="display:flex; gap:6px; align-items:center;">${valHTML}</div>
        <button class="btn danger eff_del">삭제</button>
      </div>`;
    }
    function summarizeEffects(effects){
      if(!Array.isArray(effects) || !effects.length) return '효과 없음';
      return effects.map(e=>{
        if(e.path==='bleed' && e.value && typeof e.value==='object'){
          const b=e.value; return `bleed ${e.op||'set'} {ch:${b.chance}, du:${b.duration}, cf:${b.coeff}}`;
        }
        return `${e.path||'?'} ${e.op||'set'} ${(typeof e.value==='object')? JSON.stringify(e.value) : e.value}`;
      }).join(' · ');
    }
    function upRow(u, idx){
      const typeSel = ['once','stack'].map(t=>`<option value="${t}"${(u?.type||'once')===t?' selected':''}>${t}</option>`).join('');
      const summary = summarizeEffects(u?.effects||[]);
      return `<div class="card" data-idx="${idx}" style="margin-bottom:6px;">`+
        `<div class="row" style="gap:6px; align-items:center;">
          <input placeholder="id" value="${u?.id||''}" class="up_id" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <input placeholder="name" value="${u?.name||''}" class="up_name" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <select class="up_type" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${typeSel}</select>
          <input placeholder="desc" value="${u?.desc||''}" class="up_desc" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <button class="btn danger up_del">삭제</button>
        </div>`+
        `<div class="badge" style="margin-top:4px; color:#9aa0a6;">${summary}</div>`+
        `<div id="effList-${idx}"></div>`+
        `<div class="row" style="justify-content:flex-end; margin-top:6px;"><button class="btn eff_add">효과 추가</button></div>`+
      `</div>`;
    }
    function renderUpList(arr){
      // 프리필: effects가 비어 있으면 기본 템플릿을 자동 채움(있을 때는 유지)
      (arr||[]).forEach(u=>{ if(!Array.isArray(u.effects) || u.effects.length===0){ const d=defaultEffects(__currentSkillId, u.id); if(d) u.effects = JSON.parse(JSON.stringify(d)); } });
      upListEl.innerHTML = (arr||[]).map((u,i)=> upRow(u,i)).join('');
      // render effects for each upgrade
      (arr||[]).forEach((u,i)=>{
        const host = upListEl.querySelector(`#effList-${i}`);
        if(!host) return;
        const list = Array.isArray(u.effects)? u.effects : [];
        host.innerHTML = list.map((e,ei)=> effectRow(e,i,ei)).join('');
      });
      upListEl.querySelectorAll('.up_del').forEach((btn, i)=>{
        btn.onclick=()=>{ const cur = collectUpgrades(); cur.splice(i,1); renderUpList(cur); };
      });
      upListEl.querySelectorAll('.eff_del').forEach(el=>{
        el.onclick=()=>{ const i = Number(el.closest('.eff')?.dataset.idx||'0'); const ei = Number(el.closest('.eff')?.dataset.eidx||'0'); const cur = collectUpgrades(); (cur[i].effects||[]).splice(ei,1); renderUpList(cur); };
      });
      upListEl.querySelectorAll('.eff_add').forEach((btn, i)=>{
        btn.onclick=()=>{ const cur = collectUpgrades(); const list = cur[i].effects = Array.isArray(cur[i].effects)? cur[i].effects : []; list.push({ path:'coeff', op:'mul', value:1.0 }); renderUpList(cur); };
      });
      // react to path change → regenerate value editor to suit enum/number/boolean
      upListEl.querySelectorAll('.eff_path').forEach(sel=>{
        sel.onchange=(e)=>{
          const effDiv = sel.closest('.eff'); const idx = Number(effDiv.dataset.idx); const ei = Number(effDiv.dataset.eidx);
          const path = sel.value; const cur = collectUpgrades(); const eff = (cur[idx].effects||[])[ei] || { path, op:'set', value:null }; eff.path = path;
          const container = effDiv.querySelector('.eff_val');
          container.innerHTML = effectValueEditorHTML(path, eff.value, idx, ei);
        };
      });
      // 값 입력 반영(숫자/셀렉트/체크/블리드 서브필드)
      const rebindCollect = ()=>{
        upListEl.querySelectorAll('.eff_val_sel').forEach(el=>{ el.onchange=()=>{/* no-op; 수집시 읽음 */}; });
        upListEl.querySelectorAll('.eff_val_num').forEach(el=>{ el.oninput=()=>{}; });
        upListEl.querySelectorAll('.eff_val_chk').forEach(el=>{ el.onchange=()=>{}; });
        // bleed 세부 필드 변경시 즉시 내부 모델에 반영
        ['bleed_ch','bleed_du','bleed_cf'].forEach(suf=>{
          upListEl.querySelectorAll(`.eff_val_${suf}`).forEach(inp=>{
            inp.oninput=()=>{
              const idx = Number(inp.dataset.idx||'0'); const ei = Number(inp.dataset.eidx||'0');
              const cur = collectUpgrades();
              const eff = (cur[idx].effects||[])[ei]; if(!eff) return;
              const b = (eff.value && typeof eff.value==='object')? eff.value : { chance:1, duration:3, coeff:0.3 };
              if(suf==='bleed_ch') b.chance = Number(inp.value||'0');
              if(suf==='bleed_du') b.duration = Number(inp.value||'0');
              if(suf==='bleed_cf') b.coeff = Number(inp.value||'0');
              eff.value = b; // keep object
            };
          });
        });
      };
      rebindCollect();
    }
    function collectUpgrades(){
      const rows = Array.from(upListEl.querySelectorAll('.card'));
      return rows.map(row=>{
        const idx = Number(row.dataset.idx||'0');
        const up = {
          id: row.querySelector('.up_id')?.value?.trim()||'',
          name: row.querySelector('.up_name')?.value?.trim()||'',
          type: row.querySelector('.up_type')?.value||'once',
          desc: row.querySelector('.up_desc')?.value?.trim()||'',
          effects: []
        };
        const effRows = Array.from(row.querySelectorAll('.eff'));
        effRows.forEach(er=>{
          const path = er.querySelector('.eff_path')?.value||'';
          const op = er.querySelector('.eff_op')?.value||'set';
          let value = null;
          const sel = er.querySelector('.eff_val_sel');
          const num = er.querySelector('.eff_val_num');
          const chk = er.querySelector('.eff_val_chk');
          const text = er.querySelector('.eff_val_text');
          // bleed 복합 값 읽기
          const bCh = er.querySelector('.eff_val_bleed_ch');
          const bDu = er.querySelector('.eff_val_bleed_du');
          const bCf = er.querySelector('.eff_val_bleed_cf');
          if(bCh || bDu || bCf){
            value = {
              chance: Number(bCh?.value||'1'),
              duration: Number(bDu?.value||'3'),
              coeff: Number(bCf?.value||'0.3')
            };
          }
          if(sel) value = sel.value;
          else if(num) value = Number(num.value||'0');
          else if(chk) value = !!chk.checked;
          else if(text){ try{ value = JSON.parse(text.value); }catch{ value = text.value; } }
          up.effects.push({ path, op, value });
        });
        return up;
      }).filter(u=> u.id && u.name);
    }
    wrap.querySelector('#btnUpAdd').onclick=()=>{ const cur = collectUpgrades(); cur.push({ id:'', name:'', type:'once', desc:'' }); renderUpList(cur); };
    renderUpList(upgrades);
  }

  function collect(){
    const get = id=> wrap.querySelector('#'+id)?.value;
    try{
      const id = get('f_id').trim();
      const name = get('f_name').trim();
      const range = get('f_range').trim();
      const type = get('f_type').trim();
      const hits = Number(get('f_hits'))||1;
      const acc = Number(get('f_acc'))||1;
      const accAdd = Number(get('f_accAdd'))||0;
      const coeff = Number(get('f_coeff'))||1;
      const mp = Number(get('f_mp'))||0;
      const damageType = (get('f_damageType')||'').trim() || undefined;
      const sk = { id, name, range, type, hits, acc, accAdd, coeff, cost:{ mp }, damageType };
      // move
      const mvEn = wrap.querySelector('#f_move_en')?.checked;
      if(mvEn){
        const who = wrap.querySelector('#f_move_who')?.value||'actor';
        const dir = wrap.querySelector('#f_move_dir')?.value||'forward';
        const tiles = Number(wrap.querySelector('#f_move_tiles')?.value||'1');
        const req = !!wrap.querySelector('#f_move_req')?.checked;
        const dirs = ['forward','back','up','down','upLeft','upRight','downLeft','downRight'].filter(d=> wrap.querySelector(`#f_move_allow_${d}`)?.checked);
        sk.move = { who, dir, tiles, required:req };
        if(dirs.length) sk.move.allowedDirs = dirs;
      }
      // bleed
      const blEn = wrap.querySelector('#f_bleed_en')?.checked;
      if(blEn){
        const chance = Number(wrap.querySelector('#f_bleed_ch')?.value||'0.5');
        const duration = Number(wrap.querySelector('#f_bleed_du')?.value||'3');
        const coeff = Number(wrap.querySelector('#f_bleed_cf')?.value||'0.3');
        sk.bleed = { chance, duration, coeff };
      }
      // upgrades
      const upEn = wrap.querySelector('#f_up_en')?.checked;
      if(upEn){
        const rows = Array.from(wrap.querySelectorAll('#upList .card'));
        const ups = rows.map(row=>{
          const up = {
            id: row.querySelector('.up_id')?.value?.trim()||'',
            name: row.querySelector('.up_name')?.value?.trim()||'',
            type: row.querySelector('.up_type')?.value||'once',
            desc: row.querySelector('.up_desc')?.value?.trim()||'',
            effects: []
          };
          const effRows = Array.from(row.querySelectorAll('.eff'));
          effRows.forEach(er=>{
            const path = er.querySelector('.eff_path')?.value||'';
            const op = er.querySelector('.eff_op')?.value||'set';
            let value = null;
            // bleed 복합 값 우선
            const bCh = er.querySelector('.eff_val_bleed_ch');
            const bDu = er.querySelector('.eff_val_bleed_du');
            const bCf = er.querySelector('.eff_val_bleed_cf');
            if(bCh || bDu || bCf){
              value = { chance: Number(bCh?.value||'1'), duration: Number(bDu?.value||'3'), coeff: Number(bCf?.value||'0.3') };
            } else {
              const sel = er.querySelector('.eff_val_sel');
              const num = er.querySelector('.eff_val_num');
              const chk = er.querySelector('.eff_val_chk');
              const text = er.querySelector('.eff_val_text');
              if(sel) value = sel.value;
              else if(num) value = Number(num.value||'0');
              else if(chk) value = !!chk.checked;
              else if(text){ try{ value = JSON.parse(text.value); }catch{ value = text.value; } }
            }
            up.effects.push({ path, op, value });
          });
          return up;
        }).filter(u=> u.id && u.name);
        if(ups.length) sk.upgrades = ups;
      }
      return sk;
    }catch(e){ alert('입력 값 오류: '+e.message); throw e; }
  }

  wrap.querySelector('#btnNew').onclick=()=>{
    const nid = prompt('새 스킬 ID(예: SK-99)');
    if(!nid) return; if(skills[nid]){ alert('이미 존재합니다'); return; }
    skills[nid] = { id:nid, name:nid, range:'melee', type:'strike', hits:1, acc:1, coeff:1, cost:{mp:0} };
    selectedId = nid; renderList(); renderForm();
  };
  wrap.querySelector('#btnDelete').onclick=()=>{
    if(!selectedId) return; if(!confirm(`${selectedId} 삭제?`)) return; delete skills[selectedId]; selectedId=null; renderList(); renderForm();
  };
  wrap.querySelector('#btnSave').onclick=async ()=>{
    if(!selectedId) return; const sk = collect(); skills[sk.id] = sk; if(sk.id!==selectedId){ delete skills[selectedId]; selectedId=sk.id; }
    // 우선 설정된 skills.js 경로가 있으면 바로 덮어쓰기
    let handle = skillsJsHandle || await idbGet('skillsJsHandle');
    if(handle){ skillsJsHandle = handle; const ok = await writeSkillsToHandle(handle); if(ok){ alert('skills.js에 저장되었습니다.'); return; } }
    // 없으면 JSON 다운로드 + 안내
    const blob = new Blob([JSON.stringify(skills, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skills_export.json'; a.click(); URL.revokeObjectURL(a.href);
    alert('skills.js 저장 경로가 설정되지 않았습니다. "skills.js 불러오기"로 경로를 지정하면 다음부터 버튼 한 번으로 저장됩니다.');
  };
  wrap.querySelector('#btnAttach').onclick=()=>{
    const uid = prompt('부여할 유닛 ID(예: C-001)'); if(!uid) return;
    const sid = selectedId; if(!sid) return;
    state.ui = state.ui || {}; state.ui.__skillEditorAttach = { unitId: uid, skillId: sid };
    alert(`부여 요청 기록됨: ${uid} ⇐ ${sid}. 별도 병합 도구로 반영하세요.`);
  };
  // 런타임 즉시 적용: 현재 에디터의 내용을 상태에 머지
  wrap.querySelector('#btnApplyRuntime').onclick=()=>{
    try{
      state.data = state.data || {}; state.data.skills = state.data.skills || {};
      state.data.skills = Object.assign({}, state.data.skills, skills);
      alert('현재 런타임 데이터에 적용되었습니다. (메모리 반영)');
    }catch(e){ alert('적용 중 오류: '+e.message); }
  };
  // 브라우저 저장/불러오기(localStorage)
  wrap.querySelector('#btnStoreSave').onclick=()=>{
    try{ localStorage.setItem('dev.skillsOverrides', JSON.stringify(skills)); alert('브라우저 저장 완료(localStorage)'); }catch(e){ alert('저장 실패: '+e.message); }
  };
  wrap.querySelector('#btnStoreLoad').onclick=()=>{
    try{ const s = localStorage.getItem('dev.skillsOverrides'); if(!s){ alert('저장된 데이터가 없습니다'); return; } skills = JSON.parse(s); selectedId = Object.keys(skills)[0]||null; renderList(); renderForm(); alert('불러오기 완료'); }catch(e){ alert('불러오기 실패: '+e.message); }
  };
  // 파일 저장/불러오기(File System Access API 또는 다운로드/업로드)
  wrap.querySelector('#btnFileSave').onclick=async ()=>{
    const blob = new Blob([JSON.stringify(skills, null, 2)], { type:'application/json' });
    if(window.showSaveFilePicker){
      try{
        const handle = await window.showSaveFilePicker({ suggestedName:'skills_override.json', types:[{ description:'JSON', accept:{ 'application/json':['.json'] } }] });
        const stream = await handle.createWritable(); await stream.write(blob); await stream.close(); alert('파일 저장 완료');
      }catch(e){ if(e.name!=='AbortError') alert('파일 저장 실패: '+e.message); }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skills_override.json'; a.click(); URL.revokeObjectURL(a.href);
    }
  };
  wrap.querySelector('#btnFileLoad').onclick=async ()=>{
    try{
      if(window.showOpenFilePicker){
        const [handle] = await window.showOpenFilePicker({ types:[{ description:'JSON', accept:{ 'application/json':['.json'] } }] });
        const file = await handle.getFile(); const text = await file.text(); skills = JSON.parse(text); selectedId = Object.keys(skills)[0]||null; renderList(); renderForm(); alert('파일 불러오기 완료');
      } else {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='.json,application/json'; inp.onchange=async ()=>{ const file=inp.files[0]; const text = await file.text(); skills = JSON.parse(text); selectedId = Object.keys(skills)[0]||null; renderList(); renderForm(); alert('파일 불러오기 완료'); }; inp.click();
      }
    }catch(e){ if(e.name!=='AbortError') alert('불러오기 실패: '+e.message); }
  };

  // === JS 파일 직접 읽기/쓰기 (File System Access API) ===
  function extractExportObject(source, exportName){
    const key = `export const ${exportName} = {`;
    const start = source.indexOf(key);
    if(start < 0) throw new Error(`${exportName} export not found`);
    const head = start + key.length; let i=head, depth=1;
    while(i < source.length && depth>0){ const ch=source[i++]; if(ch==='{' ) depth++; else if(ch=== '}') depth--; }
    const end = i-1;
    const body = source.slice(head, end);
    return { start, head, end, body, key };
  }
  function safeEvalObjectLiteral(text){
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return ({${text}});`)();
  }
  function stringifySkillsJS(sk){
    const ids = Object.keys(sk).sort();
    const q = (s)=> `'${String(s)}'`;
    const lines = ids.map(id=>{
      const s = sk[id]||{}; const kv=[]; const push=(k,v)=>{ if(v!==undefined) kv.push(`${k}:${v}`); };
      push('id', q(s.id||id)); push('name', q(s.name||id));
      if(s.range) push('range', q(s.range));
      if(s.type) push('type', q(s.type));
      if(s.hits!=null) push('hits', String(s.hits));
      if(s.acc!=null) push('acc', String(s.acc));
      if(s.accAdd!=null) push('accAdd', String(s.accAdd));
      if(s.coeff!=null) push('coeff', String(s.coeff));
      if(s.cost && s.cost.mp!=null) push('cost', `{mp:${s.cost.mp}}`);
      if(s.shout) push('shout', q(s.shout));
      if(s.damageType) push('damageType', q(s.damageType));
      if(s.duration!=null) push('duration', String(s.duration));
      if(s.dotPct!=null) push('dotPct', String(s.dotPct));
      if(s.amount!=null) push('amount', String(s.amount));
      if(s.move){ const m=s.move; const parts=[]; if(m.who) parts.push(`who:${q(m.who)}`); if(m.dir) parts.push(`dir:${q(m.dir)}`); if(m.tiles!=null) parts.push(`tiles:${m.tiles}`); if(m.required!=null) parts.push(`required:${m.required?'true':'false'}`); if(Array.isArray(m.allowedDirs)) parts.push(`allowedDirs:[${m.allowedDirs.map(q).join(',')}]`); push('move', `{${parts.join(', ')}}`); }
      if(s.bleed){ const b=s.bleed; push('bleed', `{ chance:${b.chance??0.5}, duration:${b.duration??3}, coeff:${b.coeff??0.3} }`); }
      if(Array.isArray(s.upgrades)){
        const up = s.upgrades.map(u=>`{ id:${q(u.id)}, name:${q(u.name)}, desc:${q(u.desc||'')}, type:${q(u.type||'once')}${Array.isArray(u.effects)?`, effects:[${u.effects.map(e=>`{ path:${q(e.path)}, op:${q(e.op||'set')}, value:${JSON.stringify(e.value)} }`).join(', ')}]`:''} }`).join(', ');
        push('upgrades', `[${up}]`);
      }
      return `  ${q(id)}: { ${kv.join(', ')} }`;
    }).join(',\n');
    return `export const SKILLS = {\n${lines}\n};\n`;
  }
  wrap.querySelector('#btnLoadSkillsJs').onclick=async ()=>{
    try{
      if(!window.showOpenFilePicker){ alert('이 브라우저는 파일 시스템 API를 지원하지 않습니다.'); return; }
      const [handle] = await window.showOpenFilePicker({ types:[{ description:'JavaScript', accept:{ 'text/javascript':['.js'], 'application/javascript':['.js'] } }] });
      const file = await handle.getFile(); const text = await file.text();
      const obj = extractExportObject(text, 'SKILLS');
      const data = safeEvalObjectLiteral(obj.body);
      skills = data; selectedId = Object.keys(skills)[0]||null; skillsJsHandle = handle; try{ await idbSet('skillsJsHandle', handle); }catch{}
      renderList(); renderForm(); alert('skills.js 불러오기 완료(저장 경로도 설정됨)');
    }catch(e){ if(e.name!=='AbortError') alert('불러오기 실패: '+e.message); }
  };
  wrap.querySelector('#btnWriteSkillsJs').onclick=async ()=>{
    try{
      // 저장 경로가 있으면 그대로 사용, 없으면 한 번만 선택
      let handle = skillsJsHandle || await idbGet('skillsJsHandle');
      if(!handle){ handle = await pickSkillsJsHandle(); }
      if(!handle) return;
      const ok = await writeSkillsToHandle(handle);
      if(ok){ skillsJsHandle = handle; try{ await idbSet('skillsJsHandle', handle); }catch{} alert('skills.js 파일에 적용되었습니다.'); }
    }catch(e){ if(e.name!=='AbortError') alert('쓰기 실패: '+e.message); }
  };
  // 동적 import로 브라우저에 로드된 모듈을 강제 리로드하여 런타임 데이터 갱신
  wrap.querySelector('#btnReloadModule').onclick=async ()=>{
    try{
      const mod = await import(`../data/skills.js?ts=${Date.now()}`);
      state.data = state.data || {}; state.data.skills = mod.SKILLS;
      alert('skills.js 모듈을 다시 불러와 런타임에 적용했습니다.');
    }catch(e){ alert('리로드 실패: '+e.message); }
  };
  filterEl.oninput=()=> renderList();

  renderList();
  renderForm();
  root.innerHTML=''; root.appendChild(wrap);
}



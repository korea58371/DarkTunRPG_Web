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
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button id="btnAttach" class="btn">유닛에 부여</button>
          <button id="btnSave" class="btn primary">저장</button>
        </div>
      </div>
    </div>`;

  const listEl = wrap.querySelector('#list');
  const formEl = wrap.querySelector('#form');
  const filterEl = wrap.querySelector('#filter');
  let skills = JSON.parse(JSON.stringify(CURRENT||{}));
  let selectedId = Object.keys(skills)[0] || null;

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
      inputRow('피해속성(damageType)','f_damageType', s.damageType||''),
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
    function upRow(u, idx){
      const typeSel = ['once','stack'].map(t=>`<option value="${t}"${(u?.type||'once')===t?' selected':''}>${t}</option>`).join('');
      return `<div class="card" data-idx="${idx}" style="margin-bottom:6px;">`+
        `<div class="row" style="gap:6px; align-items:center;">
          <input placeholder="id" value="${u?.id||''}" class="up_id" style="flex:0 0 120px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <input placeholder="name" value="${u?.name||''}" class="up_name" style="flex:0 0 140px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <select class="up_type" style="flex:0 0 100px; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;">${typeSel}</select>
          <input placeholder="desc" value="${u?.desc||''}" class="up_desc" style="flex:1; padding:6px 8px; background:#0f1524; border:1px solid #2b3450; color:#cbd5e1; border-radius:6px;"/>
          <button class="btn danger up_del">삭제</button>
        </div>`+
      `</div>`;
    }
    function renderUpList(arr){
      upListEl.innerHTML = (arr||[]).map((u,i)=> upRow(u,i)).join('');
      upListEl.querySelectorAll('.up_del').forEach((btn, i)=>{
        btn.onclick=()=>{ const cur = collectUpgrades(); cur.splice(i,1); renderUpList(cur); };
      });
    }
    function collectUpgrades(){
      const rows = Array.from(upListEl.querySelectorAll('.card'));
      return rows.map(row=>({
        id: row.querySelector('.up_id')?.value?.trim()||'',
        name: row.querySelector('.up_name')?.value?.trim()||'',
        type: row.querySelector('.up_type')?.value||'once',
        desc: row.querySelector('.up_desc')?.value?.trim()||''
      })).filter(u=> u.id && u.name);
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
        const ups = rows.map(row=>({ id: row.querySelector('.up_id')?.value?.trim()||'', name: row.querySelector('.up_name')?.value?.trim()||'', type: row.querySelector('.up_type')?.value||'once', desc: row.querySelector('.up_desc')?.value?.trim()||'' })).filter(u=> u.id && u.name);
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
  wrap.querySelector('#btnSave').onclick=()=>{
    if(!selectedId) return; const sk = collect(); skills[sk.id] = sk; if(sk.id!==selectedId){ delete skills[selectedId]; selectedId=sk.id; }
    // 파일로 저장은 브라우저에서 직접 못하므로, JSON을 다운로드하고 유틸로 병합하거나, 임시로 콘솔에 출력
    const blob = new Blob([JSON.stringify(skills, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skills_export.json'; a.click(); URL.revokeObjectURL(a.href);
    alert('skills_export.json 다운로드 완료. utils/skillTool.js로 병합하거나, 수동 반영하세요.');
  };
  wrap.querySelector('#btnAttach').onclick=()=>{
    const uid = prompt('부여할 유닛 ID(예: C-001)'); if(!uid) return;
    const sid = selectedId; if(!sid) return;
    state.ui = state.ui || {}; state.ui.__skillEditorAttach = { unitId: uid, skillId: sid };
    alert(`부여 요청 기록됨: ${uid} ⇐ ${sid}. 별도 병합 도구로 반영하세요.`);
  };
  filterEl.oninput=()=> renderList();

  renderList();
  renderForm();
  root.innerHTML=''; root.appendChild(wrap);
}



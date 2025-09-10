export function renderPartyView(root, state){
  const wrap = document.createElement('section');
  wrap.className='panel';
  wrap.innerHTML = `<h2>부대 정비</h2>`;

  // ensure 3x3 slots array
  if(!Array.isArray(state.party.members) || state.party.members.length!==9){
    state.party.members = (state.party.members||[]).slice(0,9);
    while(state.party.members.length<9) state.party.members.push(null);
  }

  const layout = document.createElement('div');
  layout.className='row';

  const leftCol = document.createElement('div');
  leftCol.className='col';
  const rightCol = document.createElement('div');
  rightCol.className='col';

  // ===== Roster =====
  const roster = document.createElement('div');
  roster.className='panel';
  roster.innerHTML = `<h3>보유 캐릭터</h3>`;
  const list = document.createElement('div');
  list.className='list';
  Object.values(state.data.units)
    .filter(u=>u.id.startsWith('C-'))
    .filter(u=> !!state.ownedUnits?.[u.id]) // 보유 중인 동료만 노출
    .forEach(u=>{
    const inParty = state.party.members.includes(u.id);
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `<div class="portrait"></div><div class="col"><strong>${u.name}</strong><span class="badge">HP ${u.hp} · MP ${u.mp} · SPD ${u.spd}</span></div>`;

    // select for detail
    row.onclick=()=>{ renderDetail(u.id); };

    // drag support from roster
    row.draggable = true;
    row.ondragstart=(e)=>{ e.dataTransfer.setData('text/plain', JSON.stringify({ type:'unit', id:u.id })); };

    const btn = document.createElement('button');
    btn.className = inParty ? 'btn danger' : 'btn';
    btn.textContent = inParty ? '제외' : '추가';
    btn.onclick=(ev)=>{
      ev.stopPropagation();
      if(inParty){
        const idx = state.party.members.findIndex(m=>m===u.id);
        if(idx>=0) state.party.members[idx]=null;
      } else {
        if(state.party.members.includes(u.id)) return; // guard
        for(let r=1;r<=3;r++){
          const empty = findEmptySlot(state, r);
          if(empty){ state.party.members[empty.index] = u.id; state.party.positions[u.id] = r; break; }
        }
      }
      renderPartyView(root, state);
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
  roster.appendChild(list);

  // ===== Formation =====
  const formation = document.createElement('div');
  formation.className='panel';
  formation.innerHTML = `<h3>진형(전열/중열/후열 · 3×3)</h3>
    <div class="row">
      <div class="col"><strong>후열</strong><div class="row" id="row3"></div></div>
      <div class="col"><strong>중열</strong><div class="row" id="row2"></div></div>
      <div class="col"><strong>전열</strong><div class="row" id="row1"></div></div>
    </div>`;

  for(let r=1;r<=3;r++){
    const rowEl = formation.querySelector(`#row${r}`);
    for(let c=0;c<3;c++){
      const cell = document.createElement('div');
      const idx = slotIndex(r,c);
      const memberId = state.party.members[idx];
      const occupied = !!memberId;
      cell.className = `rank ${occupied?'occupied':'empty'}`;
      cell.textContent = memberId ? (state.data.units[memberId]?.name||memberId) : `${r}-${c+1}`;

      // show details when clicking a slot
      cell.addEventListener('click',()=>{ if(memberId) renderDetail(memberId); else renderDetail(null); });

      // DnD target visual
      cell.addEventListener('dragenter',(e)=>{
        const raw = e.dataTransfer.getData('text/plain');
        let data = {};
        try{ data = JSON.parse(raw||'{}'); }catch{ data={}; }
        let eligible=false;
        if(data.type==='unit' && data.id && !state.party.members.includes(data.id)) eligible=true;
        if(data.type==='slot' && typeof data.index==='number' && data.index!==idx) eligible=true;
        if(eligible) cell.classList.add('droppable');
      });
      cell.addEventListener('dragleave',()=>{ cell.classList.remove('droppable'); });

      // DnD target behavior
      cell.ondragover=(e)=>{ e.preventDefault(); };
      cell.ondrop=(e)=>{
        e.preventDefault();
        cell.classList.remove('droppable');
        const data = JSON.parse(e.dataTransfer.getData('text/plain')||'{}');
        if(data.type==='unit' && data.id){
          if(state.party.members.includes(data.id)) return; // duplicate guard
          // place into this slot
          state.party.members[idx] = data.id; state.party.positions[data.id]=r; renderPartyView(root, state);
        } else if(data.type==='slot' && typeof data.index==='number'){
          const fromIdx = data.index;
          if(fromIdx===idx) return;
          const tmp = state.party.members[fromIdx];
          const tgtBefore = state.party.members[idx];
          state.party.members[fromIdx] = tgtBefore;
          state.party.members[idx] = tmp;
          // update positions map for swapped members
          const fromRow = Math.floor(fromIdx/3)+1;
          const toRow = Math.floor(idx/3)+1;
          if(tmp){ state.party.positions[tmp] = toRow; }
          if(tgtBefore){ state.party.positions[tgtBefore] = fromRow; }
          renderPartyView(root, state);
        }
      };

      // DnD source when slot has member
      if(memberId){
        cell.draggable = true;
        cell.ondragstart=(e)=>{ e.dataTransfer.setData('text/plain', JSON.stringify({ type:'slot', index: idx })); };
      }

      rowEl.appendChild(cell);
    }
  }

  // ===== Detail Panel =====
  const detail = document.createElement('div'); detail.className='panel'; detail.id='detailPanel';
  detail.innerHTML = `<h3>캐릭터 정보</h3>
    <div class="list" id="detailBody"><span class="badge">좌측 목록 또는 슬롯을 선택하세요</span></div>
    <div class="skill-icons" id="skillIcons"></div>
    <div class="card" id="skillDetail" style="display:none;"></div>`;

  function renderDetail(unitId){
    const body = detail.querySelector('#detailBody');
    const iconWrap = detail.querySelector('#skillIcons');
    const skillDetail = detail.querySelector('#skillDetail');
    if(!unitId){
      body.innerHTML = `<span class="badge">좌측 목록 또는 슬롯을 선택하세요</span>`;
      iconWrap.innerHTML = '';
      skillDetail.style.display='none';
      skillDetail.innerHTML = '';
      return;
    }
    const u = state.data.units[unitId]; if(!u) return;
    body.innerHTML = `
      <div class="row">
        <div class="portrait"></div>
        <div class="col">
          <strong>${u.name}</strong>
          <span class="badge">HP ${u.hp}/${u.hpMax||u.hp} · MP ${u.mp||0} · SPD ${u.spd||0}</span>
          <span class="badge">ATK ${u.atk||0} · DEF ${u.def||0}</span>
        </div>
      </div>`;
    // skills icons
    iconWrap.innerHTML = '';
    (u.skills||[]).forEach(skId=>{
      const sk = state.data.skills[skId];
      const icon = document.createElement('button');
      icon.className='skill-icon';
      icon.title = sk?.name||skId;
      icon.textContent = (sk?.icon||'◆');
      icon.onclick=()=>{
        if(!sk){ skillDetail.style.display='none'; return; }
        const acc = Math.round((sk.acc??1)*100);
        const hits = sk.hits||1;
        const coeff = sk.coeff? Math.round(sk.coeff*100) : 100;
        const costMp = sk.cost?.mp||0;
        const from = Array.isArray(sk.from)? sk.from.join(',') : (sk.from||'-');
        const to = Array.isArray(sk.to)? sk.to.join(',') : (sk.to||'-');
        skillDetail.style.display='block';
        skillDetail.innerHTML = `
          <div class="row"><strong>${sk.name||skId}</strong><span class="badge">MP ${costMp}</span></div>
          <div class="badge">명중 ${acc}% · 피해 ${coeff}% × ${hits}</div>
          <div class="badge">사거리 from[${from}] → to[${to}]</div>
          <div class="badge">유형 ${sk.type||'-'}</div>`;
      };
      iconWrap.appendChild(icon);
    });
  }

  // ===== Actions =====
  const actions = document.createElement('div');
  actions.className='row';
  const clearBtn = document.createElement('button'); clearBtn.className='btn'; clearBtn.textContent='초기화';
  clearBtn.onclick=()=>{ state.party.members=[null,null,null,null,null,null,null,null,null]; state.party.positions={}; renderPartyView(root, state); };
  const backBtn = document.createElement('button'); backBtn.className='btn primary'; backBtn.textContent='루트로';
  backBtn.onclick=()=>{
    const hasMember = (state.party.members||[]).some(Boolean);
    if(!hasMember){
      alert('최소 1명 이상 편성해야 합니다.');
      return;
    }
    document.querySelector('nav button[data-view=routes]').click();
  };
  actions.append(clearBtn, backBtn);

  leftCol.append(roster, formation, actions);
  rightCol.append(detail);
  layout.append(leftCol, rightCol);

  wrap.append(layout);
  root.innerHTML='';
  root.appendChild(wrap);
}

function slotIndex(row, col){
  // row: 1(front),2(mid),3(rear) → 3x3 = 9 slots
  return (row-1)*3 + col;
}

function findEmptySlot(state, row){
  for(let c=0;c<3;c++){
    const i = slotIndex(row, c);
    if(!state.party.members[i]) return { index: i };
  }
  return null;
}



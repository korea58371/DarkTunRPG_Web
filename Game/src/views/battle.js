export function renderBattleView(root, state){
  const btid = state.ui.battle || Object.keys(state.data.battles||{})[0] || 'BT-100';
  const bt = state.data.battles[btid];
  const frame = document.createElement('div');
  frame.className='battle-frame';
  frame.innerHTML = `
    <div class="battle-top">
      <div class="turn-queue" id="turnQueue"></div>
      <div><strong>전투: ${btid}</strong></div>
      <div class="chip">Seed ${state.data.battles[btid].seed}</div>
    </div>
    <div class="battle-center">
      <div class="lane" id="allyLane"></div>
      <div class="lane" id="enemyLane"></div>
    </div>
    <div class="battle-bottom">
      <div class="actor-info" id="actorInfo"></div>
      <div class="action-cards" id="actionCards"></div>
    </div>
  `;

  // 초기 전투 상태 준비 (파티 변경 시 재생성)
  if(state.ui.battleState){
    const snap = state.ui.battleState.partySnapshot || [];
    const posSnap = state.ui.battleState.positionsSnapshot || {};
    const sameParty = JSON.stringify(snap) === JSON.stringify(state.party.members||[]);
    const samePos = JSON.stringify(posSnap) === JSON.stringify(state.party.positions||{});
    if(!sameParty || !samePos) delete state.ui.battleState;
  }
  if(!state.ui.battleState){
    state.ui.battleState = window.BATTLE.createBattleState(state, bt);
  }
  const B = state.ui.battleState;
  console?.log?.('[battle] mount', { btid, allies: B.allyOrder, enemies: B.enemyOrder, queue: B.queue });

  if(!B.queue || B.queue.length===0){
    const msg = document.createElement('div');
    msg.className='frame';
    msg.innerHTML = `<div style="padding:16px;color:#cbd5e1;">전투 대기열이 비어 있습니다. 파티/적 데이터 구성을 확인하세요.</div>`;
    root.innerHTML=''; root.appendChild(msg); return;
  }

  // 3-row per side (rear, mid, front), each row has 3 slots
  // Ally turn: preselect remembered target if alive
  const turnId = B.turnUnit;
  if(B.allyOrder.includes(turnId)){
    const remembered = B.lastTarget?.[turnId];
    if(remembered && B.enemyOrder.includes(remembered) && (B.units[remembered]?.hp>0)){
      B.target = remembered;
    }
  }
  const renderRows = (laneEl, ids, side)=>{
    laneEl.innerHTML = '';
    laneEl.classList.add(side);
    const title = document.createElement('div'); title.className='title'; title.textContent = side==='ally' ? '아군' : '적군';
    laneEl.appendChild(title);
    const rows = document.createElement('div'); rows.className='rows';

    // 3x3 고정 그리드를 유지하기 위해 각 row별 3칸 배열을 만든다.
    function toLine(rowNum){
      const line = [null,null,null];
      ids.forEach(id=>{
        if(!id) return; const u=B.units[id]; if(!u) return;
        if((u.row||2)!==rowNum) return; const col = Math.max(0, Math.min(2, u.col ?? 0));
        line[col] = id;
      });
      return line;
    }
    const front = toLine(1);
    const mid   = toLine(2);
    const rear  = toLine(3);

    for(let i=0; i<3; i++){
      const wrap = document.createElement('div'); wrap.className='row-wrap';
      // ally: [rear, mid, front] (왼→오), enemy: [front, mid, rear]
      const trio = side==='ally' ? [rear[i], mid[i], front[i]] : [front[i], mid[i], rear[i]];
      trio.forEach(id=>{
        const slot = document.createElement('div'); slot.className='slot';
        if(id){
          const u = B.units[id];
          const el = document.createElement('div'); el.className='unit-slot'; if(u.large) el.classList.add('large'); el.dataset.unitId = id;
          if(B.turnUnit===id) el.classList.add('is-turn');
          if(B.target===id) el.classList.add('is-target');
          // buff icons
          const buffsHtml = (()=>{
            const buf=[];
            if(u._regen && u._regen.remain>0){ buf.push(`<div class=\"slot-buff regen\" title=\"지속 회복\"><span>✚</span><span class=\"turns\">${u._regen.remain}</span></div>`); }
            if(u._poison && u._poison.remain>0){ buf.push(`<div class=\"slot-buff poison\" title=\"중독\"><span>☠</span><span class=\"turns\">${u._poison.remain}</span></div>`); }
            if(u._bleed && u._bleed.remain>0){ buf.push(`<div class=\"slot-buff bleed\" title=\"출혈\"><span>🩸</span><span class=\"turns\">${u._bleed.remain}</span></div>`); }
            return buf.join('');
          })();
          el.innerHTML = `<div class=\"inner\"><div class=\"portrait\"></div><div class=\"hpbar\"><span style=\"width:${Math.max(0,(u.hp/u.hpMax)*100)}%\"></span><i class=\"pred\" style=\"width:0%\"></i></div><div class=\"shieldbar\" style=\"display:${(u.shield||0)>0?'block':'none'};\"><span style=\"width:${Math.max(0, Math.min(100, ((u.shield||0)/(u.hpMax||1))*100))}%\"></span></div></div><div class=\"slot-buffs\">${buffsHtml}</div><div class=\"name-label\">${u.name}</div>`;
          el.onmouseenter=(e)=>{ window.UI_TIP?.showTooltip(`${u.name}\nHP ${u.hp}/${u.hpMax} · MP ${(u.mp||0)} · SPD ${u.spd}\nATK ${u.atk} · DEF ${u.def}`, e.clientX, e.clientY); };
          el.onmousemove=(e)=>{ window.UI_TIP?.positionTip(e.clientX, e.clientY); };
          el.onmouseleave=()=> window.UI_TIP?.hideTooltip();
          if(B.allyOrder.includes(B.turnUnit) && side==='enemy'){
            el.classList.add('is-eligible'); el.style.cursor='pointer';
            el.onclick=()=>{
              B.target=id; selectedTarget=id;
              document.querySelectorAll('.unit-slot.is-target').forEach(x=>x.classList.remove('is-target'));
              el.classList.add('is-target');
              if(selectedSkill){ decideBtn.disabled = !isTargetValid(selectedSkill, id); }
              refreshCardStates();
              updateTargetHints();
            };
          }
          slot.appendChild(el);
        } else {
          // 투명한 빈 슬롯을 추가하여 레이아웃 고정
          const ghost = document.createElement('div'); ghost.className='unit-slot ghost';
          ghost.style.opacity='0';
          slot.appendChild(ghost);
        }
        wrap.appendChild(slot);
      });
      rows.appendChild(wrap);
    }
    laneEl.appendChild(rows);
  };

  const allyLane = frame.querySelector('#allyLane'); allyLane.className='lane ally';
  const enemyLane = frame.querySelector('#enemyLane'); enemyLane.className='lane enemy';
  renderRows(allyLane, B.allyOrder, 'ally');
  renderRows(enemyLane, B.enemyOrder, 'enemy');
  // redraw remembered target highlight if valid
  if(B.target){
    const lane = B.enemyOrder.includes(B.target) ? enemyLane : allyLane;
    const el = lane.querySelector(`.unit-slot[data-unit-id="${B.target}"]`);
    if(el) el.classList.add('is-target');
  }
  enableSelect(enemyLane, 'enemy');
  // 아군 타겟팅 스킬 지원을 위해 아군 레인도 선택 가능하게
  enableSelect(allyLane, 'ally');
  // 초기 AOE 하이라이트
  // selectedSkill는 아래에서 정의되므로 이후 호출에서도 갱신됨
  // 초기 렌더 시 턴 하이라이트 보정
  setTimeout(()=> setTurnHighlight(), 0);

  // 턴 큐 + 턴 시작 시점 처리(지속힐 등)
  const tq = frame.querySelector('#turnQueue'); tq.innerHTML='';
  B.queue.slice(0,10).forEach(id=>{ const chip=document.createElement('span'); chip.className='chip'; chip.textContent=B.units[id]?.name||id; tq.appendChild(chip); });
  // 조작 가능한 시점(렌더 직후)에만 턴 시작 효과를 적용
  if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
    window.BATTLE.applyTurnStartEffects(B);
    animateFromLog();
    B.turnStartProcessedFor = B.turnUnit;
  }

  // 하단 HUD: 현재 턴 유닛 정보
  const actor = B.units[B.turnUnit];
  const info = frame.querySelector('#actorInfo');
  info.innerHTML = `
    <div class="portrait" style="width:72px; height:72px; border-radius:10px;"></div>
    <div class="col bars">
      <div class="row" style="align-items:center; gap:8px;"><strong>${actor.name}</strong></div>
      <div class="bar"><span class="hp" style="width:${Math.max(0,(actor.hp/actor.hpMax)*100)}%"></span></div>
      <div class="bar"><span class="mp" style="width:${Math.max(0,((actor.mp||0)/(actor.mpMax||Math.max(1,actor.mp||10)))*100)}%"></span></div>
      <div class="bar" style="display:${(actor.shield||0)>0?'block':'none'};"><span class="shield" style="width:${Math.max(0, Math.min(100, ((actor.shield||0)/(actor.hpMax||1))*100))}%"></span></div>
      <div class="buffs">${Array.from({length:6}).map(()=>'<div class="buff-slot"></div>').join('')}</div>
    </div>
  `;

  // 행동 패널(탭 + 카드)
  const bottom = frame.querySelector('.battle-bottom');
  const tabs = document.createElement('div'); tabs.className='action-tabs';
  const tabNames = ['전체','공격','지원'];
  let activeTab = '전체';
  tabNames.forEach(name=>{
    const t = document.createElement('button'); t.className='tab'+(name===activeTab?' active':''); t.textContent=name; t.onclick=()=>{ activeTab=name; document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); renderCards(); };
    tabs.appendChild(t);
  });
  // 카드 패널 컨테이너
  const cardsPanel = document.createElement('div'); cardsPanel.className='cards-panel';
  const cardsEl = frame.querySelector('#actionCards');
  // 선택 상태 기본값(복원 로직 제거)
  let selectedSkill = null;
  let selectedTarget = B.target || null;

  function refreshCardStates(){
    const cards = cardsEl.querySelectorAll('.action-card');
    cards.forEach(card=>{
      const id = card.dataset.skillId; if(!id) return;
      const sk = state.data.skills[id];
      const valid = isTargetValid(sk, selectedTarget || B.target);
      const mpOk = (actor.mp||0) >= (sk.cost?.mp||0);
      card.classList.toggle('disabled', !valid);
      card.classList.toggle('mp-insufficient', !mpOk);
    });
  }

  function isTargetValid(sk, targetId){
    if(!sk) return false;
    if(sk.range==='ally'){
      return !!targetId && B.allyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.range==='ranged'){
      return !!targetId && B.enemyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.range==='melee'){
      // target must be in the foremost alive row
      const rows=[1,2,3];
      let foremost=null;
      for(const r of rows){
        if(B.enemyOrder.some(id=>id && (B.units[id]?.row===r) && (B.units[id]?.hp>0))){ foremost=r; break; }
      }
      if(!foremost) return false;
      return !!targetId && B.enemyOrder.includes(targetId) && (B.units[targetId]?.row===foremost) && (B.units[targetId]?.hp>0);
    }
    // fallback to previous rank-based
    if(!targetId) return false;
    const isEnemyTarget = B.enemyOrder.includes(targetId);
    const targetRow = B.units[targetId]?.row || 1;
    const to = sk.to || [1,2];
    return isEnemyTarget && to.includes(targetRow);
  }

  function canExecute(sk, targetId){
    if(!sk) return false;
    // MP check
    if((actor.mp||0) < (sk.cost?.mp||0)) return false;
    // 배우 선이동이 필수인 스킬(공격/효과 동반): 이동 불가하면 사용 불가
    if(sk.move && sk.move.who==='actor' && (sk.move.required!==false)){
      const pv = window.BATTLE.previewMove(state, B, B.turnUnit, sk.move);
      if(pv.steps<=0) return false;
    }
    // 대상 이동이 필수인 스킬: 단일 타겟일 때 미리 이동 가능성 확인
    if(sk.move && sk.move.who==='target' && (sk.move.required!==false)){
      // row/line은 사전 검증 스킵(실행 중 개별 대상 처리), 단일 대상만 체크
      if(sk.type!=='row' && sk.type!=='line'){
        if(!targetId) return false;
        const pv = window.BATTLE.previewMove(state, B, targetId, sk.move);
        if(pv.steps<=0) return false;
      }
    }
    // 순수 이동 스킬은 타겟 불필요
    if(sk.type==='move') return true;
    if(sk.type==='heal'){
      return !!targetId && B.allyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.type==='row'){
      // fixed row (to length 1) → no target needed; else need valid target to infer row
      if(Array.isArray(sk.to) && sk.to.length===1) return true;
      return !!targetId && isTargetValid(sk, targetId);
    }
    if(sk.type==='line'){
      // needs a target to infer column
      return !!targetId && isTargetValid(sk, targetId);
    }
    // single-target default
    return !!targetId && isTargetValid(sk, targetId);
  }

  function updateAOEHighlight(){
    // clear
    document.querySelectorAll('.unit-slot.is-aoe').forEach(el=>el.classList.remove('is-aoe'));
    if(!selectedSkill) return;
    if(selectedSkill.range==='ally') return; // no enemy AOE highlight for ally skills
    if(selectedSkill.type==='row'){
      let targetRow = null;
      if(Array.isArray(selectedSkill.to) && selectedSkill.to.length===1){ targetRow = selectedSkill.to[0]; }
      else if(selectedTarget){ targetRow = B.units[selectedTarget]?.row || null; }
      if(!targetRow) return;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.row===targetRow){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(selectedSkill.type==='line' && selectedTarget){
      const col = B.units[selectedTarget]?.col;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.col===col){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    }
  }

  // 타겟 힌트: 최종 명중률 배지 + 예상 HP 감소 오버레이
  function updateTargetHints(){
    // 기존 배지/오버레이 제거
    document.querySelectorAll('.unit-slot .hit-badge').forEach(n=>n.remove());
    document.querySelectorAll('.unit-slot .hpbar .pred').forEach(p=>{ p.style.width='0%'; p.style.left='0%'; });
    if(!selectedSkill) return;
    const actor = B.units[B.turnUnit]; if(!actor) return;
    if(!canExecute(selectedSkill, selectedTarget || B.target)) return;

    // 대상 집합 구하기: 단일/라인/로우
    let targetIds = [];
    const fallbackTid = selectedTarget || B.target;
    if(selectedSkill.range==='ally'){
      // only ally target; show hint on selected ally target only
      if(fallbackTid && B.allyOrder.includes(fallbackTid)) targetIds = [fallbackTid];
      else return;
    }
    if(selectedSkill.type==='row'){
      let targetRow = null;
      if(Array.isArray(selectedSkill.to) && selectedSkill.to.length===1){ targetRow = selectedSkill.to[0]; }
      else if(fallbackTid){ targetRow = B.units[fallbackTid]?.row || null; }
      if(targetRow){ targetIds = B.enemyOrder.filter(id=>id && (B.units[id]?.hp>0) && (B.units[id]?.row===targetRow)); }
    } else if(selectedSkill.type==='line'){
      if(!fallbackTid) return; const col = B.units[fallbackTid]?.col;
      targetIds = B.enemyOrder.filter(id=>id && (B.units[id]?.hp>0) && (B.units[id]?.col===col));
    } else {
      if(!fallbackTid) return; targetIds = [fallbackTid];
    }
    if(!targetIds.length) return;

    // 각 대상에 대해 배지/예상 피해 세그먼트 표시
    const rawAcc = Math.max(0, Math.min(1, (selectedSkill.acc||1)));
    const addAcc = Math.max(0, selectedSkill.accAdd||0);
    const hits = Math.max(1, selectedSkill.hits||1);
    const lane = (selectedSkill.range==='ally') ? allyLane : enemyLane; // 대상 레인
    targetIds.forEach(tid=>{
      const target = B.units[tid]; if(!target) return;
      let addDodge = 0;
      // 패시브 보정(대상측 회피): passives.js 규칙을 사용해 per-target으로 계산
      try{
        const passives = state.data?.passives || {};
        const source = B.units[B.turnUnit];
        const effects = [];
        const collect=(ids, applyTo)=>{ (ids||[]).forEach(pid=>{ const p=passives[pid]; if(!p) return; (p.effects||[]).forEach(e=> effects.push({p,e,applyTo})); }); };
        collect(Array.isArray(source.passives)?source.passives:[], 'outgoing');
        collect(Array.isArray(target.passives)?target.passives:[], 'incoming');
        const matching = effects.filter(x=>{
          if(x.e.applyTo && x.e.applyTo!=='incoming') return false;
          const w=x.e.when||{}; if(w.damageType && selectedSkill.damageType!==w.damageType) return false; return x.e.hook==='modifyDodge';
        }).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
        const groupBest={};
        matching.forEach(x=>{ const g=x.p.group||x.e.group||x.p.id; const val=x.e?.add?.dodge||0; if(!(g in groupBest) || (x.e.priority||0)<(groupBest[g].prio||0)){ groupBest[g]={val, prio:(x.e.priority||0)}; } });
        Object.values(groupBest).forEach(v=> addDodge+=v.val);
      }catch(e){ /* fail-soft */ }
      const dodgeBase = Math.max(0, Math.min(1, (target.dodge||0)));
      const dodgeFinal = Math.max(0, Math.min(1, dodgeBase + addDodge));
      const accFinal = (addAcc>0) ? Math.max(0, Math.min(1, rawAcc + addAcc - dodgeFinal)) : (rawAcc * (1 - dodgeFinal));
      const finalHit = selectedSkill.type==='heal' ? 100 : Math.round(accFinal * 100);
      // 피해 가감 패시브가 있는 경우 예상 피해에도 반영
      let expectedDamageMul = 1;
      try{
        const passives = state.data?.passives || {};
        const source = B.units[B.turnUnit];
        const effects = [];
        const collect=(ids, applyTo)=>{ (ids||[]).forEach(pid=>{ const p=passives[pid]; if(!p) return; (p.effects||[]).forEach(e=> effects.push({p,e,applyTo})); }); };
        collect(Array.isArray(source.passives)?source.passives:[], 'outgoing');
        collect(Array.isArray(target.passives)?target.passives:[], 'incoming');
        const dmgList = effects.filter(x=> x.e.hook==='modifyDamage' && (!x.e.applyTo || x.e.applyTo==='outgoing' || x.e.applyTo==='incoming')).filter(x=>{ const w=x.e.when||{}; if(w.damageType && selectedSkill.damageType!==w.damageType) return false; return true; }).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
        const groupBest={};
        dmgList.forEach(x=>{ const g=x.p.group||x.e.group||x.p.id; const mul=(x.e?.mul?.damage)||1; if(!(g in groupBest) || (x.e.priority||0)<(groupBest[g].prio||0)){ groupBest[g]={mul, prio:(x.e.priority||0)}; } });
        Object.values(groupBest).forEach(v=>{ expectedDamageMul *= (v.mul||1); });
      }catch(e){ /* noop */ }
      let base = (selectedSkill.type==='heal')
        ? Math.max(1, Math.round((actor.mag||0) * (selectedSkill.coeff||1)))
        : Math.max(1, Math.round(((actor.atk||1) * (selectedSkill.coeff||1)) - (target.def||0)));
      const critP = Math.max(0, Math.min(1, actor.crit||0));
      const blockP = Math.max(0, Math.min(1, target.block||0));
      const expectedPerHit = Math.max(1, Math.round(base * (1 + critP*0.5) * (1 - blockP*0.8) * expectedDamageMul));
      let hpNowPct = Math.max(0, Math.min(100, ((target.hp)/(target.hpMax||1))*100));
      let hpAfterPct = hpNowPct;
      if(selectedSkill.type==='heal'){
        const heal = expectedPerHit * hits;
        const hpAfter = Math.min(target.hpMax||target.hp, target.hp + heal);
        hpAfterPct = Math.max(0, Math.min(100, (hpAfter/(target.hpMax||1))*100));
      } else {
        const expected = expectedPerHit * hits;
        const shieldUse = Math.min(target.shield||0, expected);
        const hpDamage = Math.max(0, expected - shieldUse);
        hpAfterPct = Math.max(0, Math.min(100, ((Math.max(0, target.hp - hpDamage))/(target.hpMax||1))*100));
      }
      const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${tid}"]`);
      if(!slotEl) return;
      const badge = document.createElement('div'); badge.className='hit-badge'; if(finalHit<=50) badge.classList.add('low-hit'); badge.textContent = `${finalHit}%`;
      slotEl.appendChild(badge);
      const pred = slotEl.querySelector('.hpbar .pred');
      if(pred){
        if(selectedSkill.type==='heal'){
          // heal: 증가 구간을 흰색으로
          pred.style.left = `${hpNowPct}%`;
          pred.style.width = `${Math.max(0, hpAfterPct - hpNowPct)}%`;
        } else {
          pred.style.left = `${hpAfterPct}%`;
          pred.style.width = `${Math.max(0, hpNowPct - hpAfterPct)}%`;
        }
      }
    });
  }

  function renderCards(){
    cardsEl.innerHTML='';
    // no decide button; execution is triggered by clicking the selected card again
    const list = actor.skills?.length? actor.skills : ['SK-01'];
    // 정렬: 사용 가능 먼저, MP 부족/타겟 불가 뒤로
    const enriched = list.map((skId, idx)=>{
      const sk = state.data.skills[skId]; if(!sk) return null; const usable = canExecute(sk, selectedTarget || B.target); const mpOk = (actor.mp||0) >= (sk.cost?.mp||0); return { sk, usable, mpOk, idx };
    }).filter(Boolean).sort((a,b)=> a.idx - b.idx); // 항상 원래 스킬 순서 유지
    enriched.forEach(({sk, mpOk})=>{
      const card = document.createElement('div'); card.className='action-card'+(selectedSkill?.id===sk.id?' selected':'');
      if(!mpOk) card.classList.add('mp-insufficient');
      card.dataset.skillId = sk.id;
      const targetText = sk.type==='row' ? (Array.isArray(sk.to)&&sk.to.length===1? `전열 전체` : `선택 라인 전체`) : (sk.range==='melee'? '근접: 가장 앞열만' : sk.range==='ranged'? '원거리: 전체 선택 가능' : (sk.to? (sk.to.includes(1)? '전열' : '후열') : '대상: 전/후열'));
      const attr = sk.damageType ? ` · 속성: ${sk.damageType==='slash'?'참격': sk.damageType==='pierce'?'관통': sk.damageType==='magic'?'마법':'타격'}` : '';
      const accDisp = Math.round((((sk.acc||1) + Math.max(0, sk.accAdd||0)) * 100));
      const stats = (sk.type==='move')
        ? `이동: 전방향 ${sk.move?.tiles||1}칸 · 전용`
        : `명중: ${accDisp}% (+${Math.round((Math.max(0, sk.accAdd||0))*100)}%) · 대미지: ${Math.round((sk.coeff||1)*100)}% x ${sk.hits||1}${attr}`;
      const debuffLine = (()=>{
        const parts = [];
        if(sk.bleed){ parts.push(`50% 확률로 ${sk.bleed.duration||3}턴간 출혈 상태`); }
        if(sk.type==='poison' || sk.id==='SK-22'){ parts.push(`중독 부여(${(state.data.skills['SK-22']?.duration)||3}턴)`); }
        return parts.length? `[${parts.join(' · ')}]` : '';
      })();
      card.innerHTML = `<div class="title">${sk.name||sk.id}</div><div class="desc">${debuffLine}</div><div class="stats">${targetText}<br>${stats}</div><div class="cost">MP ${sk.cost?.mp||0}</div>`;
      card.onclick=async (ev)=>{
        // if already selected and executable → use skill immediately
        const already = selectedSkill?.id === sk.id;
        selectedSkill = sk;
        document.querySelectorAll('.action-card.selected').forEach(x=>x.classList.remove('selected'));
        card.classList.add('selected');
        refreshCardStates();
        updateAOEHighlight();
        updateTargetHints();
        // 이동형(능동) 스킬: 이동 목적지 선택 UI 진입
        if(sk.type==='move'){
          enterMoveTargeting();
          return;
        }
        if(already && canExecute(selectedSkill, selectedTarget || B.target)){
          await executeSelectedSkill();
        } else {
          // 선택 직후 즉시 힌트 툴팁 노출
          const x = ev?.clientX ?? (card.getBoundingClientRect().left + 12);
          const y = ev?.clientY ?? (card.getBoundingClientRect().top + 12);
          window.UI_TIP?.showTooltip('한번 더 클릭 시 스킬 사용', x, y);
        }
      };
      // Hover hint when selected
      card.onmouseenter=(e)=>{
        // 선택된 카드 힌트
        if(selectedSkill?.id === sk.id){ window.UI_TIP?.showTooltip(sk.type==='move' ? '하이라이트된 칸을 클릭해 이동' : '한번 더 클릭 시 스킬 사용', e.clientX, e.clientY); return; }
        // 사용 불가 사유
        const ok= selectedTarget? isTargetValid(sk, selectedTarget || B.target) : true; if(!ok){ const reason=`[${targetText} 유닛만 선택 가능합니다]`; window.UI_TIP?.showTooltip(reason, e.clientX, e.clientY); return; }
        // 디버프 상세 툴팁
        const tipParts=[];
        if(sk.type!=='move' && sk.bleed){
          const amt = Math.max(1, Math.round((actor.atk||0) * (sk.bleed.coeff||0.3)));
          tipParts.push(`출혈: 매 턴 시작 시 ${amt}의 고정피해 (${sk.bleed.duration||3}턴)`);
        }
        if(sk.type!=='move' && (sk.type==='poison' || sk.id==='SK-22')){
          const amt = Math.max(1, Math.round((selectedTarget? (B.units[selectedTarget]?.hpMax||0) : 0) * (state.data.skills['SK-22']?.dotPct||0.10)));
          tipParts.push(`중독: 매 턴 시작 시 ${amt}의 고정피해 (${(state.data.skills['SK-22']?.duration)||3}턴)`);
        }
        if(sk.type==='move'){
          tipParts.push('이동 전용 스킬: 피해 없음');
        }
        if(tipParts.length){ window.UI_TIP?.showTooltip(tipParts.join('\n'), e.clientX, e.clientY); }
      };
      card.onmousemove=(e)=>{ window.UI_TIP?.positionTip(e.clientX, e.clientY); };
      card.onmouseleave=()=> window.UI_TIP?.hideTooltip();
      cardsEl.appendChild(card);
    });
    refreshCardStates();
    updateAOEHighlight();
  }
  if(B.allyOrder.includes(B.turnUnit)){
    renderCards();
  } else {
    // 적 턴에는 카드 영역을 비운다
    cardsEl.innerHTML='';
    tabs.innerHTML='';
  }

  // 슬롯 클릭 시 타겟 선택 유지/검증
  function enableSelect(laneEl, side){
    laneEl.querySelectorAll('.unit-slot').forEach((el)=>{
      const id = el.dataset.unitId;
      el.onclick = async (ev)=>{
        if(!id) return;
        const already = (B.target===id);
        B.target=id; selectedTarget=id;
        document.querySelectorAll('.unit-slot.is-target').forEach(x=>x.classList.remove('is-target'));
        el.classList.add('is-target');
        refreshCardStates();
        updateAOEHighlight();
        updateTargetHints();
        if(already && selectedSkill && canExecute(selectedSkill, id)){
          await executeSelectedSkill();
        } else if(selectedSkill){
          const rect = el.getBoundingClientRect();
          const x = ev?.clientX ?? (rect.left + rect.width/2);
          const y = ev?.clientY ?? (rect.top + 8);
          window.UI_TIP?.showTooltip('한번 더 클릭 시 스킬 사용', x, y);
        }
      };
      el.onmouseenter=(e)=>{
        if(id && selectedSkill && B.target===id){
          window.UI_TIP?.showTooltip('한번 더 클릭 시 스킬 사용', e.clientX, e.clientY);
        }
      };
      el.onmousemove=(e)=>{ window.UI_TIP?.positionTip(e.clientX, e.clientY); };
      el.onmouseleave=()=> window.UI_TIP?.hideTooltip();
    });
  }

  // 능동 이동 스킬 목적지 선택 모드
  function enterMoveTargeting(){
    const sk = selectedSkill; if(!sk || sk.type!=='move') return;
    // 클릭 가이드를 아군/적군 양쪽 격자에 표시: 배우가 이동 가능한 칸만 활성화
    const actorId = B.turnUnit; const actorU = B.units[actorId];
    const cand = [];
    const dirs = Array.isArray(sk.move?.allowedDirs) && sk.move.allowedDirs.length ? sk.move.allowedDirs : ['forward','back','up','down','upLeft','upRight','downLeft','downRight'];
    dirs.forEach(d=>{
      const pv = window.BATTLE.previewMove(state, B, actorId, { ...(sk.move||{}), who:'actor', dir: d });
      if(pv.steps>0 && pv.final){ cand.push(pv.final); }
    });
    // 중복 좌표 제거
    const key = (p)=> `${p.row}:${p.col}`; const uniq = Array.from(new Map(cand.map(p=>[key(p), p])).values());
    if(!uniq.length){ window.UI_TIP?.showTooltip('이동 가능한 칸이 없습니다', (cardsEl.getBoundingClientRect().left+24), (cardsEl.getBoundingClientRect().top-8)); return; }
    // 오버레이 표시
    function mark(tile){
      const lane = allyLane; // 배우는 아군이므로 아군 레인
      // grid에서 해당 row/col에 있는 유닛 슬롯 요소를 찾아야 함: 현재 그리드는 row-wrap/slot 순으로 고정 3x3
      const rowIndex = (tile.row===1?2 : tile.row===2?1 : 0); // 렌더 순서: rear(3), mid(2), front(1)
      const colIndex = Math.max(0, Math.min(2, tile.col||0));
      const rowWrap = lane.querySelectorAll('.row-wrap')[colIndex];
      if(!rowWrap) return null;
      const slot = rowWrap.querySelectorAll('.slot')[rowIndex];
      if(!slot) return null;
      // 고스트 .unit-slot 대신 .slot 컨테이너를 표시/클릭 대상으로 사용
      slot.classList.add('move-candidate');
      slot.dataset.row = String(tile.row);
      slot.dataset.col = String(tile.col);
      return slot;
    }
    const marked = uniq.map(mark).filter(Boolean);
    if(!marked.length){ window.UI_TIP?.showTooltip('이동 가능한 칸이 없습니다', (cardsEl.getBoundingClientRect().left+24), (cardsEl.getBoundingClientRect().top-8)); return; }
    // 클릭 핸들러: 목적지 확정 → 스킬 즉시 실행
    function onClickCandidate(e){
      e.stopPropagation();
      // 클릭된 후보의 목적지 좌표를 dataset에서 복원
      const el = e.currentTarget; const row = Number(el.dataset.row); const col = Number(el.dataset.col);
      const dest = { row, col };
      window.UI_TIP?.hideTooltip();
      // 선택된 이동 목적지를 반영한 임시 스킬로 실행(정확 좌표 지정)
      const temp = { ...sk, move: { ...(sk.move||{}), who:'actor', tiles:1, required:true, __dest: dest } };
      // previewMove는 dir 기반이므로, 정확 매칭이 필요하다면 dir을 dest 기준으로 산출하는 로직이 필요함.
      // 현재는 previewMove를 다시 호출하지 않고, 엔진에서 실제 이동을 계산하므로 dir은 그대로 사용
      B.target = B.turnUnit;
      executeSelectedSkill(temp);
      cleanup();
    }
    // 클릭 바인딩(표시 시점에 dataset 이미 주입됨)
    marked.forEach(el=>{ el.style.cursor='pointer'; el.addEventListener('click', onClickCandidate, { once:true }); });
    window.UI_TIP?.showTooltip('이동할 위치를 선택하세요', (cardsEl.getBoundingClientRect().left+24), (cardsEl.getBoundingClientRect().top-8));
    function cleanup(){ marked.forEach(el=> el.classList.remove('move-candidate')); window.UI_TIP?.hideTooltip(); }
  }

  // 현재 턴 하이라이트를 최신 턴 유닛으로 재지정
  function setTurnHighlight(){
    document.querySelectorAll('.unit-slot.is-turn').forEach(el=>el.classList.remove('is-turn'));
    const lane = (B.enemyOrder.includes(B.turnUnit) ? enemyLane : allyLane);
    const el = lane?.querySelector(`.unit-slot[data-unit-id="${B.turnUnit}"]`);
    if(el) el.classList.add('is-turn');
  }

  // 전투 로그 연출(다단히트 순차 표시)
  function animateFromLog(){
    const events = B.log || [];
    if(!events.length) return 0;
    const step = 500; // 0.5s 간격(단일 다단히트용)
    let seqDelay = 0; // 누적 지연(다단히트에만 적용)
    const needsDelay = events.some(ev=> ev.isMulti === true);
    let lastWasHit = false;
    let maxEnd = 0; // 전체 스케줄 종료 시각(ms)

    events.forEach((ev, idx)=>{
      // 시작 시각 계산
      let startAt = 0;
      if((ev.type==='hit' || ev.type==='miss') && ev.isMulti){ startAt = seqDelay; seqDelay += step; lastWasHit = (ev.type==='hit'); }
      else if(ev.type==='dead'){ startAt = Math.max(800, seqDelay); lastWasHit = false; } // 딜레이 단축
      else { startAt = 0; lastWasHit = (ev.type==='hit'); }

      const scheduleAt = startAt;

      // 각 이벤트의 표시/유지 시간(대략)
      let duration = 300; // 기본
      if(ev.type==='hit' || ev.type==='miss') duration = 300; // 텍스트 유지 시간
      if(ev.type==='shield') duration = 300;
      if(ev.type==='dead') duration = 800; // CSS fade-out 800ms와 일치

      maxEnd = Math.max(maxEnd, scheduleAt + duration);

      setTimeout(()=>{
        console.debug?.('[anim]', idx, ev.type, { to: ev.to, from: ev.from, dmg: ev.dmg, crit: ev.crit, blocked: ev.blocked, isMulti: ev.isMulti, when: scheduleAt });
        if(ev.type==='move'){
          const unitId = ev.unit; const u = B.units[unitId]; if(!u) return;
          const lane = (B.enemyOrder.includes(unitId)? enemyLane : allyLane);
          const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${unitId}"]`);
          console.debug?.('[move-anim]', { unitId, from: ev.from, to: ev.to, slotFound: !!slotEl });
          if(slotEl){
            slotEl.classList.add('moving');
            setTimeout(()=>{
              slotEl.classList.remove('moving');
              // 전체 리렌더 대신 라인만 갱신하여 현재 frame/closure 유지
              console.debug?.('[move-anim] refresh lanes after move');
              renderRows(allyLane, B.allyOrder, 'ally');
              renderRows(enemyLane, B.enemyOrder, 'enemy');
              setTurnHighlight();
            }, 240);
          }
        } else if(ev.type==='hit'){
          const toId = ev.to; const fromId = ev.from;
          const targetLane = (toId && toId.includes('@E')) ? enemyLane : allyLane;
          const slotEl = targetLane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            slotEl.classList.add('impact'); setTimeout(()=>slotEl.classList.remove('impact'), 200);
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; } else { const u=B.units[toId]; if(bar){ bar.style.width = `${Math.max(0,(u.hp/u.hpMax)*100)}%`; } }
            const sbar = slotEl.querySelector('.shieldbar > span'); if(sbar){ const sv = (typeof ev.shield==='number')? ev.shield : (B.units[toId].shield||0); sbar.style.width = `${Math.max(0, Math.min(100, (sv/(B.units[toId].hpMax||1))*100))}%`; const barWrap = sbar.parentElement; if(barWrap){ barWrap.style.display = (sv>0)? 'block' : 'none'; } }
            const dmg = document.createElement('div'); let cls='dmg-float'; let text=`-${ev.dmg}`; 
            if(ev.crit){ cls+=' dmg-crit'; text=`💥 ${ev.dmg}`; } 
            else if(ev.blocked){ cls+=' dmg-block'; text=`🛡️ ${ev.dmg}`; }
            dmg.className=cls; dmg.textContent=text; dmg.style.left='50%'; dmg.style.top='0'; slotEl.appendChild(dmg); setTimeout(()=>dmg.remove(), 1400);
            // lethal 시 즉시 사망 대사 출력
            if(typeof ev.hp==='number' && ev.hp<=0){
              const baseId = (toId||'').split('@')[0];
              const base = state.data.units?.[baseId] || {};
              const line = base.deathLine;
              if(line){ const sp=document.createElement('div'); sp.className='speech'; sp.textContent=line; slotEl.appendChild(sp); setTimeout(()=>{ if(sp.parentElement) sp.remove(); }, 1600); }
            }
          }
          const fromLane = (fromId && fromId.includes('@E')) ? enemyLane : allyLane;
          fromLane.classList.add('hit-swing'); setTimeout(()=>fromLane.classList.remove('hit-swing'), 260);
          const fromEl = fromLane.querySelector(`.unit-slot[data-unit-id="${fromId}"]`);
          if(fromEl){ const cls = B.enemyOrder.includes(fromId)? 'lunge-enemy' : 'lunge-ally'; fromEl.classList.add(cls); setTimeout(()=>fromEl.classList.remove(cls), 220); }
        } else if(ev.type==='dead'){
          const toId = ev.to;
          const wasEnemy = toId.includes('@E');
          const lane = wasEnemy ? enemyLane : allyLane;
          const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          console.debug?.('[death]', { toId, wasEnemy, lane: lane?.className, slotEl: !!slotEl, when: scheduleAt });
          if(slotEl){
            // 사망 연출 빠르게 시작
            console.debug?.('[death-start]', toId, 'death begins');
            slotEl.classList.add('fade-out');
            const fx = document.createElement('div'); fx.className='death-fx'; fx.textContent='💀'; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx);
            setTimeout(()=>{ 
              console.debug?.('[death-end]', toId, 'removed');
              if(fx.parentElement) fx.remove(); 
              if(slotEl.parentElement) slotEl.remove(); 
            }, 800);
          } else {
            console.warn?.('[death-fail]', toId, 'slot not found in', lane?.className, 'wasEnemy:', wasEnemy);
          }
        } else if(ev.type==='miss'){
          const toId = ev.to; const targetLane = (toId && toId.includes('@E')) ? enemyLane : allyLane; const slotEl = targetLane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){ const miss = document.createElement('div'); miss.className='miss-float'; miss.textContent='MISS'; miss.style.left='50%'; miss.style.top='0'; slotEl.appendChild(miss); setTimeout(()=>miss.remove(), 800); }
          const fromId = ev.from; const fromLane = (fromId && fromId.includes('@E')) ? enemyLane : allyLane; const fromEl = fromLane.querySelector(`.unit-slot[data-unit-id="${fromId}"]`);
          if(fromEl){ const cls = B.enemyOrder.includes(fromId)? 'lunge-enemy' : 'lunge-ally'; fromEl.classList.add(cls); setTimeout(()=>fromEl.classList.remove(cls), 220); }
        } else if(ev.type==='shield'){
          const toId = ev.to; const lane = (toId && toId.includes('@E')) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){ const sv = (typeof ev.shield==='number')? ev.shield : (B.units[toId].shield||0); const sbar = slotEl.querySelector('.shieldbar > span'); if(sbar){ sbar.style.width = `${Math.max(0, Math.min(100, (sv/(B.units[toId].hpMax||1))*100))}%`; const barWrap = sbar.parentElement; if(barWrap){ barWrap.style.display = (sv>0)? 'block' : 'none'; } } const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `+SHIELD ${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900); }
        } else if(ev.type==='heal'){
          const toId = ev.to; const lane = (B.allyOrder.includes(toId)) ? allyLane : enemyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='heal-float'; fx.textContent = `+${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
          }
        } else if(ev.type==='poison'){
          // 적용 시점: 디버프 부여 알림 + 즉시 아이콘/남은 턴 갱신
          const toId = ev.to; const lane = (B.allyOrder.includes(toId)) ? allyLane : enemyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `POISON`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 800);
            // 아이콘이 없다면 추가, 있다면 남은 턴 갱신
            let icon = slotEl.querySelector('.slot-buffs .poison');
            if(!icon){
              const bufWrap = slotEl.querySelector('.slot-buffs');
              if(bufWrap){ bufWrap.insertAdjacentHTML('beforeend', `<div class="slot-buff poison" title="중독"><span>☠</span><span class="turns">${ev.duration||3}</span></div>`); }
            } else {
              const t = icon.querySelector('.turns'); if(t){ t.textContent = `${ev.duration||3}`; }
            }
          }
        } else if(ev.type==='poisonTick'){
          const toId = ev.to; const lane = (B.allyOrder.includes(toId)) ? allyLane : enemyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='poison-float'; fx.textContent = `-${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
            // 남은 턴 수 갱신(0이 되면 제거)
            let icon = slotEl.querySelector('.slot-buffs .poison');
            if(icon){ const t = icon.querySelector('.turns'); if(t){ const next = Math.max(0, Number(t.textContent||'1') - 1); t.textContent = `${next}`; if(next<=0) icon.remove(); } }
          }
        } else if(ev.type==='bleed'){
          // 출혈 부여 알림 + 아이콘 추가/갱신
          const toId = ev.to; const lane = (B.allyOrder.includes(toId)) ? allyLane : enemyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `BLEED`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 800);
            let icon = slotEl.querySelector('.slot-buffs .bleed');
            if(!icon){
              const bufWrap = slotEl.querySelector('.slot-buffs');
              if(bufWrap){ bufWrap.insertAdjacentHTML('beforeend', `<div class="slot-buff bleed" title="출혈"><span>🩸</span><span class="turns">${ev.duration||3}</span></div>`); }
            } else { const t = icon.querySelector('.turns'); if(t){ t.textContent = `${ev.duration||3}`; } }
          }
        } else if(ev.type==='bleedTick'){
          const toId = ev.to; const lane = (B.allyOrder.includes(toId)) ? allyLane : enemyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='bleed-float'; fx.textContent = `-${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
            let icon = slotEl.querySelector('.slot-buffs .bleed');
            if(icon){ const t = icon.querySelector('.turns'); if(t){ const next = Math.max(0, Number(t.textContent||'1') - 1); t.textContent = `${next}`; if(next<=0) icon.remove(); } }
          }
        }
      }, scheduleAt);
    });
    B.log.length = 0;
    return maxEnd;
  }

  // 탭을 카드 컨테이너 앞에 삽입
  cardsPanel.appendChild(tabs);
  cardsPanel.appendChild(cardsEl);
  bottom.appendChild(cardsPanel);

  // mount to DOM
  root.innerHTML = '';
  root.appendChild(frame);

  // cheat panel (dev only) - appear outside game screen
  const oldCheat = document.getElementById('cheat-panel');
  if(oldCheat) oldCheat.remove();
  const cheat = document.createElement('div');
  cheat.id='cheat-panel';
  cheat.style.position='fixed'; cheat.style.right='12px'; cheat.style.bottom='12px';
  cheat.style.display='flex'; cheat.style.gap='8px'; cheat.style.zIndex='2000';
  const btnWin=document.createElement('button'); btnWin.className='btn'; btnWin.textContent='승리';
  const btnLose=document.createElement('button'); btnLose.className='btn'; btnLose.textContent='패배';
  btnWin.onclick=()=>{ showResult(true); };
  btnLose.onclick=()=>{ showResult(false); };
  cheat.appendChild(btnWin); cheat.appendChild(btnLose);
  document.body.appendChild(cheat);

  // 선택된 카드 재클릭 시 실행되는 공통 플로우
  async function executeSelectedSkill(overrideSkill){
    if(!selectedSkill) return;
    const useSkill = overrideSkill || selectedSkill;
    if(useSkill.type!=='move' && !isTargetValid(useSkill, B.target)){
      selectedSkill = null; renderCards(); return;
    }
    window.UI_TIP?.hideTooltip();
    const actorEl = (B.enemyOrder.includes(B.turnUnit)? enemyLane : allyLane).querySelector(`.unit-slot[data-unit-id="${B.turnUnit}"]`);
    const shout = (overrideSkill?.shout) || state.data.skills[useSkill.id]?.shout;
    if(actorEl && shout){ const sp=document.createElement('div'); sp.className='speech'; sp.textContent=shout; actorEl.appendChild(sp); setTimeout(()=>sp.remove(), 1800); }
    // 즉시 실행: 이동/히트 연출을 지체 없이 로그에 쌓고 애니메이션 시작
    window.BATTLE.performSkill(state, B, actor, useSkill);
    await new Promise(r=>setTimeout(r, 10));
    B.animating = true;
    const animDelay = animateFromLog();
    await new Promise(r=>setTimeout(r, Math.max(200, animDelay||0)));
    await new Promise(r=>setTimeout(r, 500));
    document.querySelectorAll('.unit-slot .hit-badge').forEach(n=>n.remove());
    document.querySelectorAll('.unit-slot .hpbar .pred').forEach(p=>{ p.style.width='0%'; p.style.left='0%'; });
    B.animating = false;
    // 다음 턴 시작 효과(중독/재생 등) 즉시 적용 및 연출
    if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
      window.BATTLE.applyTurnStartEffects(B);
      const extraDelay = animateFromLog();
      await new Promise(r=>setTimeout(r, Math.max(250, extraDelay||0)));
      B.turnStartProcessedFor = B.turnUnit;
    }
    // 턴이 넘어간 후 하이라이트를 갱신
    setTurnHighlight();
    if(window.BATTLE.isBattleFinished(B)){ return showResult(B.winner==='ally'); }
    await runEnemyPhase();
  }

  // 적 턴 자동 수행 함수
  async function runEnemyPhase(){
    let safety=20;
    while(safety-- > 0 && B.enemyOrder.includes(B.turnUnit)){
      const foe = B.units[B.turnUnit]; if(!foe) break;
      const foeSkillId = foe.skills?.[0]; const foeSkill = foeSkillId? state.data.skills[foeSkillId]: null;
      if(!foeSkill) break;
      // 현재 턴 유닛(적)으로 하이라이트 재지정
      setTurnHighlight();
      // 적 턴 시작 효과 즉시 적용(중독/재생 등)
      if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
        window.BATTLE.applyTurnStartEffects(B);
        const extraDelay = animateFromLog();
        await new Promise(r=>setTimeout(r, Math.max(250, extraDelay||0)));
        B.turnStartProcessedFor = B.turnUnit;
      }
      // 타겟 픽과 하이라이트(간단)
      B.target = window.BATTLE.pickTarget(state, B, false, foeSkill);
      document.querySelectorAll('.unit-slot.is-target').forEach(x=>x.classList.remove('is-target'));
      const foeEl = enemyLane.querySelector(`.unit-slot[data-unit-id="${B.turnUnit}"]`);
      if(foeEl){ foeEl.classList.add('attacking'); }
      // 적 스킬 대사 표시
      const foeShout = foeSkill?.shout;
      if(foeEl && foeShout){ const sp=document.createElement('div'); sp.className='speech'; sp.textContent=foeShout; foeEl.appendChild(sp); setTimeout(()=>{ if(sp.parentElement) sp.remove(); }, 1800); }
      const tEl = (B.enemyOrder.includes(B.target)? enemyLane : allyLane).querySelector(`.unit-slot[data-unit-id="${B.target}"]`);
      if(tEl) tEl.classList.add('is-target');
      await new Promise(r=>setTimeout(r, 220));
      window.BATTLE.performSkill(state, B, foe, foeSkill);
      B.animating = true;
      const animDelay = animateFromLog();
      await new Promise(r=>setTimeout(r, Math.max(300, animDelay||0)));
      if(foeEl){ foeEl.classList.remove('attacking'); }
      await new Promise(r=>setTimeout(r, 500));
      B.animating = false;
      // 스킬 처리로 다음 턴 유닛으로 넘어갔으므로 하이라이트 갱신
      setTurnHighlight();
      if(window.BATTLE.isBattleFinished(B)){ showResult(B.winner==='ally'); return; }
    }
    // 애니메이션이 모두 끝난 후에만 리렌더(연출 보존)
    setTimeout(()=>{ if(!window.BATTLE.isBattleFinished(B) && !B.animating) renderBattleView(root, state); }, 60);
  }

  function showResult(isWin){
    const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `<h3>${isWin? '승리': '패배'}</h3><p>${isWin? '전투에서 승리했습니다.': '전투에서 패배했습니다.'}</p><div class="actions"><button class="btn" id="btnToRoutes">루트로</button></div>`;
    backdrop.appendChild(modal); frame.appendChild(backdrop);
    modal.querySelector('#btnToRoutes').onclick=()=>{
      // persist hp/mp of allies
      (B.allyOrder||[]).forEach(id=>{
        if(!id) return; const baseId = id.split('@')[0]; const u=B.units[id]; if(!u) return;
        if(!state.persist) state.persist={ hp:{}, mp:{} };
        if(!state.persist.hp) state.persist.hp={}; if(!state.persist.mp) state.persist.mp={};
        state.persist.hp[baseId] = u.hp;
        state.persist.mp[baseId] = u.mp;
      });
      // 영구 사망 처리: 이번 전투에서 죽은 아군 제거
      if(B.deadAllies && B.deadAllies.length){
        const deadSet = new Set(B.deadAllies);
        if(state.ownedUnits){ Object.keys(state.ownedUnits).forEach(id=>{ if(deadSet.has(id)) delete state.ownedUnits[id]; }); }
        if(Array.isArray(state.party?.members)){
          state.party.members = state.party.members.map(id=> (id && deadSet.has(id)? null : id));
        }
        if(state.party?.positions){ Object.keys(state.party.positions).forEach(id=>{ if(deadSet.has(id)) delete state.party.positions[id]; }); }
      }
      // 전투 결과 플래그 기록(분기용)
      const key = `bt.${B.id||'BT-010'}.win`; // B.id가 없다면 기본값
      state.flags[key] = isWin;
      delete state.ui.battleState;
      const curBid = B.id || 'BT-010';
      // 전투 데이터 기반 분기: winNext/loseNext가 있으면 해당 타겟으로 이동
      const btData = state.data?.battles?.[curBid];
      const nextId = isWin ? (btData?.winNext || null) : (btData?.loseNext || null);
      // 이번 전투에서 사망한 아군은 보유/덱/영구 데이터에서 제거
      if(B.deadAllies && B.deadAllies.length){
        const deadSet = new Set(B.deadAllies);
        if(state.ownedUnits){ Object.keys(state.ownedUnits).forEach(id=>{ if(deadSet.has(id)) delete state.ownedUnits[id]; }); }
        if(Array.isArray(state.party?.members)){
          state.party.members = state.party.members.map(id=> (id && deadSet.has(id)? null : id));
        }
        if(state.party?.positions){ Object.keys(state.party.positions).forEach(id=>{ if(deadSet.has(id)) delete state.party.positions[id]; }); }
        if(state.persist){
          if(state.persist.hp){ Object.keys(state.persist.hp).forEach(id=>{ if(deadSet.has(id)) delete state.persist.hp[id]; }); }
          if(state.persist.mp){ Object.keys(state.persist.mp).forEach(id=>{ if(deadSet.has(id)) delete state.persist.mp[id]; }); }
        }
      }
      // EP로 이동하는 경우: 그 EP로 이어지는 루트를 자동 방문 처리(재선택 방지)
      if(nextId && nextId.startsWith('EP-')){
        const r = (state.data.routes||[]).find(rt=>rt.next===nextId);
        if(r){ if(!state.flags.visitedRoutes) state.flags.visitedRoutes={}; state.flags.visitedRoutes[r.id]=true; }
      }
      if(nextId){
        delete state.ui.battle; state.ui.currentEpisode = nextId;
        const btnEp = document.querySelector('nav button[data-view=episode]');
        if(btnEp){ btnEp.click(); return; }
      }
      // EP-220 처리는 episode 화면에서 resetState가 수행됨
      state.ui.currentEpisode = null; state.ui.battle = null;
      const btn = document.querySelector('nav button[data-view=routes]');
      if(btn){ btn.click(); }
    };
  }
}

// remove cheat panel when leaving battle (expose cleanup)
window.addEventListener('beforeunload', ()=>{ const c=document.getElementById('cheat-panel'); if(c) c.remove(); });



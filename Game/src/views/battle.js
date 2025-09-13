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

  // 루트 동기화: 이 전투(B.id)로 들어오는 루트가 있다면 "읽음/이번 회차 진행"으로 즉시 마킹
  try{
    const rIn = (state.data.routes||[]).find(rt=> rt.next === (B.id||btid));
    if(rIn){
      state.flags = state.flags || {};
      state.flags.visitedRoutes = state.flags.visitedRoutes || {};
      state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
      if(!state.flags.visitedRoutes[rIn.id]) state.flags.visitedRoutes[rIn.id] = true;
      if(!state.flags.runVisitedRoutes[rIn.id]) state.flags.runVisitedRoutes[rIn.id] = true;
      state.flags.lastRouteId = rIn.id;
      console.debug('[battle-sync-route]', { route:rIn.id, battle:B.id });
    }
  }catch{}

  // 적이 이미 모두 사망(또는 없음) 상태라면 즉시 클리어 처리
  try{
    if(window.BATTLE.isBattleFinished(B)){
      console.debug('[finish] auto at mount');
      return showResult(B.winner==='ally');
    }
  }catch(e){ console.debug('[finish-check-error] at mount', e); }

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
    const orderRows = [1,2,3];
    orderRows.forEach(rowNum=>{
      const wrap = document.createElement('div'); wrap.className='row-wrap';
      const line = toLine(rowNum); // [col0, col1, col2]
      line.forEach(id=>{
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
            if(u._burn && u._burn.remain>0){ buf.push(`<div class=\"slot-buff burn\" title=\"화상\"><span>🔥</span><span class=\"turns\">${u._burn.remain}</span></div>`); }
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
    });
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
  // 이동 후보 오버레이 정리 함수 핸들
  let cleanupMoveOverlay = null;
  // 스킬 레벨업 대기 제어
  B.awaitingUpgrade = B.awaitingUpgrade || false;
  B._awaitUpgradeResolve = B._awaitUpgradeResolve || null;

  function debugFinish(tag){
    try{
      const eAlive = (B.enemyOrder||[]).filter(id=>id && (B.units[id]?.hp>0)).length;
      const aAlive = (B.allyOrder||[]).filter(id=>id && (B.units[id]?.hp>0)).length;
      console.debug('[battle-finish-check]', tag, { eAlive, aAlive, winner:B.winner, awaiting:B.awaitingUpgrade });
    }catch(e){ console.debug('[battle-finish-check-error]', tag, e); }
  }

  function hasUpgrade(skillId, upId){
    try{ const baseId=(B.turnUnit||'').split('@')[0]; return (state.skillProgress?.[baseId]?.[skillId]?.taken||[]).includes(upId); }catch{return false;}
  }

  // 업그레이드 적용된 실사용 스킬 미리보기(뷰 전용)
  function getEffectiveSkill(base){
    try{
      if(!base) return base;
      const actorIdLocal = B.turnUnit;
      const baseId = (actorIdLocal||'').split('@')[0];
      const sp = state.skillProgress?.[baseId]?.[base.id];
      if(!sp || !sp.taken || !sp.taken.length) return base;
      const upDefs = (state.data?.skills?.[base.id]?.upgrades)||[];
      const copy = JSON.parse(JSON.stringify(base));
      const applyEffect = (obj, eff)=>{
        const segs = String(eff.path||'').split('.').filter(Boolean);
        let cur = obj; for(let i=0;i<segs.length-1;i++){ const k=segs[i]; if(!(k in cur)) cur[k]={}; cur=cur[k]; }
        const last = segs[segs.length-1]; const op = eff.op||'set'; const val = eff.value;
        if(op==='set') cur[last] = val;
        else if(op==='add') cur[last] = (cur[last]||0) + Number(val||0);
        else if(op==='mul') cur[last] = (cur[last]||0) * Number(val||1);
      };
      const countById = sp.taken.reduce((m,id)=>{ m[id]=(m[id]||0)+1; return m; },{});
      upDefs.forEach(up=>{ const n=countById[up.id]||0; for(let i=0;i<n;i++){ (up.effects||[]).forEach(e=> applyEffect(copy, e)); }});
      return copy;
    }catch{ return base; }
  }

  function getSlotByIdOrBase(targetId){
    // 우선 정확 ID 검색
    let lane = B.enemyOrder.includes(targetId)? enemyLane : (B.allyOrder.includes(targetId)? allyLane : null);
    let el = lane? lane.querySelector(`.unit-slot[data-unit-id="${targetId}"]`) : null;
    if(el) return { lane, el };
    // 베이스ID로 보정 검색
    const base = (targetId||'').split('@')[0];
    const all = Array.from(document.querySelectorAll('.unit-slot'));
    const found = all.find(n => (n.dataset?.unitId||'').startsWith(base+'@'));
    if(found){
      const inEnemy = B.enemyOrder.includes(found.dataset.unitId);
      return { lane: inEnemy? enemyLane : allyLane, el: found };
    }
    return { lane:null, el:null };
  }

  function refreshCardStates(){
    const cards = cardsEl.querySelectorAll('.action-card');
    cards.forEach(card=>{
      const id = card.dataset.skillId; if(!id) return;
      const baseSk = state.data.skills[id];
      const sk = getEffectiveSkill(baseSk);
      const valid = isTargetValid(sk, selectedTarget || B.target);
      const mpOk = (actor.mp||0) >= (sk.cost?.mp||0);
      card.classList.toggle('disabled', !valid);
      card.classList.toggle('mp-insufficient', !mpOk);
    });
  }

  function isTargetValid(sk, targetId){
    if(!sk) return false;
    // 이동/자기강화(검막) 류는 타겟 불필요
    if(sk.type==='move' || sk.type==='shield') return true;
    if(sk.range==='ally'){
      return !!targetId && B.allyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.range==='ranged'){
      return !!targetId && B.enemyOrder.includes(targetId) && (B.units[targetId]?.hp>0);
    }
    if(sk.range==='melee'){
      // 근접: 모든 적 중 col이 가장 낮은 열만 타격 가능. 그 열이라면 누구나 타겟 가능
      if(!targetId || !B.enemyOrder.includes(targetId) || !(B.units[targetId]?.hp>0)) return false;
      const alive = B.enemyOrder.filter(id=> id && (B.units[id]?.hp>0));
      if(!alive.length) return false;
      const minCol = Math.min(...alive.map(id=> B.units[id]?.col ?? 999));
      const tCol = B.units[targetId]?.col;
      return tCol===minCol;
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
      // 대상 강제이동은 사전 이동 가능성 검사를 하지 않는다(막혀도 스킬 사용 가능)
      if(sk.type!=='row' && sk.type!=='line'){
        if(!targetId) return false;
      }
    }
    // 순수 이동/자기강화(검막) 스킬은 타겟 불필요
    if(sk.type==='move' || sk.type==='shield') return true;
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
    const es = getEffectiveSkill(selectedSkill);
    if(es.type==='row'){
      let targetRow = null;
      if(Array.isArray(es.to) && es.to.length===1){ targetRow = es.to[0]; }
      else if(selectedTarget){ targetRow = B.units[selectedTarget]?.row || null; }
      if(!targetRow) return;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.row===targetRow){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(es.type==='line' && selectedTarget){
      const col = B.units[selectedTarget]?.col;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.col===col){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(es.type==='cross' && selectedTarget){
      const r = B.units[selectedTarget]?.row; const c = B.units[selectedTarget]?.col;
      B.enemyOrder.forEach(id=>{ if(!id) return; const u=B.units[id]; if(!u) return; if(u.row===r || u.col===c){ const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${id}"]`); if(el) el.classList.add('is-aoe'); } });
    } else if(es.type==='strike' || es.type==='multi' || es.type==='poison'){
      if(!selectedTarget) return; const el = enemyLane.querySelector(`.unit-slot[data-unit-id="${selectedTarget}"]`); if(el) el.classList.add('is-aoe');
    }
  }

  // 타겟 힌트: 최종 명중률 배지 + 예상 HP 감소 오버레이
  function updateTargetHints(){
    // 기존 배지/오버레이 제거
    document.querySelectorAll('.unit-slot .hit-badge').forEach(n=>n.remove());
    document.querySelectorAll('.unit-slot .hpbar .pred').forEach(p=>{ p.style.width='0%'; p.style.left='0%'; });
    if(!selectedSkill) return;
    const es = getEffectiveSkill(selectedSkill);
    const actor = B.units[B.turnUnit]; if(!actor) return;
    if(!canExecute(selectedSkill, selectedTarget || B.target)) return;

    // 대상 집합 구하기: 단일/라인/로우
    let targetIds = [];
    const fallbackTid = selectedTarget || B.target;
    if(es.range==='ally'){
      // only ally target; show hint on selected ally target only
      if(fallbackTid && B.allyOrder.includes(fallbackTid)) targetIds = [fallbackTid];
      else return;
    }
    if(es.type==='row'){
      let targetRow = null;
      if(Array.isArray(es.to) && es.to.length===1){ targetRow = es.to[0]; }
      else if(fallbackTid){ targetRow = B.units[fallbackTid]?.row || null; }
      if(targetRow){ targetIds = B.enemyOrder.filter(id=>id && (B.units[id]?.hp>0) && (B.units[id]?.row===targetRow)); }
    } else if(es.type==='line'){
      if(!fallbackTid) return; const col = B.units[fallbackTid]?.col;
      targetIds = B.enemyOrder.filter(id=>id && (B.units[id]?.hp>0) && (B.units[id]?.col===col));
    } else {
      if(!fallbackTid) return; targetIds = [fallbackTid];
    }
    if(!targetIds.length) return;

    // 각 대상에 대해 배지/예상 피해 세그먼트 표시
    const rawAcc = Math.max(0, Math.min(1, (es.acc||1)));
    const addAcc = Math.max(0, es.accAdd||0);
    const hits = Math.max(1, es.hits||1);
    const lane = (es.range==='ally') ? allyLane : enemyLane; // 대상 레인
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
          const w=x.e.when||{}; if(w.damageType && es.damageType!==w.damageType) return false; return x.e.hook==='modifyDodge';
        }).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
        const groupBest={};
        matching.forEach(x=>{ const g=x.p.group||x.e.group||x.p.id; const val=x.e?.add?.dodge||0; if(!(g in groupBest) || (x.e.priority||0)<(groupBest[g].prio||0)){ groupBest[g]={val, prio:(x.e.priority||0)}; } });
        Object.values(groupBest).forEach(v=> addDodge+=v.val);
      }catch(e){ /* fail-soft */ }
      const dodgeBase = Math.max(0, Math.min(1, (target.dodge||0)));
      const dodgeFinal = Math.max(0, Math.min(1, dodgeBase + addDodge));
      const accFinal = (addAcc>0) ? Math.max(0, Math.min(1, rawAcc + addAcc - dodgeFinal)) : (rawAcc * (1 - dodgeFinal));
      const finalHit = es.type==='heal' ? 100 : Math.round(accFinal * 100);
      // 피해 가감 패시브가 있는 경우 예상 피해에도 반영
      let expectedDamageMul = 1;
      try{
        const passives = state.data?.passives || {};
        const source = B.units[B.turnUnit];
        const effects = [];
        const collect=(ids, applyTo)=>{ (ids||[]).forEach(pid=>{ const p=passives[pid]; if(!p) return; (p.effects||[]).forEach(e=> effects.push({p,e,applyTo})); }); };
        collect(Array.isArray(source.passives)?source.passives:[], 'outgoing');
        collect(Array.isArray(target.passives)?target.passives:[], 'incoming');
        const dmgList = effects.filter(x=> x.e.hook==='modifyDamage' && (!x.e.applyTo || x.e.applyTo==='outgoing' || x.e.applyTo==='incoming')).filter(x=>{ const w=x.e.when||{}; if(w.damageType && es.damageType!==w.damageType) return false; return true; }).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
        const groupBest={};
        dmgList.forEach(x=>{ const g=x.p.group||x.e.group||x.p.id; const mul=(x.e?.mul?.damage)||1; if(!(g in groupBest) || (x.e.priority||0)<(groupBest[g].prio||0)){ groupBest[g]={mul, prio:(x.e.priority||0)}; } });
        Object.values(groupBest).forEach(v=>{ expectedDamageMul *= (v.mul||1); });
      }catch(e){ /* noop */ }
      let base = (es.type==='heal')
        ? Math.max(1, Math.round((actor.mag||0) * (es.coeff||1)))
        : Math.max(1, Math.round(((actor.atk||1) * (es.coeff||1)) - (target.def||0)));
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
        if(es.type==='heal'){
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
      const baseSk = state.data.skills[skId]; if(!baseSk) return null; const es = getEffectiveSkill(baseSk); const usable = canExecute(es, selectedTarget || B.target); const mpOk = (actor.mp||0) >= (es.cost?.mp||0); return { sk: baseSk, es, usable, mpOk, idx };
    }).filter(Boolean).sort((a,b)=> a.idx - b.idx); // 항상 원래 스킬 순서 유지
    enriched.forEach(({sk, es, mpOk})=>{
      const card = document.createElement('div'); card.className='action-card'+(selectedSkill?.id===sk.id?' selected':'');
      if(!mpOk) card.classList.add('mp-insufficient');
      card.dataset.skillId = sk.id;
      const targetText = (es.type||sk.type)==='row' ? (Array.isArray(es.to)&&es.to.length===1? `전열 전체` : `선택 라인 전체`) : ((es.range||sk.range)==='melee'? '근접: 최전열(가장 낮은 col)만' : ((es.range||sk.range)==='ranged'? '원거리: 전체 선택 가능' : ((es.to||sk.to)? ((es.to||sk.to).includes(1)? '전열' : '후열') : '대상: 전/후열')));
      // es 준비: 이미 계산됨
      const accBasePct = Math.round((((es.acc!=null? es.acc : sk.acc)||1) * 100));
      const accAddPct = Math.round((Math.max(0, ((es.accAdd!=null? es.accAdd : sk.accAdd)||0)) * 100));
      // 스킬 진행도: 유닛별 진행도에서 조회
      const baseId = (B.turnUnit||'').split('@')[0];
      const sp = (state.skillProgress?.[baseId]?.[sk.id]) || { level:1, xp:0, nextXp: (state.data.skills?.SKILL_CFG?.baseNext||20) };
      // 선택된 강화 요약(스택 개수 포함)
      const taken = (sp.taken||[]);
      const upDefs = state.data.skills?.[sk.id]?.upgrades||[];
      const countById = taken.reduce((m,id)=>{ m[id]=(m[id]||0)+1; return m; },{});
      const takenNames = Object.keys(countById).map(id=>{
        const def = upDefs.find(u=>u.id===id); const n = countById[id];
        if(!def) return null; return `${def.name}${n>1?` x${n}`:''}`;
      }).filter(Boolean);
      const upLine = takenNames.length? `강화: ${takenNames.join(', ')}` : '';
      // Max 판단: once 업그레이드 전부 획득했고 stack 업그레이드가 없으면 Max
      const upAll = state.data.skills?.[sk.id]?.upgrades||[];
      const hasStack = upAll.some(u=>u.type==='stack');
      const allOnceIds = upAll.filter(u=>u.type==='once').map(u=>u.id);
      const onceDone = allOnceIds.length>0 ? allOnceIds.every(id=> (sp.taken||[]).includes(id)) : false;
      const isMax = (!hasStack) && (onceDone || upAll.length===0);
      const lvLine = isMax ? `Lv.Max` : `Lv.${sp.level} (${sp.xp}/${sp.nextXp})`;

      // 2행: 공격 속성(범위/사거리/속성)
      const isRowByUpgrade = (!!countById['SK01_ROW']) || sk.type==='row';
      const rowName = (r)=> r===1? '전열' : r===2? '중열' : '후열';
      const areaText = (function(){
        if(sk.type==='line') return '세로열';
        if(isRowByUpgrade){
          if(Array.isArray(sk.to) && sk.to.length===1) return `가로열(${rowName(sk.to[0])})`;
          return '가로열';
        }
        if(sk.type==='move') return '이동 전용';
        if(sk.range==='ally' || sk.type==='heal') return '단일';
        return '단일';
      })();
      const rangeText = (es.range||sk.range)==='melee'? '근접' : (es.range||sk.range)==='ranged'? '원거리' : '아군';
      const dmgTypeText = ((es.type||sk.type)==='move' || (es.type||sk.type)==='shield') ? '' : ((es.damageType||sk.damageType)==='slash'? '참격' : (es.damageType||sk.damageType)==='pierce'? '관통' : (es.damageType||sk.damageType)==='magic'? '마법' : (es.damageType||sk.damageType)==='blunt'? '타격' : ((es.type||sk.type)==='heal'?'지원':''));

      // 3행: 명중률(보정 0%면 숨김)
      const accLine = `명중: ${accBasePct}%` + (accAddPct>0? ` (+${accAddPct}%)` : '');

      // 4행: 대미지(타수 2회 이상만 표기)
      let coeffEff = ((es.coeff!=null? es.coeff : sk.coeff)||1);
      const dmgStack = countById['SK01_DMG30']||0;
      if(dmgStack>0){ coeffEff = Math.round((coeffEff * Math.pow(1.3, dmgStack))*100)/100; }
      const hits = Math.max(1, ((es.hits!=null? es.hits : sk.hits)||1));
      const dmgPercent = `${Math.round(coeffEff*100)}%` + (hits>=2? ` x ${hits}` : '');
      const dmgLine = ((es.type||sk.type)==='heal') ? `치유: ${Math.round((((es.coeff!=null? es.coeff : sk.coeff)||1)*100))}%` : (((es.type||sk.type)==='move' || (es.type||sk.type)==='shield') ? `` : `대미지: ${dmgPercent}`);

      // 5행: 추가 옵션(버프/디버프 등)
      const extraLine = (()=>{
        const parts = [];
        if(es.bleed){ parts.push(`출혈 ${Math.round((es.bleed.chance||0.5)*100)}% · ${es.bleed.duration||3}턴`); }
        if((es.type||sk.type)==='poison' || sk.id==='SK-22'){ parts.push(`중독 ${((state.data.skills['SK-22']?.duration)||3)}턴`); }
        return parts.join(' · ');
      })();

      // 카드 마크업: 상단(이름+레벨/경험치, 우측 MP), 속성, 명중, 대미지, 추가옵션
      const titleLine = `<div class="title"><strong>${es.name||sk.name||sk.id}</strong> <span class="lv">${lvLine}</span></div>`;
      const attrPills = [areaText, rangeText].concat(dmgTypeText? [(dmgTypeText==='지원'? '지원' : (dmgTypeText+'대미지'))] : []);
      const attrLine = `<div class="attr">${attrPills.map(t=>`<span class=\"pill\">${t}</span>`).join('')}</div>`;
      const hitLine = `<div class="hit">${accLine}</div>`;
      const dmgLineHtml = `<div class="dmg">${dmgLine}</div>`;
      const extraHtml = extraLine? `<div class="extra">${extraLine}</div>` : '';
      card.innerHTML = `${titleLine}${attrLine}${hitLine}${(dmgLine?dmgLineHtml:'')}${extraHtml}<div class="cost">MP ${sk.cost?.mp||0}</div>`;
      card.onclick=async (ev)=>{
        // if already selected and executable → use skill immediately
        const already = selectedSkill?.id === sk.id;
        // 스킬 전환 시 기존 이동 오버레이 정리
        if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
        selectedSkill = es;
        document.querySelectorAll('.action-card.selected').forEach(x=>x.classList.remove('selected'));
        card.classList.add('selected');
        refreshCardStates();
        updateAOEHighlight();
        updateTargetHints();
        // 이동형(능동) 스킬: 이동 목적지 선택 UI 진입
        if((es.type||sk.type)==='move'){
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
        // 슬롯 클릭 시 남아있는 이동 오버레이 정리
        if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
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
    // 시작 전에 기존 오버레이 정리
    if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
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
      // grid에서 해당 row/col에 있는 유닛 슬롯 요소를 찾아야 함: 현재 그리드는 row-wrap(행)/slot(열) 순으로 고정 3x3
      const rowIndex = Math.max(0, Math.min(2, (tile.row||1) - 1)); // 행: 1,2,3 → 0,1,2
      const colIndex = Math.max(0, Math.min(2, tile.col||0));       // 열: 0,1,2 그대로
      const rowWrap = lane.querySelectorAll('.row-wrap')[rowIndex];
      if(!rowWrap) return null;
      const slot = rowWrap.querySelectorAll('.slot')[colIndex];
      if(!slot) return null;
      // 고스트 .unit-slot을 후보 표시용으로 활성화(슬롯 크기 대신 유닛 슬롯 크기로 딱 맞춤)
      let ghost = slot.querySelector('.unit-slot');
      if(!ghost){ ghost = document.createElement('div'); ghost.className='unit-slot'; slot.appendChild(ghost); }
      ghost.style.opacity = '1';
      ghost.classList.add('move-candidate-ghost');
      ghost.dataset.row = String(tile.row);
      ghost.dataset.col = String(tile.col);
      return ghost;
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
    function cleanup(){
      try{
        marked.forEach(el=>{
          el.classList.remove('move-candidate');
          el.classList.remove('move-candidate-ghost');
          // 유닛이 아닌 임시 고스트라면 제거
          if(!el.dataset.unitId){ try{ el.remove(); }catch{} }
        });
        document.querySelectorAll('.slot.move-candidate').forEach(n=> n.classList.remove('move-candidate'));
      }catch{}
      window.UI_TIP?.hideTooltip();
    }
    cleanupMoveOverlay = cleanup;
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
    // 애니메이션 세대 토큰: 재호출 시 이전 예약 콜백 무시
    B._animGen = (B._animGen||0) + 1;
    const animGen = B._animGen;
    const step = 500; // 0.5s 간격(단일 다단히트용)
    let seqDelay = 0; // 누적 지연(다단히트에만 적용)
    const needsDelay = events.some(ev=> ev.isMulti === true);
    let lastWasHit = false;
    let maxEnd = 0; // 전체 스케줄 종료 시각(ms)

    console.debug('[anim] queue', events.length, 'items');
    events.forEach((ev, idx)=>{
      // 시작 시각 계산
      let startAt = 0;
      if((ev.type==='hit' || ev.type==='miss') && ev.isMulti){ startAt = seqDelay; seqDelay += step; lastWasHit = (ev.type==='hit'); }
      else if(ev.type==='dead'){ startAt = Math.max(800, seqDelay); lastWasHit = false; } // 딜레이 단축
      else { startAt = 0; lastWasHit = (ev.type==='hit'); }

      const scheduleAt = startAt;

      // 각 이벤트의 표시/유지 시간(대략)
      let duration = 300; // 기본
      if(ev.type==='hit' || ev.type==='miss' || ev.type==='skillLevelUp') duration = 300; // 텍스트 유지 시간
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
        } else if(ev.type==='skillLevelUp'){
          // 전투 중 즉시 레벨업: 선택 모달 표시(간단 UI)
          const uId = ev.unit; const sId = ev.skillId; const u = B.units[uId];
          B.awaitingUpgrade = true;
          const modal = document.createElement('div'); modal.className='modal-backdrop';
          const box = document.createElement('div'); box.className='modal';
          box.innerHTML = `<h3>스킬 레벨업</h3><p>${u?.name||uId}의 ${state.data.skills[sId]?.name||sId} Lv.${(state.skillProgress?.[uId.split('@')[0]]?.[sId]?.level)||''}</p><div class="actions" id="upList"></div>`;
          modal.appendChild(box); frame.appendChild(modal);
          const list = box.querySelector('#upList');
          // 실제 업그레이드 풀에서 3개 랜덤 추출
          const baseId = uId.split('@')[0];
          state.skillProgress = state.skillProgress || {}; state.skillProgress[baseId] = state.skillProgress[baseId] || {}; state.skillProgress[baseId][sId] = state.skillProgress[baseId][sId] || { level:1, xp:0, nextXp: (state.data.skills?.SKILL_CFG?.baseNext||20), taken:[] };
          const progress = state.skillProgress[baseId][sId];
          const pool = (state.data.skills?.[sId]?.upgrades||[]).filter(up=> up && (up.type!=='once' || !(progress.taken||[]).includes(up.id)));
          const rng = state.rng || { int:(n)=> Math.floor(Math.random()*n) };
          const picks = [];
          for(let i=0;i<Math.min(3, pool.length);i++){ const idx = rng.int(pool.length); picks.push(pool.splice(idx,1)[0]); }
          if(!picks.length){
            // 더 이상 선택 불가 → 모달 표시 없이 즉시 계속 진행
            try{ modal.remove(); }catch{}
            B.awaitingUpgrade=false; if(typeof B._awaitUpgradeResolve==='function'){ const fn=B._awaitUpgradeResolve; B._awaitUpgradeResolve=null; fn(); }
            // 카드 갱신(Lv.Max 표기 반영)
            renderBattleView(root, state);
            // 전멸 상태면 즉시 종료
            if(window.BATTLE.isBattleFinished(B)){ showResult(B.winner==='ally'); }
            return;
          }
          picks.forEach(up=>{
            const b=document.createElement('button'); b.className='btn'; b.innerHTML = `<strong>${up.name}</strong><br><span style="font-size:12px; color:#9aa0a6;">${up.desc||''}</span>`;
            b.onclick=()=>{
              // 진행도에 반영
              state.skillProgress = state.skillProgress || {}; state.skillProgress[baseId] = state.skillProgress[baseId] || {}; state.skillProgress[baseId][sId] = state.skillProgress[baseId][sId] || { level:1, xp:0, nextXp: (state.data.skills?.SKILL_CFG?.baseNext||20), taken:[] };
              const sp = state.skillProgress[baseId][sId];
              sp.taken = sp.taken || [];
              sp.taken.push(up.id);
              modal.remove();
              B.awaitingUpgrade=false; if(typeof B._awaitUpgradeResolve==='function'){ const fn=B._awaitUpgradeResolve; B._awaitUpgradeResolve=null; fn(); }
              // 카드 즉시 갱신을 위해 재렌더
              renderBattleView(root, state);
              // 업그레이드 선택 직후, 적 전멸이면 즉시 종료
              if(window.BATTLE.isBattleFinished(B)){ showResult(B.winner==='ally'); }
            };
            list.appendChild(b);
          });
        } else if(ev.type==='hit'){
          const toId = ev.to; const fromId = ev.from;
          const { lane:targetLane, el:slotEl } = getSlotByIdOrBase(toId);
          if(slotEl){
            // 비네팅(타격 대상 강조)
            slotEl.classList.add('is-aoe'); setTimeout(()=>slotEl.classList.remove('is-aoe'), 260);
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
          } else { console.warn('[anim-hit] slot not found', { toId, lane: B.enemyOrder.includes(toId)? 'enemy':'ally' }); }
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
          const toId = ev.to; const targetLane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = targetLane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){ const miss = document.createElement('div'); miss.className='miss-float'; miss.textContent='MISS'; miss.style.left='50%'; miss.style.top='0'; slotEl.appendChild(miss); setTimeout(()=>miss.remove(), 800); }
          const fromId = ev.from; const fromLane = B.enemyOrder.includes(fromId) ? enemyLane : allyLane; const fromEl = fromLane.querySelector(`.unit-slot[data-unit-id="${fromId}"]`);
          if(fromEl){ const cls = B.enemyOrder.includes(fromId)? 'lunge-enemy' : 'lunge-ally'; fromEl.classList.add(cls); setTimeout(()=>fromEl.classList.remove(cls), 220); }
        } else if(ev.type==='shield'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){ const sv = (typeof ev.shield==='number')? ev.shield : (B.units[toId].shield||0); const sbar = slotEl.querySelector('.shieldbar > span'); if(sbar){ sbar.style.width = `${Math.max(0, Math.min(100, (sv/(B.units[toId].hpMax||1))*100))}%`; const barWrap = sbar.parentElement; if(barWrap){ barWrap.style.display = (sv>0)? 'block' : 'none'; } } const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `+SHIELD ${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900); }
        } else if(ev.type==='heal'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='heal-float'; fx.textContent = `+${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
          }
        } else if(ev.type==='poison'){
          // 적용 시점: 디버프 부여 알림 + 즉시 아이콘/남은 턴 갱신
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
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
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const bar = slotEl.querySelector('.hpbar > span'); if(bar && typeof ev.hp==='number'){ bar.style.width = `${Math.max(0,(ev.hp/(B.units[toId].hpMax||1))*100)}%`; }
            const fx = document.createElement('div'); fx.className='poison-float'; fx.textContent = `-${ev.amount||0}`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 900);
            // 남은 턴 수 갱신(0이 되면 제거)
            let icon = slotEl.querySelector('.slot-buffs .poison');
            if(icon){ const t = icon.querySelector('.turns'); if(t){ const next = Math.max(0, Number(t.textContent||'1') - 1); t.textContent = `${next}`; if(next<=0) icon.remove(); } }
          }
        } else if(ev.type==='bleed'){
          // 출혈 부여 알림 + 아이콘 추가/갱신
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
          if(slotEl){
            const fx = document.createElement('div'); fx.className='miss-float'; fx.textContent = `BLEED`; fx.style.left='50%'; fx.style.top='0'; slotEl.appendChild(fx); setTimeout(()=>fx.remove(), 800);
            let icon = slotEl.querySelector('.slot-buffs .bleed');
            if(!icon){
              const bufWrap = slotEl.querySelector('.slot-buffs');
              if(bufWrap){ bufWrap.insertAdjacentHTML('beforeend', `<div class="slot-buff bleed" title="출혈"><span>🩸</span><span class="turns">${ev.duration||3}</span></div>`); }
            } else { const t = icon.querySelector('.turns'); if(t){ t.textContent = `${ev.duration||3}`; } }
          }
        } else if(ev.type==='bleedTick'){
          const toId = ev.to; const lane = B.enemyOrder.includes(toId) ? enemyLane : allyLane; const slotEl = lane.querySelector(`.unit-slot[data-unit-id="${toId}"]`);
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
    if(cleanupMoveOverlay){ try{ cleanupMoveOverlay(); }catch{} cleanupMoveOverlay=null; }
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
    // 업그레이드 대기 시, 사용자가 선택할 때까지 멈춤
    if(B.awaitingUpgrade){ console.debug('[upgrade-wait] start after player turn'); await new Promise(r=>{ B._awaitUpgradeResolve = r; }); console.debug('[upgrade-wait] done after player turn'); }
    // 다음 턴 시작 효과(중독/재생 등) 즉시 적용 및 연출
    if(B.turnUnit && B.turnStartProcessedFor !== B.turnUnit){
      window.BATTLE.applyTurnStartEffects(B);
      const extraDelay = animateFromLog();
      await new Promise(r=>setTimeout(r, Math.max(250, extraDelay||0)));
      B.turnStartProcessedFor = B.turnUnit;
    }
    // 턴이 넘어간 후 하이라이트를 갱신
    setTurnHighlight();
    debugFinish('after-player-turn');
    if(!B.awaitingUpgrade && window.BATTLE.isBattleFinished(B)){ console.debug('[finish] end after player turn', { battleId:B.id, winner:B.winner }); return showResult(B.winner==='ally'); }
    if(B.awaitingUpgrade){ console.debug('[upgrade-wait] start before enemy phase'); await new Promise(r=>{ B._awaitUpgradeResolve = r; }); debugFinish('after-upgrade-before-enemy'); if(window.BATTLE.isBattleFinished(B)){ console.debug('[finish] end after upgrade before enemy'); return showResult(B.winner==='ally'); } }
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
      // 적 턴에도 업그레이드가 발생하면 대기
      if(B.awaitingUpgrade){ console.debug('[upgrade-wait] start during enemy phase'); await new Promise(r=>{ B._awaitUpgradeResolve = r; }); console.debug('[upgrade-wait] done during enemy phase'); }
      // 스킬 처리로 다음 턴 유닛으로 넘어갔으므로 하이라이트 갱신
      setTurnHighlight();
      debugFinish('after-enemy-turn-iteration');
      if(window.BATTLE.isBattleFinished(B)){ console.debug('[finish] end after enemy iteration', { battleId:B.id, winner:B.winner }); showResult(B.winner==='ally'); return; }
    }
    // 애니메이션이 모두 끝난 후에만 리렌더(연출 보존)
    if(!B.refreshScheduled){
      B.refreshScheduled = true;
      setTimeout(()=>{
        B.refreshScheduled = false;
        debugFinish('enemy-phase-tail');
        if(!window.BATTLE.isBattleFinished(B) && !B.animating){
          renderBattleView(root, state);
        }
      }, 120);
    }
  }

  function showResult(isWin){
    const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `<h3>${isWin? '승리': '패배'}</h3><p>${isWin? '전투에서 승리했습니다.': '전투에서 패배했습니다.'}</p><div class="actions"><button class="btn" id="btnToRoutes">루트로</button></div>`;
    backdrop.appendChild(modal); frame.appendChild(backdrop);
    modal.querySelector('#btnToRoutes').onclick=()=>{
      console.debug('[finish-click]', { isWin, battleId:B.id });
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
      try{
        const key = `bt.${B.id||'BT-010'}.win`;
        import('../engine/rules.js').then(mod=>{
          const setFlag = mod.setFlag || ((st,k,v)=>{ st.flags=st.flags||{}; st.flags[k]=v; });
          setFlag(state, key, isWin);
        }).catch(()=>{ state.flags[key] = isWin; });
      }catch{ const key = `bt.${B.id||'BT-010'}.win`; state.flags[key] = isWin; }
      delete state.ui.battleState;
      const curBid = B.id || 'BT-010';
      // 전투 데이터 기반 분기: winNext/loseNext가 있으면 해당 타겟으로 이동
      const btData = state.data?.battles?.[curBid];
      const nextId = isWin ? (btData?.winNext || null) : (btData?.loseNext || null);
      console.debug('[finish-next]', { curBid, isWin, nextId, btData });
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
        if(r){
          if(!state.flags.visitedRoutes) state.flags.visitedRoutes={};
          state.flags.visitedRoutes[r.id]=true;
          // 이번 회차 진행 기록도 함께 갱신하여 루트 UI 가시성/프론티어가 동작하도록 함
          state.flags.runVisitedRoutes = state.flags.runVisitedRoutes || {};
          state.flags.runVisitedRoutes[r.id] = true;
          state.flags.lastRouteId = r.id;
          console.debug('[finish-mark-route]', { route:r.id, forEpisode: nextId });
        }
      }
      if(nextId){
        delete state.ui.battle; state.ui.currentEpisode = nextId;
        console.debug('[finish-nav-episode]', { nextId });
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



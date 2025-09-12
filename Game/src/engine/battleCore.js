// Minimal battle core extracted from app.js prototype
export function createBattleState(state, battle){
  const units = {};
  const inst = (baseId, tag, idx, placement)=>{
    if(!baseId) return null;
    const base = state.data.units[baseId];
    if(!base) return null;
    const id = `${baseId}@${tag}${idx}`;
    const posOverride = state.party.positions?.[baseId];
    const legacyPos = posOverride ?? base.position ?? base.row ?? 2;
    // map legacy 1..9 to row 1..3 (front=1, mid=2, rear=3). If already 1..3, keep.
    const rowFromLegacy = legacyPos <= 3 ? legacyPos : Math.min(3, Math.max(1, Math.ceil(legacyPos/3)));
    let row = tag==='A' ? (Math.floor(idx/3)+1) : rowFromLegacy;
    let col = tag==='A' ? (idx%3) : (Number.isInteger(base?.position) ? ((base.position-1)%3) : undefined);
    // Battle-specific placement override for enemies
    if(tag==='E' && placement){
      if(Number.isInteger(placement.position)){
        const p = placement.position;
        row = p <= 3 ? p : Math.min(3, Math.max(1, Math.ceil(p/3)));
        col = (p-1)%3;
      } else {
        if(Number.isInteger(placement.row)) row = Math.min(3, Math.max(1, placement.row));
        if(Number.isInteger(placement.col)) col = Math.min(2, Math.max(0, placement.col));
      }
    }
    const mpMax = base.mpMax ?? base.mp ?? 0;
    const persistedHp = state.persist?.hp?.[baseId];
    const persistedMp = state.persist?.mp?.[baseId];
    const hpMax = base.hpMax ?? base.hp;
    const hp = Math.max(0, Math.min(hpMax, (persistedHp ?? base.hp)));
    const mp = Math.max(0, Math.min(mpMax, (persistedMp ?? mpMax)));
    units[id] = { ...base, id, hp, hpMax, row, col, mp, mpMax };
    return id;
  };
  const allyOrder = state.party.members.map((id,i)=>inst(id,'A',i)).filter(Boolean);
  const enemyOrder = (battle.enemy||[]).map((entry,i)=>{
    if(!entry) return null;
    if(typeof entry === 'string') return inst(entry,'E',i,null);
    const baseId = entry.unit || entry.id;
    return inst(baseId,'E',i, entry);
  }).filter((v,i)=> i<9 && v); // cap 9
  // Enforce unique (row,col) per enemy; if collision, place to next available slot (row/col)
  const occ = { 1:[null,null,null], 2:[null,null,null], 3:[null,null,null] };
  enemyOrder.forEach(id=>{
    const u = units[id]; if(!u) return;
    const tryPlace = (row, col)=>{ if(!occ[row][col]){ occ[row][col]=id; u.row=row; u.col=col; return true; } return false; };
    let row = Math.min(3, Math.max(1, u.row||2));
    let col = (typeof u.col==='number' && u.col>=0 && u.col<=2) ? u.col : 0;
    if(!tryPlace(row, col)){
      // try other columns in same row
      let placed=false;
      for(let c=0;c<3;c++){ if(tryPlace(row, c)){ placed=true; break; } }
      // try other rows circular if row is full
      if(!placed){
        for(let step=1; step<=2 && !placed; step++){
          const nr = ((row-1+step)%3)+1; // 1→2→3→wrap
          for(let c=0;c<3;c++){ if(tryPlace(nr, c)){ placed=true; break; } }
        }
      }
      // if still not placed (grid full), leave as-is (should not happen due to cap 9)
    }
  });
  const all = [...allyOrder, ...enemyOrder];
  const queue = all.sort((a,b)=> (units[b].spd||0) - (units[a].spd||0));
  // 조작 턴은 아군만: 적이 선두라면 아군 중 최속으로 시작 지점 보정
  if(queue.length && !allyOrder.includes(queue[0])){
    const fastestAlly = allyOrder.filter(Boolean).sort((a,b)=> (units[b].spd||0)-(units[a].spd||0))[0];
    if(fastestAlly){
      const i = queue.indexOf(fastestAlly);
      if(i>0){ queue.splice(i,1); queue.unshift(fastestAlly); }
    }
  }
  const turnUnit = queue[0];
  return { allyOrder, enemyOrder, queue, turnUnit, target:null, units, winner:null, rng: state.rng, log: [], id: battle?.id, battle, partySnapshot: (state.party.members||[]).slice(), positionsSnapshot: { ...(state.party.positions||{}) }, turn: 1, turnStartProcessedFor: null, lastTarget: {}, deadAllies: [] };
}

// Movement helpers
function isAllyId(battleState, unitId){ return battleState.allyOrder.includes(unitId); }
function sideUnits(battleState, unitId){ return isAllyId(battleState, unitId) ? battleState.allyOrder : battleState.enemyOrder; }
function isOccupied(battleState, unitId, row, col){
  const ids = sideUnits(battleState, unitId);
  return ids.some(id=> id && id!==unitId && (battleState.units[id]?.row===row) && (battleState.units[id]?.col===col));
}
function clampPos(row, col){ return { row: Math.max(1, Math.min(3, row)), col: Math.max(0, Math.min(2, col)) }; }

function stepDelta(dir){
  // forward/back: 전후(행), up/down: 좌우(열)
  if(dir==='forward') return { dr:-1, dc:0 };
  if(dir==='back')    return { dr: 1, dc:0 };
  if(dir==='up')      return { dr: 0, dc:-1 };
  if(dir==='down')    return { dr: 0, dc: 1 };
  if(dir==='upLeft')  return { dr:-1, dc:-1 };
  if(dir==='upRight') return { dr:-1, dc: 1 };
  if(dir==='downLeft')return { dr: 1, dc:-1 };
  if(dir==='downRight')return{ dr: 1, dc: 1 };
  return { dr:0, dc:0 };
}

export function previewMove(state, battleState, unitId, moveSpec){
  if(!unitId || !moveSpec) return { steps:0, path:[], final:null };
  const u = battleState.units[unitId]; if(!u) return { steps:0, path:[], final:null };
  const tiles = Math.max(1, moveSpec.tiles||1);
  const dir = moveSpec.dir||'forward';
  const d = stepDelta(dir);
  let cur = { row: u.row, col: u.col };
  const path = []; let steps=0;
  for(let i=0;i<tiles;i++){
    const next = clampPos(cur.row + d.dr, cur.col + d.dc);
    // out-of-bounds clampPos already handled; treat attempts beyond edge as blocked if it didn't change
    if(next.row===cur.row && next.col===cur.col) break;
    if(isOccupied(battleState, unitId, next.row, next.col)) break;
    path.push({ row: next.row, col: next.col });
    cur = next; steps++;
  }
  return { steps, path, final: steps>0? { row: cur.row, col: cur.col } : null };
}

export function canUseSkill(state, battleState, actorId, targetId, sk){
  if(!sk) return false;
  // allowedRows check
  if(Array.isArray(sk.allowedRows) && sk.allowedRows.length){
    const a = battleState.units[actorId]; if(!a) return false;
    if(!sk.allowedRows.includes(a.row||2)) return false;
  }
  // movement requirement
  if(sk.move && (sk.move.required!==false)){ // 기본: 필요함
    const moverId = (sk.move.who==='actor') ? actorId : targetId;
    const prev = previewMove(state, battleState, moverId, sk.move);
    if(prev.steps<=0) return false;
  }
  return true;
}

export function pickTarget(state, battleState, isAlly, sk){
  const pool = isAlly ? battleState.enemyOrder : battleState.allyOrder;
  const selfSide = isAlly ? battleState.allyOrder : battleState.enemyOrder;
  // respect actor's last target if alive and valid
  const actorId = battleState.turnUnit;
  const remembered = battleState.lastTarget?.[actorId];
  const isAlive = (id)=> id && battleState.units[id] && (battleState.units[id].hp>0);
  // 플레이어가 명시적으로 선택한 대상이 없을 때만 기억된 타겟을 사용
  if(!battleState.target && remembered && isAlive(remembered)){
    if(sk?.range==='ranged'){
      if(pool.includes(remembered)) return remembered;
    }
    if(sk?.range==='ally'){
      if(selfSide.includes(remembered)) return remembered;
    }
    if(sk?.range==='melee'){
      const row = battleState.units[remembered]?.row||1;
      // melee는 최전열만 허용. 기억된 타겟이 최전열이면 유지
      const rows=[1,2,3]; let foremost=null; for(const r of rows){ if(pool.some(id=>isAlive(id) && (battleState.units[id].row===r))){ foremost=r; break; } }
      if(foremost && pool.includes(remembered) && row===foremost) return remembered;
    }
  }
  // ally-targeting skills
  if(sk?.range==='ally'){
    // select from actor's own side (allyOrder for allies, enemyOrder for enemies)
    const selfSide = isAlly ? battleState.allyOrder : battleState.enemyOrder;
    if(battleState.target && selfSide.includes(battleState.target) && (battleState.units[battleState.target]?.hp>0)) return battleState.target;
    if(remembered && selfSide.includes(remembered) && isAlive(remembered)) return remembered;
    return selfSide.find(id=>id && (battleState.units[id]?.hp>0)) || null;
  }
  // melee: alive units in the foremost occupied row
  if(sk?.range==='melee'){
    const rows=[1,2,3];
    for(const r of rows){
      const candidates = pool.filter(id=>id && (battleState.units[id]?.row===r) && (battleState.units[id]?.hp>0));
      if(candidates.length){
        // prefer user-set target if it belongs to this row
        if(battleState.target && candidates.includes(battleState.target)) return battleState.target;
        // fallback to remembered target if it belongs to this row
        if(remembered && candidates.includes(remembered)) return remembered;
        return candidates[0];
      }
    }
    return null;
  }
  // ranged: any alive enemy
  if(sk?.range==='ranged'){
    if(battleState.target && pool.includes(battleState.target) && (battleState.units[battleState.target]?.hp>0)) return battleState.target;
    if(remembered && pool.includes(remembered) && isAlive(remembered)) return remembered;
    return pool.find(id=>id && (battleState.units[id]?.hp>0)) || null;
  }
  // fallback: previous behavior
  const rankAllowed = sk?.to || [1,2];
  if(battleState.target && pool.includes(battleState.target)){
    const row = battleState.units[battleState.target]?.row||1;
    if(rankAllowed.includes(row)) return battleState.target;
  }
  const front = pool.filter(id=>id && rankAllowed.includes((battleState.units[id].row||1)));
  return front[0] || pool.find(Boolean) || null;
}

export function performSkill(state, battleState, actor, sk){
  // helpers
  const clamp01 = (v)=> Math.max(0, Math.min(1, Number.isFinite(v)? v : 0));
  const calcBaseDamage = (attacker, target, skill)=>{
    const coeff = Math.max(0, skill.coeff||0);
    const atk = attacker.atk||1; const def = target.def||0;
    return Math.max(1, Math.round((atk * coeff) - def));
  };
  const applyPassiveModifiers = (state, { attacker, target, skill, acc, dodge, block, crit, dmgMul })=>{
    // Collect passives from source/target
    const passivesMap = state.data?.passives || {};
    const sourceIds = Array.isArray(attacker.passives)? attacker.passives : [];
    const targetIds = Array.isArray(target.passives)? target.passives : [];
    const effects = [];
    const push = (pid, holder, applyTo)=>{
      const p = passivesMap[pid]; if(!p) return;
      (p.effects||[]).forEach(e=>{ effects.push({ p, e, holder, applyTo }); });
    };
    sourceIds.forEach(pid=> push(pid, 'source', 'outgoing'));
    targetIds.forEach(pid=> push(pid, 'target', 'incoming'));
    // Filter hooks and conditions
    const ctx = { attacker, target, skill };
    const matching = effects.filter(x=>{
      if(x.e.applyTo && x.e.applyTo !== x.applyTo) return false;
      const w = x.e.when || {};
      if(w.damageType && skill?.damageType !== w.damageType) return false;
      return true;
    });
    // Group + priority + combine rules
    // Stats start
    let res = { acc, dodge, block, crit, dmgMul: (typeof dmgMul==='number'? dmgMul : 1) };
    const byHook = (hook)=> matching.filter(x=> x.e.hook===hook).sort((a,b)=> (a.e.priority||999)-(b.e.priority||999));
    const applyAdd = (key, add)=>{ if(typeof add==='number'){ res[key] = (res[key]||0) + add; } };
    // modifyDodge: 합연산, 같은 group은 우선순위 높은 것만 적용
    const dodgeList = byHook('modifyDodge');
    const groupMax = {};
    dodgeList.forEach(x=>{
      const g = x.p.group||x.e.group||x.p.id;
      const val = x.e?.add?.dodge || 0;
      if(!(g in groupMax) || (x.e.priority||0) < (groupMax[g].prio||0)){
        groupMax[g] = { val, prio: (x.e.priority||0) };
      }
    });
    Object.values(groupMax).forEach(v=> applyAdd('dodge', v.val));
    // modifyDamage: 곱연산, 그룹 우선 적용(동일 그룹은 우선 하나만), 이후 전부 곱
    const dmgList = byHook('modifyDamage');
    const dmgGroup = {};
    dmgList.forEach(x=>{
      const g = x.p.group||x.e.group||x.p.id;
      const mul = (x.e?.mul?.damage)||1;
      if(!(g in dmgGroup) || (x.e.priority||0) < (dmgGroup[g].prio||0)){
        dmgGroup[g] = { mul, prio: (x.e.priority||0) };
      }
    });
    Object.values(dmgGroup).forEach(v=>{ res.dmgMul = res.dmgMul * (v.mul||1); });
    return res;
  };
  const tryHitOnce = (fromId, attacker, toId, target, skill)=>{
    // hit check
    const rawAcc = clamp01(skill.acc ?? 1);
    const addAcc = Math.max(0, skill.accAdd ?? 0);
    // 기본: acc는 0~1, accAdd가 있을 경우 '평면 보정'으로 dodge와 상쇄
    let acc = rawAcc;
    let dodge = clamp01(target.dodge||0);
    let block = clamp01(target.block||0);
    let crit = clamp01(attacker.crit||0);
    // Passive system: modify stats
    const mod = applyPassiveModifiers(state, { attacker, target, skill, acc, dodge, block, crit });
    acc = clamp01(mod.acc ?? acc);
    dodge = clamp01(mod.dodge ?? dodge);
    block = clamp01(mod.block ?? block);
    crit = clamp01(mod.crit ?? crit);
    if(addAcc > 0){
      // 평면 방식: 최종 명중 = clamp01(rawAcc + addAcc - dodge)
      const finalAcc = clamp01(rawAcc + addAcc - dodge);
      if(battleState.rng.next() > finalAcc){
        battleState.log.push({ type:'miss', from: fromId, to: toId, skill: skill.id, isMulti: (skill.hits||1)>1, hp: target.hp, shield: target.shield||0 });
        return { missed:true, died:false };
      }
    } else {
      // 기존 방식: acc 판정 후 dodge 별도 판정 → 최종 acc*(1-dodge)
      if(battleState.rng.next() > acc){
        battleState.log.push({ type:'miss', from: fromId, to: toId, skill: skill.id, isMulti: (skill.hits||1)>1, hp: target.hp, shield: target.shield||0 });
        return { missed:true, died:false };
      }
      if(battleState.rng.next() < dodge){
        battleState.log.push({ type:'miss', from: fromId, to: toId, skill: skill.id, isMulti: (skill.hits||1)>1 });
        return { missed:true, died:false };
      }
    }
    // block / crit
    const blocked = battleState.rng.next() < block;
    const isCrit = battleState.rng.next() < crit;
    let dmg = calcBaseDamage(attacker, target, skill);
    // Passive damage multiplier
    const mod2 = applyPassiveModifiers(state, { attacker, target, skill, dmgMul:1 });
    dmg = Math.max(1, Math.round(dmg * (mod2.dmgMul||1)));
    if(isCrit) dmg = Math.round(dmg * 1.5);
    if(blocked) dmg = Math.max(1, Math.round(dmg * 0.2));
    // apply shield then hp
    let remaining = dmg;
    if((target.shield||0) > 0){ const use = Math.min(target.shield, remaining); target.shield -= use; remaining -= use; }
    target.hp -= remaining;
    battleState.log.push({ type:'hit', from: fromId, to: toId, dmg, crit, blocked, skill: skill.id, isMulti: (skill.hits||1)>1, hp: target.hp, shield: target.shield||0 });
    const died = target.hp<=0;
    return { missed:false, died };
  };
  const actorId = typeof actor === 'string' ? actor : actor.id;
  const actorUnit = typeof actor === 'string' ? battleState.units[actor] : actor;
  const isAlly = battleState.allyOrder.includes(actorId);
  const pool = isAlly ? battleState.enemyOrder : battleState.allyOrder;
  // MP cost
  const mpCost = sk.cost?.mp || 0;
  if(mpCost>0){ actorUnit.mp = Math.max(0, (actorUnit.mp||0) - mpCost); }
  let targetId = pickTarget(state, battleState, isAlly, sk);
  if(!targetId && sk.type!=='shield' && sk.type!=='heal') return;
  // Movement executor: 적중 후 이동(또는 순수 이동 스킬)
  const doMove=(moverId, moveSpec)=>{
    if(!moverId || !moveSpec) return false;
    // __dest로 정확 좌표가 지정된 경우 그 칸이 비어있고 범위 내면 즉시 이동
    if(moveSpec.__dest){
      const dest = moveSpec.__dest; const u = battleState.units[moverId]; if(!u) return false;
      const cl = clampPos(dest.row, dest.col);
      if(cl.row!==dest.row || cl.col!==dest.col) return false;
      if(isOccupied(battleState, moverId, cl.row, cl.col)) return false;
      const from = { row: u.row, col: u.col };
      battleState.log.push({ type:'move', unit: moverId, from, to: cl });
      u.row = cl.row; u.col = cl.col; return true;
    }
    const prev = previewMove(state, battleState, moverId, moveSpec);
    if(prev.steps<=0) return false;
    const unit = battleState.units[moverId]; if(!unit) return false;
    const from = { row: unit.row, col: unit.col };
    const last = prev.path[prev.path.length-1];
    battleState.log.push({ type:'move', unit: moverId, from, to: last });
    unit.row = last.row; unit.col = last.col;
    return true;
  };

  // 선이동(배우 이동형) 처리: 스킬 사용 시 이동 후 공격/효과 발동
  const maybeMoveActorBefore=()=>{
    if(!sk.move) return;
    if(sk.move.who!=='actor') return;
    const prev = previewMove(state, battleState, actorId, sk.move);
    if((sk.move.required!==false) && prev.steps<=0){ return; }
    if(prev.steps>0){ doMove(actorId, sk.move); }
  };

  // Row-wide skill handling
  if(sk.type==='row'){
    maybeMoveActorBefore();
    const targetRow = (Array.isArray(sk.to) && sk.to.length===1) ? sk.to[0] : (battleState.units[targetId]?.row || 1);
    const targets = pool.filter(id=>id && (battleState.units[id]?.row===targetRow) && (battleState.units[id]?.hp>0));
    targets.forEach(tid=>{
      const tUnit = battleState.units[tid];
      let died=false; let moved=false;
      for(let h=0; h<(sk.hits||1); h++){
        const res = tryHitOnce(actorId, actorUnit, tid, tUnit, sk);
        if(!res.missed && sk.move && sk.move.who==='target' && !moved){
          const moverId = (sk.move.who==='actor') ? actorId : tid;
          moved = doMove(moverId, sk.move);
        }
        if(res.died){ died=true; break; }
      }
      if(died){
        const idx = pool.indexOf(tid); if(idx>-1) pool[idx]=null;
        const qi = battleState.queue.indexOf(tid); if(qi>-1) battleState.queue.splice(qi,1);
        battleState.log.push({ type:'dead', to: tid });
        if(battleState.allyOrder.includes(tid)) battleState.deadAllies.push(tid.split('@')[0]);
      }
    });
  } else if(sk.type==='line'){
    maybeMoveActorBefore();
    // Column-wide skill (vertical line through rows). Determine column from selected target.
    const col = battleState.units[targetId]?.col ?? 0;
    const targets = pool.filter(id=>id && (battleState.units[id]?.col===col) && (battleState.units[id]?.hp>0));
    targets.forEach(tid=>{
      const tUnit = battleState.units[tid];
      let died=false; let moved=false;
      for(let h=0; h<(sk.hits||1); h++){
        const res = tryHitOnce(actorId, actorUnit, tid, tUnit, sk);
        if(!res.missed && sk.move && sk.move.who==='target' && !moved){
          const moverId = (sk.move.who==='actor') ? actorId : tid;
          moved = doMove(moverId, sk.move);
        }
        if(res.died){ died=true; break; }
      }
      if(died){
        const idx = pool.indexOf(tid); if(idx>-1) pool[idx]=null;
        const qi = battleState.queue.indexOf(tid); if(qi>-1) battleState.queue.splice(qi,1);
        battleState.log.push({ type:'dead', to: tid });
        if(battleState.allyOrder.includes(tid)) battleState.deadAllies.push(tid.split('@')[0]);
      }
    });
  } else if(sk.type==='shield'){
    // self-shield buff
    const amt = sk.amount||0; const dur = sk.duration||1;
    actorUnit.shield = (actorUnit.shield||0) + amt;
    // store simple duration on unit
    actorUnit._shieldTurns = Math.max(actorUnit._shieldTurns||0, dur);
    battleState.log.push({ type:'shield', from: actorId, to: actorId, amount: amt, hp: actorUnit.hp, shield: actorUnit.shield||0 });
  } else if(sk.type==='heal'){
    // heal ally single target, amount based on actor.mag and coeff
    const target = battleState.units[targetId] || (battleState.units[actorId]);
    const mag = actorUnit.mag || 0;
    const healAmt = Math.max(1, Math.round((mag) * (sk.coeff||1)));
    target.hp = Math.min(target.hpMax||target.hp, (target.hp||0) + healAmt);
    battleState.log.push({ type:'heal', from: actorId, to: target.id, amount: healAmt, hp: target.hp });
  } else if(sk.type==='regen'){
    // apply a simple regen buff marker on target: amountCoeff * mag per turn for duration
    const target = battleState.units[targetId] || (battleState.units[actorId]);
    const mag = actorUnit.mag || 0;
    const perTurn = Math.max(1, Math.round(mag * (sk.amountCoeff||0.6)));
    // 즉시 1회 회복
    const before = target.hp;
    target.hp = Math.min(target.hpMax||target.hp, (target.hp||0) + perTurn);
    const healed = (target.hp - before);
    if(healed>0){ battleState.log.push({ type:'heal', from: actorId, to: target.id, amount: healed, hp: target.hp }); }
    // 이후 자신의 턴 시작 때만 남은 횟수 만큼 회복
    target._regen = { remain: Math.max(0, (sk.duration||3) - 1), amount: perTurn };
  } else if(sk.type==='poison'){
    maybeMoveActorBefore();
    // 즉발 피해(ATK * coeff) + 중독 부여(최대HP 10%/턴, duration)
    const target = battleState.units[targetId];
    if(target){
      let died = false; let anyHit = false; let moved=false;
      const applyMode = sk.applyOn || 'hit';
      if(applyMode !== 'always'){
        for(let h=0; h<(sk.hits||1); h++){
          const res = tryHitOnce(actorId, actorUnit, targetId, target, sk);
          if(!res.missed){
            anyHit = true;
            if(sk.move && sk.move.who==='target' && !moved){ doMove(targetId, sk.move); moved=true; }
          }
          if(res.died){ died = true; break; }
        }
        if(died){
          const idx = pool.indexOf(targetId); if(idx>-1) pool[idx]=null;
          const qi = battleState.queue.indexOf(targetId); if(qi>-1) battleState.queue.splice(qi,1);
          battleState.log.push({ type:'dead', to: targetId });
          if(battleState.allyOrder.includes(targetId)) battleState.deadAllies.push(targetId.split('@')[0]);
        }
      }
      // 중독 부여: on-hit 또는 always 조건 충족 시 적용. 중첩 대신 갱신
      const canApply = (applyMode==='always') || (anyHit && !died);
      if(canApply && target.hp>0){
        const dur = Math.max(1, sk.duration||3);
        const pct = Math.max(0, sk.dotPct||0.10);
        target._poison = { remain: dur, pct };
        battleState.log.push({ type:'poison', from: actorId, to: targetId, duration: dur, pct });
      }
    }
  } else if(sk.type==='move'){
    // 순수 이동 스킬: 지정 방향(또는 허용 방향 중 가능 방향)으로 이동만 수행
    const moverId = actorId;
    const dirs = Array.isArray(sk.move?.allowedDirs) && sk.move.allowedDirs.length ? sk.move.allowedDirs : [sk.move?.dir||'forward'];
    let moved=false; for(const d of dirs){ if(doMove(moverId, { ...(sk.move||{}), dir:d })){ moved=true; break; } }
    if(!moved && (sk.move?.required)) return;
  } else {
    maybeMoveActorBefore();
    const target = battleState.units[targetId];
    let died = false; let anyHit = false; let moved = false;
    for(let h=0; h<(sk.hits||1); h++){
      const res = tryHitOnce(actorId, actorUnit, targetId, target, sk);
      if(!res.missed) anyHit = true;
      // 첫 적중 시점에 즉시 이동(대상 이동형)
      if(!res.missed && sk.move && sk.move.who==='target' && !moved){ doMove(targetId, sk.move); moved = true; }
      if(res.died){
        died = true; break;
      }
    }
    if(died){
      const idx = pool.indexOf(targetId); if(idx>-1) pool[idx]=null;
      const qi = battleState.queue.indexOf(targetId); if(qi>-1) battleState.queue.splice(qi,1);
      battleState.log.push({ type:'dead', to: targetId });
      if(battleState.allyOrder.includes(targetId)) battleState.deadAllies.push(targetId.split('@')[0]);
    }
    // 루프 내에서 이동 처리했으므로 추가 이동 없음
    // 출혈 부여(스킬 메타에 존재할 경우): "적중 시" 확률로 적용
    if(anyHit && !died && sk.bleed && target && (battleState.rng.next() < Math.max(0, Math.min(1, sk.bleed.chance||0)))){
      const dur = Math.max(1, sk.bleed.duration||3);
      const perTurn = Math.max(1, Math.round((actorUnit.atk||0) * (sk.bleed.coeff||0.3)));
      target._bleed = { remain: dur, amount: perTurn };
      battleState.log.push({ type:'bleed', from: actorId, to: targetId, duration: dur, amount: perTurn });
    }
  }
  // last action tracking removed per spec
  battleState.target = null;
  if(battleState.queue[0]===actorId){ battleState.queue.push(battleState.queue.shift()); }
  while(battleState.queue.length && !battleState.units[battleState.queue[0]]){ battleState.queue.shift(); }
  battleState.turnUnit = battleState.queue[0] || null;
  // remember last target if there was a valid single target
  if(targetId && sk && sk.type!=='row' && sk.type!=='line'){
    battleState.lastTarget = battleState.lastTarget || {};
    battleState.lastTarget[actorId] = targetId;
  }
}

// Apply start-of-turn effects (e.g., regen) when UI highlights the new turn unit
export function applyTurnStartEffects(battleState){
  if(!battleState?.turnUnit) return;
  const u = battleState.units[battleState.turnUnit];
  // DOT: poison (고정 피해, 회피/블록/방어/치명 영향 없음)
  if(u && u._poison && u._poison.remain>0 && u.hp>0){
    const pct = Math.max(0, Math.min(1, u._poison.pct||0));
    const dot = Math.max(1, Math.round((u.hpMax||u.hp) * pct));
    u.hp = Math.max(0, (u.hp||0) - dot);
    battleState.log.push({ type:'poisonTick', from: u.id, to: u.id, amount: dot, hp: u.hp });
    u._poison.remain -= 1; if(u._poison.remain<=0) delete u._poison;
    // 사망 시 즉시 처리: 풀/큐에서 제거하고 턴을 다음으로 넘김
    if(u.hp<=0){
      const pool = (battleState.allyOrder.includes(u.id)) ? battleState.allyOrder : battleState.enemyOrder;
      const idx = pool.indexOf(u.id); if(idx>-1) pool[idx] = null;
      const qi = battleState.queue.indexOf(u.id); if(qi>-1) battleState.queue.splice(qi,1);
      battleState.log.push({ type:'dead', to: u.id });
      if(battleState.allyOrder.includes(u.id)) battleState.deadAllies.push(u.id.split('@')[0]);
      // 다음 턴 유닛 갱신
      battleState.turnUnit = battleState.queue[0] || null;
      return; // regen 등 이후 효과는 적용하지 않음
    }
  }
  if(u && u._regen && u._regen.remain>0 && u.hp>0){
    const before = u.hp; u.hp = Math.min(u.hpMax||u.hp, u.hp + u._regen.amount);
    battleState.log.push({ type:'heal', from: u.id, to: u.id, amount: (u.hp-before), hp: u.hp });
    u._regen.remain -= 1; if(u._regen.remain<=0) delete u._regen;
  }
  // Bleed: 시전자 atk 기반 고정 피해 틱
  if(u && u._bleed && u._bleed.remain>0 && u.hp>0){
    const dot = Math.max(1, Math.round(u._bleed.amount||0));
    u.hp = Math.max(0, (u.hp||0) - dot);
    battleState.log.push({ type:'bleedTick', from: u.id, to: u.id, amount: dot, hp: u.hp });
    u._bleed.remain -= 1; if(u._bleed.remain<=0) delete u._bleed;
    if(u.hp<=0){
      const pool = (battleState.allyOrder.includes(u.id)) ? battleState.allyOrder : battleState.enemyOrder;
      const idx = pool.indexOf(u.id); if(idx>-1) pool[idx] = null;
      const qi = battleState.queue.indexOf(u.id); if(qi>-1) battleState.queue.splice(qi,1);
      battleState.log.push({ type:'dead', to: u.id });
      if(battleState.allyOrder.includes(u.id)) battleState.deadAllies.push(u.id.split('@')[0]);
      battleState.turnUnit = battleState.queue[0] || null;
      return;
    }
  }
}

export function isBattleFinished(battleState){
  const enemyAlive = battleState.enemyOrder.some(id=>id && (battleState.units[id]?.hp>0));
  const allyAlive = battleState.allyOrder.some(id=>id && (battleState.units[id]?.hp>0));
  if(!enemyAlive && allyAlive){ battleState.winner = 'ally'; return true; }
  if(!allyAlive && enemyAlive){ battleState.winner = 'enemy'; return true; }
  return false;
}



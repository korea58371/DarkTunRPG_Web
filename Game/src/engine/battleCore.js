// Minimal battle core extracted from app.js prototype
export function createBattleState(state, battle){
  const units = {};
  const inst = (baseId, tag, idx)=>{
    if(!baseId) return null;
    const base = state.data.units[baseId];
    if(!base) return null;
    const id = `${baseId}@${tag}${idx}`;
    const posOverride = state.party.positions?.[baseId];
    const legacyPos = posOverride ?? base.position ?? base.row ?? 2;
    // map legacy 1..9 to row 1..3 (front=1, mid=2, rear=3). If already 1..3, keep.
    const rowFromLegacy = legacyPos <= 3 ? legacyPos : Math.min(3, Math.max(1, Math.ceil(legacyPos/3)));
    const row = tag==='A' ? (Math.floor(idx/3)+1) : rowFromLegacy;
    const col = tag==='A' ? (idx%3) : (Number.isInteger(base?.position) ? ((base.position-1)%3) : undefined);
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
  const enemyOrder = battle.enemy.map((id,i)=>inst(id,'E',i)).filter((v,i)=> i<9 && v); // cap 9
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
  const turnUnit = queue[0];
  return { allyOrder, enemyOrder, queue, turnUnit, target:null, units, winner:null, rng: state.rng, log: [], id: battle?.id, battle, partySnapshot: (state.party.members||[]).slice(), positionsSnapshot: { ...(state.party.positions||{}) }, turn: 1, turnStartProcessedFor: null, lastTarget: {} };
}

export function pickTarget(state, battleState, isAlly, sk){
  const pool = isAlly ? battleState.enemyOrder : battleState.allyOrder;
  // respect actor's last target if alive and valid
  const actorId = battleState.turnUnit;
  const remembered = battleState.lastTarget?.[actorId];
  const isAlive = (id)=> id && battleState.units[id] && (battleState.units[id].hp>0);
  if(remembered && isAlive(remembered)){
    if(sk?.range==='ranged' || sk?.range==='ally'){
      if(pool.includes(remembered)) return remembered;
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
    // prefer selected target if ally and alive; otherwise first alive ally
    if(battleState.target && battleState.allyOrder.includes(battleState.target) && (battleState.units[battleState.target]?.hp>0)) return battleState.target;
    return battleState.allyOrder.find(id=>id && (battleState.units[id]?.hp>0)) || null;
  }
  // melee: alive units in the foremost occupied row
  if(sk?.range==='melee'){
    const rows=[1,2,3];
    for(const r of rows){
      const candidates = pool.filter(id=>id && (battleState.units[id]?.row===r) && (battleState.units[id]?.hp>0));
      if(candidates.length){
        // prefer user-set target if it belongs to this row
        if(battleState.target && candidates.includes(battleState.target)) return battleState.target;
        return candidates[0];
      }
    }
    return null;
  }
  // ranged: any alive enemy
  if(sk?.range==='ranged'){
    if(battleState.target && pool.includes(battleState.target) && (battleState.units[battleState.target]?.hp>0)) return battleState.target;
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
  const tryHitOnce = (fromId, attacker, toId, target, skill)=>{
    // hit check
    const acc = clamp01(skill.acc ?? 1);
    if(battleState.rng.next() > acc){
      battleState.log.push({ type:'miss', from: fromId, to: toId, skill: skill.id, isMulti: (skill.hits||1)>1, hp: target.hp, shield: target.shield||0 });
      return { missed:true, died:false };
    }
    // dodge
    const dodge = clamp01(target.dodge||0);
    if(battleState.rng.next() < dodge){
      battleState.log.push({ type:'miss', from: fromId, to: toId, skill: skill.id, isMulti: (skill.hits||1)>1 });
      return { missed:true, died:false };
    }
    // block / crit
    const blocked = battleState.rng.next() < clamp01(target.block||0);
    const crit = battleState.rng.next() < clamp01(attacker.crit||0);
    let dmg = calcBaseDamage(attacker, target, skill);
    if(crit) dmg = Math.round(dmg * 1.5);
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
  // Row-wide skill handling
  if(sk.type==='row'){
    const targetRow = (Array.isArray(sk.to) && sk.to.length===1) ? sk.to[0] : (battleState.units[targetId]?.row || 1);
    const targets = pool.filter(id=>id && (battleState.units[id]?.row===targetRow) && (battleState.units[id]?.hp>0));
    targets.forEach(tid=>{
      const tUnit = battleState.units[tid];
      let died=false;
      for(let h=0; h<(sk.hits||1); h++){
        const res = tryHitOnce(actorId, actorUnit, tid, tUnit, sk);
        if(res.died){ died=true; break; }
      }
      if(died){
        const idx = pool.indexOf(tid); if(idx>-1) pool[idx]=null;
        const qi = battleState.queue.indexOf(tid); if(qi>-1) battleState.queue.splice(qi,1);
        battleState.log.push({ type:'dead', to: tid });
      }
    });
  } else if(sk.type==='line'){
    // Column-wide skill (vertical line through rows). Determine column from selected target.
    const col = battleState.units[targetId]?.col ?? 0;
    const targets = pool.filter(id=>id && (battleState.units[id]?.col===col) && (battleState.units[id]?.hp>0));
    targets.forEach(tid=>{
      const tUnit = battleState.units[tid];
      let died=false;
      for(let h=0; h<(sk.hits||1); h++){
        const res = tryHitOnce(actorId, actorUnit, tid, tUnit, sk);
        if(res.died){ died=true; break; }
      }
      if(died){
        const idx = pool.indexOf(tid); if(idx>-1) pool[idx]=null;
        const qi = battleState.queue.indexOf(tid); if(qi>-1) battleState.queue.splice(qi,1);
        battleState.log.push({ type:'dead', to: tid });
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
  } else {
    const target = battleState.units[targetId];
    let died = false;
    for(let h=0; h<(sk.hits||1); h++){
      const res = tryHitOnce(actorId, actorUnit, targetId, target, sk);
      if(res.died){
        died = true; break;
      }
    }
    if(died){
      const idx = pool.indexOf(targetId); if(idx>-1) pool[idx]=null;
      const qi = battleState.queue.indexOf(targetId); if(qi>-1) battleState.queue.splice(qi,1);
      battleState.log.push({ type:'dead', to: targetId });
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
  if(u && u._regen && u._regen.remain>0 && u.hp>0){
    const before = u.hp; u.hp = Math.min(u.hpMax||u.hp, u.hp + u._regen.amount);
    battleState.log.push({ type:'heal', from: u.id, to: u.id, amount: (u.hp-before), hp: u.hp });
    u._regen.remain -= 1; if(u._regen.remain<=0) delete u._regen;
  }
}

export function isBattleFinished(battleState){
  const enemyAlive = battleState.enemyOrder.some(id=>id && (battleState.units[id]?.hp>0));
  const allyAlive = battleState.allyOrder.some(id=>id && (battleState.units[id]?.hp>0));
  if(!enemyAlive && allyAlive){ battleState.winner = 'ally'; return true; }
  if(!allyAlive && enemyAlive){ battleState.winner = 'enemy'; return true; }
  return false;
}



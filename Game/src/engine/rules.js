export function checkRequirements(state, reqs){
  return (reqs||[]).every(r=>{
    if(Array.isArray(r.anyOf)){
      // OR: anyOf 중 하나라도 충족하면 true
      return r.anyOf.some(sub=> checkRequirements(state, [sub]));
    }
    if(r.type==='flag'){
      const has = Object.prototype.hasOwnProperty.call(state.flags, r.key);
      if(!has) return false; // 플래그가 아직 세팅되지 않으면 미충족
      return state.flags[r.key] === r.value;
    }
    if(r.type==='stat'){
      const v = state.stats[r.key] ?? 0;
      if(r.op==='>=') return v >= r.value; if(r.op===">") return v>r.value; if(r.op==='<=') return v<=r.value; if(r.op==="<") return v<r.value; if(r.op==='=') return v===r.value; if(r.op==='!=') return v!==r.value;
      return false;
    }
    return true;
  });
}

export function applyEffects(state, effects){
  (effects||[]).forEach(e=>{
    if(e.type==='flag.set') state.flags[e.key]=e.value;
    if(e.type==='provision.add'){
      state.party.consumables[e.item]=(state.party.consumables[e.item]||0)+ (e.value||1);
    }
    if(e.type==='party.add'){
      const id = e.unit;
      if(!state.ownedUnits) state.ownedUnits={};
      state.ownedUnits[id] = true; // 보유 획득
      // 기본 자동 배치: 선호 행(preferredRows) 우선, 후열→중열→전열 기본
      const pref = state.data?.units?.[id]?.preferredRows || [3,2,1];
      // ensure formation array size
      if(!Array.isArray(state.party.members) || state.party.members.length!==9){
        state.party.members = (state.party.members||[]).slice(0,9);
        while(state.party.members.length<9) state.party.members.push(null);
      }
      const slotIndex=(row,col)=> (row-1)*3 + col;
      const findEmpty=(row)=>{ for(let c=0;c<3;c++){ const i=slotIndex(row,c); if(!state.party.members[i]) return i; } return -1; };
      let placed=false;
      for(const r of pref){ const idx=findEmpty(r); if(idx>=0){ state.party.members[idx]=id; if(!state.party.positions) state.party.positions={}; state.party.positions[id]=r; placed=true; break; } }
      if(!placed){ /* all full → do nothing */ }
    }
  });
}



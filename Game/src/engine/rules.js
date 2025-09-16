import { FLAGS as FLAG_REGISTRY } from '../data/flags.js';

export function getFlag(state, key){
  if(!state.flags) state.flags={};
  if(Object.prototype.hasOwnProperty.call(state.flags, key)) return state.flags[key];
  const def = resolveRegistryDefault(key);
  return def;
}
export function setFlag(state, key, value){
  if(!state.flags) state.flags={};
  const expect = resolveRegistryType(key);
  if(expect && !isTypeOk(expect, value)){
    console.warn('[flags.set] type mismatch', { key, expect, value });
  }
  state.flags[key] = value;
  try{ console.debug?.('[flag]', key, '=>', value); }catch{}
}
export function hasFlag(state, key){
  if(!state.flags) return false;
  return Object.prototype.hasOwnProperty.call(state.flags, key);
}
export function clearFlags(state, pattern){
  if(!state.flags) return; if(!pattern){ state.flags={}; return; }
  const rx = wildcardToRegExp(pattern);
  Object.keys(state.flags).forEach(k=>{ if(rx.test(k)) delete state.flags[k]; });
}
export function listUsedFlags(state){ return Object.keys(state.flags||{}); }

function isTypeOk(t, v){ if(t==='boolean') return typeof v==='boolean'; if(t==='number') return typeof v==='number' && Number.isFinite(v); if(t==='string') return typeof v==='string'; return true; }
function wildcardToRegExp(p){ const s = '^'+String(p).split('*').map(x=> x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$'; return new RegExp(s); }
function resolveRegistryEntry(key){
  if(!FLAG_REGISTRY) return null;
  if(FLAG_REGISTRY[key]) return FLAG_REGISTRY[key];
  const entries = Object.entries(FLAG_REGISTRY).filter(([k])=> k.includes('*'));
  let best=null, bestLen=-1;
  entries.forEach(([pat, meta])=>{ const rx = wildcardToRegExp(pat); if(rx.test(key) && pat.length>bestLen){ best=meta; bestLen=pat.length; } });
  return best;
}
function resolveRegistryType(key){ const e = resolveRegistryEntry(key); return e?.type||null; }
function resolveRegistryDefault(key){ const e = resolveRegistryEntry(key); return (e&&('default' in e))? e.default : undefined; }

export function checkRequirements(state, reqs){
  return (reqs||[]).every(r=>{
    if(Array.isArray(r.anyOf)){
      // OR: anyOf 중 하나라도 충족하면 true
      return r.anyOf.some(sub=> checkRequirements(state, [sub]));
    }
    if(r.type==='flag'){
      const cur = getFlag(state, r.key);
      if(typeof cur==='undefined') return false;
      return cur === r.value;
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
    if(e.type==='flag.set') setFlag(state, e.key, e.value);
    if(e.type==='provision.add'){
      state.party.consumables[e.item]=(state.party.consumables[e.item]||0)+ (e.value||1);
    }
    if(e.type==='party.add'){
      const id = e.unit;
      if(!state.ownedUnits) state.ownedUnits={};
      // 회차 내 영구 사망자는 재영입 금지
      if(state.ownedUnits[id] === false){
        console.warn('[party.add] blocked due to permanent death', { id });
        return;
      }
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
    if(e.type==='gameover.reset'){
      // 게임 오버 리셋 효과
      if(typeof window.performGameOver === 'function') {
        window.performGameOver(state);
      }
    }
    if(e.type==='gameover.trigger'){
      // 게임 오버 트리거 효과
      if(typeof window.triggerGameOver === 'function') {
        window.triggerGameOver(state, e.reason || 'event');
      }
    }
  });
}



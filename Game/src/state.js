import { createRng } from './util/rng.js';
import { DATA } from './data/index.js';

export function initState(){
  const rng = createRng(12345);
  return {
    rng,
    flags: {},
    stats: { courage: 3 },
    // party.members: 3x3 슬롯(9칸) 편성 상태만 보관
    party: { members: ['C-001',null,null,null,null,null,null,null,null], positions: { 'C-001':1 }, loadout: {}, consumables: {} },
    // ownedUnits: 보유(획득)한 동료 목록. 초기에는 주인공만 보유
    ownedUnits: { 'C-001': true },
    persist: { hp: {}, mp: {}, stress: {} },
    // 스킬 진행도(회차 유지): per unit(baseId) per skillId
    skillProgress: {},
    data: DATA,
    ui: { currentRoute: null, currentEpisode: null, battle: null },
  };
}



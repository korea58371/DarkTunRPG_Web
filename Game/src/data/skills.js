export const SKILL_CFG = { baseGain: 10, missMul: 0.5, baseNext: 20, curveMul: 1.35, curveAdd: 5 };

export const SKILLS = {
  'SK-01': { id:'SK-01', name:'베기', range:'melee', type:'strike', hits:1, acc:1, accAdd:0, coeff:1, cost:{mp:0}, damageType:'slash', upgrades:[{ id:'SK01_ROW', name:'일열 공격', desc:'공격 범위가 전열 전체로 변경(1회 선택) 대미지 감소', type:'once', effects:[{ path:'type', op:'set', value:"row" }, { path:'to', op:'set', value:[1] }] }, { id:'SK01_DMG30', name:'대미지 +30%', desc:'스킬 대미지 30% 증가(중첩 가능)', type:'stack', effects:[{ path:'coeff', op:'mul', value:1.3 }] }, { id:'SK01_BLEED', name:'적중 시 출혈', desc:'적중 시 3턴 출혈 효과 (1회 선택)', type:'once', effects:[{ path:'bleed', op:'set', value:{"chance":0.5,"duration":3,"coeff":0.3} }] }] },
  'SK-02': { id:'SK-02', name:'활쏘기', range:'ranged', type:'strike', hits:1, acc:1.1, accAdd:0, coeff:1, cost:{mp:0}, damageType:'pierce', upgrades:[{ id:'SK-02-', name:'명중 강화', desc:'명중률 +50% 증가', type:'once', effects:[{ path:'accAdd', op:'add', value:0.5 }] }] },
  'SK-03': { id:'SK-03', name:'마구 베기', range:'melee', type:'multi', hits:3, acc:0.7, accAdd:0, coeff:0.6, cost:{mp:2}, damageType:'slash' },
  'SK-10': { id:'SK-10', name:'해골 베기', range:'melee', type:'strike', hits:2, acc:0.85, accAdd:0, coeff:1.2, cost:{mp:0}, damageType:'slash' },
  'SK-11': { id:'SK-11', name:'일도양단', range:'melee', type:'line', hits:1, acc:1, accAdd:0, coeff:1.3, cost:{mp:3}, damageType:'slash' },
  'SK-12': { id:'SK-12', name:'관통샷', range:'ranged', type:'row', hits:1, acc:0.85, accAdd:0, coeff:0.9, cost:{mp:3}, damageType:'pierce' },
  'SK-13': { id:'SK-13', name:'검막', range:'melee', type:'shield', acc:1, coeff:0, cost:{mp:3}, shout:'막아낸다!', duration:2, amount:10, upgrades:[{ id:'SK13_BLOCK50', name:'막기 +50%', desc:'블록 확률 50%p 증가(중첩 가능)', type:'stack', effects:[{ path:'_blockBonus', op:'add', value:0.5 }] }, { id:'SK13_COUNTER', name:'반격', desc:'검막 중 막기 성공 시 반격 1회(1회 선택)', type:'once', effects:[{ path:'_counterOnBlock', op:'set', value:true }] }, { id:'SK13_SHIELD5', name:'보호막 +5', desc:'검막 보호막 수치 +5(중첩 가능)', type:'stack', effects:[{ path:'amount', op:'add', value:5 }] }] },
  'SK-20': { id:'SK-20', name:'응급 치료', range:'ally', type:'heal', hits:1, acc:1, accAdd:0, coeff:1.6, cost:{mp:3} },
  'SK-21': { id:'SK-21', name:'지속 치유', range:'ally', type:'regen', hits:1, acc:1, accAdd:0, coeff:0.8, cost:{mp:4} },
  'SK-22': { id:'SK-22', name:'독화살', range:'ranged', type:'poison', hits:1, acc:0.85, coeff:0.6, cost:{mp:3}, shout:'독을 맛봐라!', duration:3, dotPct:0.1 },
  'SK-30': { id:'SK-30', name:'마력탄', range:'ranged', type:'strike', hits:1, acc:1, coeff:1, cost:{mp:1}, shout:'파편이여!', damageType:'magic' },
  'SK-31': { id:'SK-31', name:'검면치기', range:'melee', type:'strike', hits:1, acc:0.95, coeff:1.1, cost:{mp:0}, shout:'받아라!', damageType:'blunt' },
  'SK-32': { id:'SK-32', name:'찌르기', range:'melee', type:'strike', hits:1, acc:1, coeff:1, cost:{mp:0}, shout:'찔러라!', damageType:'pierce', move:{who:'target', dir:'back', tiles:1, required:false} },
  'SK-33': { id:'SK-33', name:'필중사격', range:'ranged', type:'strike', hits:1, acc:1, accAdd:1, coeff:1, cost:{mp:2}, shout:'정확히!', damageType:'pierce', move:{who:'target', dir:'back', tiles:1, required:false} },
  'SK-FIRE-CROSS': { id:'SK-FIRE-CROSS', name:'화염 폭발', range:'ranged', type:'cross', hits:1, acc:0.95, coeff:0.9, cost:{mp:3}, shout:'불길이여!', damageType:'magic' },
  'SK-FIREBALL': { id:'SK-FIREBALL', name:'파이어볼', range:'ranged', type:'strike', hits:1, acc:1, coeff:1.1, cost:{mp:2}, shout:'파이어볼!', damageType:'magic' },
  'SK-MOVE-1': { id:'SK-MOVE-1', name:'신속 이동', range:'ally', type:'move', cost:{mp:0}, shout:'이동!', move:{who:'actor', tiles:1, required:true, allowedDirs:['forward','back','up','down','upLeft','upRight','downLeft','downRight']} }
};





































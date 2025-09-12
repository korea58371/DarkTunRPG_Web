export const SKILL_CFG = { baseGain: 10, missMul: 0.5, baseNext: 20, curveMul: 1.35, curveAdd: 5 };

export const SKILLS = {
  // 일반 공격: 전열 단일
  // 베기: 전열 단일 + 50% 확률 3턴 출혈(틱 계수 0.3)
  'SK-01': { id:'SK-01', name:'베기', range:'melee', type:'strike', hits:1, acc:1.0, coeff:1.0, cost:{mp:0}, shout:'하압!', damageType:'slash', bleed:{ chance:0.5, duration:3, coeff:0.3 }, move:{ who:'target', dir:'down', tiles:1, required:false },
    upgrades:[
      { id:'SK01_ROW', name:'일열 공격', desc:'공격 범위가 전열 전체로 변경(1회 선택)', type:'once' },
      { id:'SK01_DMG30', name:'대미지 +30%', desc:'스킬 대미지 30% 증가(중첩 가능)', type:'stack' },
      { id:'SK01_BLEED', name:'적중 시 출혈', desc:'적중 시 3턴 출혈(계수 0.3)(1회 선택)', type:'once' }
    ] },
  // 마구 베기: 낮은 명중 3회타
  'SK-03': { id:'SK-03', name:'마구 베기', range:'melee', type:'multi', hits:3, acc:0.7, coeff:0.6, cost:{mp:2}, shout:'으아아앗!' },
  // 활쏘기: 원거리 기본 공격 (MP 소모 없음)
  'SK-02': { id:'SK-02', name:'활쏘기', range:'ranged', type:'strike', hits:1, acc:0.85, coeff:1.0, cost:{mp:0}, shout:'집중해..!', damageType:'pierce' },
  'SK-10': { id:'SK-10', name:'해골 베기', range:'melee', type:'strike', hits:2, acc:0.85, coeff:1.2, cost:{mp:0}, shout:'그르르…' },
  // 일도양단: 전열 전체(적 row 1 전체), MP 5
  'SK-11': { id:'SK-11', name:'일도양단', range:'melee', type:'row', hits:1, acc:0.9, coeff:0.95, cost:{mp:5}, shout:'일도양단!', to:[1], damageType:'slash' },
  // 관통샷: 선택한 세로 라인(열) 전체, MP 3
  'SK-12': { id:'SK-12', name:'관통샷', range:'ranged', type:'line', hits:1, acc:0.85, coeff:0.9, cost:{mp:3}, shout:'꿰뚫어주지!', damageType:'pierce' },
  // 검막: 2턴 동안 10의 실드 부여
  'SK-13': { id:'SK-13', name:'검막', range:'melee', type:'shield', amount:10, duration:2, acc:1, coeff:0, cost:{mp:3}, shout:'막아낸다!',
    upgrades:[
      { id:'SK13_BLOCK50', name:'막기 +50%', desc:'블록 확률 50%p 증가(중첩 가능)', type:'stack' },
      { id:'SK13_COUNTER', name:'반격', desc:'검막 중 막기 성공 시 반격 1회(1회 선택)', type:'once' },
      { id:'SK13_SHIELD5', name:'보호막 +5', desc:'검막 보호막 수치 +5(중첩 가능)', type:'stack' }
    ] },
  // 마력탄: 원거리, MP 1 소모
  'SK-30': { id:'SK-30', name:'마력탄', range:'ranged', type:'strike', hits:1, acc:1.0, coeff:1.0, cost:{mp:1}, shout:'파편이여!', damageType:'magic' },
  // 검면치기: 근접, 타격 피해
  'SK-31': { id:'SK-31', name:'검면치기', range:'melee', type:'strike', hits:1, acc:0.95, coeff:1.1, cost:{mp:0}, shout:'받아라!', damageType:'blunt' },
  // 찌르기: 근접, 관통 피해, MP 소모 없음
  'SK-32': { id:'SK-32', name:'찌르기', range:'melee', type:'strike', hits:1, acc:1.0, coeff:1.0, cost:{mp:0}, shout:'찔러라!', damageType:'pierce', move:{ who:'target', dir:'back', tiles:1, required:false } },
  // 필중사격: 원거리, 명중 보정 +100%, MP 2
  'SK-33': { id:'SK-33', name:'필중사격', range:'ranged', type:'strike', hits:1, acc:1.0, accAdd:1.0, coeff:1.0, cost:{mp:2}, shout:'정확히!', damageType:'pierce', move:{ who:'target', dir:'back', tiles:1, required:false } },
  // 독화살: 적 단일 즉발 60% + 중독(최대 HP 10%/턴, 3턴)
  'SK-22': { id:'SK-22', name:'독화살', range:'ranged', type:'poison', hits:1, acc:0.85, coeff:0.6, cost:{mp:3}, duration:3, dotPct:0.10, shout:'독을 맛봐라!' },
  // 응급 치료: 아군 단일 치유 (mag 100%)
  'SK-20': { id:'SK-20', name:'응급 치료', range:'ally', type:'heal', hits:1, acc:1, coeff:1.0, cost:{mp:3}, shout:'버텨요!' },
  'SK-21': { id:'SK-21', name:'지속 치유', range:'ally', type:'regen', amountCoeff:0.6, duration:3, acc:1, cost:{mp:4}, shout:'당신은 괜찮아요' },
  // 이동 전용(전방향 1칸) - 주인공/궁수 공용으로 넣고 각 유닛 스킬 목록에 할당
  'SK-MOVE-1': { id:'SK-MOVE-1', name:'신속 이동', range:'ally', type:'move', cost:{mp:0}, move:{ who:'actor', allowedDirs:['forward','back','up','down','upLeft','upRight','downLeft','downRight'], tiles:1, required:true }, shout:'이동!' }
};



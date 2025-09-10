export const SKILLS = {
  // 일반 공격: 전열 단일
  'SK-01': { id:'SK-01', name:'일반 공격', range:'melee', type:'strike', hits:1, acc:1.0, coeff:1.0, cost:{mp:0}, shout:'하압!' },
  // 마구 베기: 낮은 명중 3회타
  'SK-03': { id:'SK-03', name:'마구 베기', range:'melee', type:'multi', hits:3, acc:0.7, coeff:0.6, cost:{mp:2}, shout:'으아아앗!' },
  // 화살: 후열에서 사용, 후열 우선
  'SK-02': { id:'SK-02', name:'화살', range:'ranged', type:'strike', hits:1, acc:0.85, coeff:1.0, cost:{mp:2}, shout:'집중해..!' },
  'SK-10': { id:'SK-10', name:'해골 베기', range:'melee', type:'strike', hits:1, acc:0.85, coeff:1.0, cost:{mp:0}, shout:'그르르…' },
  // 일도양단: 전열 전체(적 row 1 전체), MP 5
  'SK-11': { id:'SK-11', name:'일도양단', range:'melee', type:'row', hits:1, acc:0.9, coeff:0.95, cost:{mp:5}, shout:'일도양단!', to:[1] },
  // 관통샷: 선택한 세로 라인(열) 전체, MP 3
  'SK-12': { id:'SK-12', name:'관통샷', range:'ranged', type:'line', hits:1, acc:0.85, coeff:0.9, cost:{mp:3}, shout:'꿰뚫어주지!' },
  // 검막: 2턴 동안 10의 실드 부여
  'SK-13': { id:'SK-13', name:'검막', range:'melee', type:'shield', amount:10, duration:2, acc:1, coeff:0, cost:{mp:3}, shout:'막아낸다!' },
  // 응급 치료: 아군 단일 치유 (mag 100%)
  'SK-20': { id:'SK-20', name:'응급 치료', range:'ally', type:'heal', hits:1, acc:1, coeff:1.0, cost:{mp:3}, shout:'버텨요!' },
  'SK-21': { id:'SK-21', name:'지속 치유', range:'ally', type:'regen', amountCoeff:0.6, duration:3, acc:1, cost:{mp:4}, shout:'당신은 괜찮아요' }
};



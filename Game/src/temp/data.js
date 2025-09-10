export const DATA = {
  routes: [
    { id:'R-001', title:'프롤로그', summary:'낯선 장소에서 정신이 든 주인공', requirements:[], next:'EP-001', branches:[{to:'R-100', label:'괴물의 울음소리'}] },
    { id:'R-100', title:'해골병사 전투', summary:'해골 병사와 1:1 전투', requirements:[], next:'BT-100', branches:[] },
    { id:'R-101', title:'첫 동료 만남', summary:'새로운 동료가 합류', requirements:[{type:'flag', key:'bt.BT-100.win', value:true}], next:'EP-101', branches:[{to:'R-200', label:'함께 나아간다'}] },
    { id:'R-200', title:'해골 부대 전투', summary:'여러 종류의 해골 몬스터들', requirements:[], next:'BT-200', branches:[] },
    { id:'R-300', title:'세리아와의 만남', summary:'치유사 세리아와 조우', requirements:[{type:'flag', key:'bt.BT-200.win', value:true}], next:'EP-300', branches:[{to:'R-400', label:'함께 한다'}] },
    { id:'R-400', title:'거대 해골 보스전', summary:'거대 해골 몬스터와의 결전', requirements:[{type:'flag', key:'ep.EP-300.seriaJoin', value:true}], next:'BT-400', branches:[] }
  ],
  episodes: {
    'EP-001': {
      scene: [
        { speaker:'주인공', text:'여긴... 어디지?' },
        { speaker:'주인공', text:'저건... 울음소리인가?' }
      ],
      choices: [ { label:'소리를 따라간다', effects:[], next:'R-100' } ]
    },
    'EP-101': {
      scene: [
        { speaker:'???', text:'괜찮아요? 당신 덕분에 살았어요.' },
        { speaker:'동료A', text:'함께 움직이죠.' }
      ],
      choices: [ { label:'합류한다', effects:[{type:'party.add', unit:'C-014'}], next:'R-200' } ]
    },
    'EP-300': {
      scene: [
        { speaker:'세리아', text:'상처가 깊군요. 제가 도와드릴게요.' },
        { speaker:'세리아', text:'잠시만요, 치료를 준비할게요.' }
      ],
      choices: [ { label:'세리아가 합류한다', effects:[{type:'party.add', unit:'C-050'},{type:'flag.set', key:'ep.EP-300.seriaJoin', value:true}], next:'R-400' } ]
    }
  },
  units: {
    'C-001': { id:'C-001', name:'주인공', hp:35, hpMax:35, mp:10, spd:7, atk:8, def:4, shield:0, crit:1.85, dodge:0.05, block:1.65, position:1, skills:['SK-01','SK-03','SK-11','SK-13'] },
    'C-014': { id:'C-014', name:'동료A', hp:22, hpMax:22, mp:12, spd:6, atk:6, def:1, shield:0, crit:0.1, dodge:0.08, block:0.04, position:2, skills:['SK-01','SK-02','SK-12'], deathLine:'크으... 여기까지인가.. 뒤는 부탁한다..', preferredRows:[3,2,1] },
    'E-101': { id:'E-101', name:'해골 병사', hp:18, hpMax:18, mp:0, spd:5, atk:5, def:1, shield:0, crit:0.05, dodge:0.02, block:0.02, position:1, skills:['SK-10'], deathLine:'키에에...' },
    'E-102': { id:'E-102', name:'해골 창병(중열)', hp:20, hpMax:20, mp:0, spd:5, atk:6, def:2, shield:0, crit:0.05, dodge:0.03, block:0.06, position:4, skills:['SK-10'], deathLine:'크어어..' },
    'E-103': { id:'E-103', name:'해골 궁수(후열)', hp:16, hpMax:16, mp:0, spd:6, atk:5, def:1, shield:0, crit:0.08, dodge:0.05, block:0.01, position:7, skills:['SK-10'], deathLine:'키리릭..' }
    ,
    'C-050': { id:'C-050', name:'세리아', hp:20, hpMax:20, mp:18, spd:5, atk:3, mag:12, def:1, shield:0, crit:0.05, dodge:0.06, block:0.02, position:3, skills:['SK-20','SK-21','SK-01'], preferredRows:[3,2,1] },
    'E-201': { id:'E-201', name:'거대 해골', hp:120, hpMax:120, mp:0, spd:4, atk:12, def:4, shield:0, crit:0.08, dodge:0.02, block:0.05, position:5, large:true, skills:['SK-10'] }
  },
  skills: {
    // 일반 공격: 전열 단일
    'SK-01': { id:'SK-01', name:'일반 공격', range:'melee', type:'strike', hits:1, acc:1.1, coeff:1.0, cost:{mp:0}, shout:'하압!' },
    // 마구 베기: 낮은 명중 3회타
    'SK-03': { id:'SK-03', name:'마구 베기', range:'melee', type:'multi', hits:3, acc:0.7, coeff:0.6, cost:{mp:2}, shout:'으아아앗!' },
    // 화살: 후열에서 사용, 후열 우선
    'SK-02': { id:'SK-02', name:'화살', range:'ranged', type:'strike', hits:1, acc:0.85, coeff:1.0, cost:{mp:2}, shout:'집중해..!' },
    'SK-10': { id:'SK-10', name:'해골 베기', range:'melee', type:'strike', hits:1, acc:0.85, coeff:1.0, cost:{mp:0}, shout:'그르르…' },
    // 일도양단: 전열 전체(적 row 1 전체), MP 5
    'SK-11': { id:'SK-11', name:'일도양단', range:'melee', type:'row', hits:1, acc:0.9, coeff:0.95, cost:{mp:5}, shout:'일도양단!' },
    // 관통샷: 선택한 세로 라인(열) 전체, MP 3
    'SK-12': { id:'SK-12', name:'관통샷', range:'ranged', type:'line', hits:1, acc:0.85, coeff:0.9, cost:{mp:3}, shout:'꿰뚫어주지!' },
    // 검막: 2턴 동안 10의 실드 부여
    'SK-13': { id:'SK-13', name:'검막', range:'melee', type:'shield', amount:10, duration:2, acc:1, coeff:0, cost:{mp:3}, shout:'막아낸다!' },
    // 응급 치료: 아군 단일 치유 (mag 100%)
    'SK-20': { id:'SK-20', name:'응급 치료', range:'ally', type:'heal', hits:1, acc:1, coeff:1.0, cost:{mp:3}, shout:'버텨요!' },
    'SK-21': { id:'SK-21', name:'지속 치유', range:'ally', type:'regen', amountCoeff:0.6, duration:3, acc:1, cost:{mp:4}, shout:'당신은 괜찮아요' }
  },
  battles: {
    'BT-100': { id:'BT-100', enemy:['E-101'], seed:12345 },
    'BT-200': { id:'BT-200', enemy:['E-101','E-102','E-103','E-101','E-101'], seed:67890 },
    // 보스전: 거대 해골(임시 한 칸 데이터; 2칸 규칙은 별도 설계 필요)
    'BT-400': { id:'BT-400', enemy:['E-201'], seed:98765 }
  }
};



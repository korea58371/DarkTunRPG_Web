export const EPISODES = {
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
  },
  'EP-205': {
    scene: [
      { speaker:'동료', text:'이대로 가면 모두 죽어... 선택해야 해!' }
    ],
    choices: [
      { label:'동료를 제물로 바치고 도망친다', effects:[{type:'flag.set', key:'ep.EP-205.sacrifice', value:true}], next:'R-210' },
      { label:'내가 방패가 되어 동료를 지킨다', effects:[{type:'flag.set', key:'ep.EP-205.noble', value:true}], next:'R-220' }
    ]
  },
  'EP-210': {
    scene: [
      { speaker:'주인공', text:'나는 살아남았다... 하지만 대가가 너무 컸다.' }
    ],
    choices: [ { label:'계속', effects:[], next:'R-300' } ]
  },
  'EP-220': {
    scene: [
      { speaker:'나레이션', text:'당신의 숭고한 희생으로 동료는 살아남았다.' },
      { speaker:'나레이션', text:'그러나 당신의 여정은 여기서 끝났다.' }
    ],
    choices: [ { label:'게임 오버', effects:[], next:'R-001' } ]
  }
};



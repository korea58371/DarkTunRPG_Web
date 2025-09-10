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
  }
};



export const ROUTES = [
  { id:'R-001', title:'프롤로그', summary:'낯선 장소에서 정신이 든 주인공', requirements:[], next:'EP-001', branches:[{to:'R-100', label:'괴물의 울음소리'}] },
  { id:'R-100', title:'해골병사 전투', summary:'해골 병사와 1:1 전투', requirements:[], next:'BT-100', branches:[] },
  { id:'R-101', title:'첫 동료 만남', summary:'새로운 동료가 합류', requirements:[{type:'flag', key:'bt.BT-100.win', value:true}], next:'EP-101', branches:[{to:'R-200', label:'함께 나아간다'}] },
  { id:'R-200', title:'해골 부대 전투', summary:'여러 종류의 해골 몬스터들', requirements:[], next:'BT-200', branches:[] },
  { id:'R-300', title:'세리아와의 만남', summary:'치유사 세리아와 조우', requirements:[{type:'flag', key:'bt.BT-200.win', value:true}], next:'EP-300', branches:[{to:'R-400', label:'함께 한다'}] },
  { id:'R-400', title:'거대 해골 보스전', summary:'거대 해골 몬스터와의 결전', requirements:[{type:'flag', key:'ep.EP-300.seriaJoin', value:true}], next:'BT-400', branches:[] }
];



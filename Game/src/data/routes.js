export const ROUTES = [
  { id:'R-001', title:'프롤로그', summary:'낯선 장소에서 정신이 든 주인공', requirements:[], next:'EP-001', branches:[{"to":"R-100","label":"괴물의 울음소리"}] },
  { id:'R-100', title:'해골병사 전투', summary:'해골 병사와 1:1 전투', requirements:[], next:'BT-100', branches:[{"to":"R-101","label":"진행"}] },
  { id:'R-101', title:'첫 동료 만남', summary:'새로운 동료가 합류', requirements:[{"type":"flag","key":"bt.BT-100.win","value":true}], next:'EP-101', branches:[{"to":"R-200","label":"함께 나아간다"}] },
  { id:'R-200', title:'해골 부대 전투', summary:'여러 종류의 해골 몬스터들', requirements:[], next:'BT-200', branches:[{"to":"R-300","label":"승리"},{"to":"R-205","label":"패배"}] },
  { id:'R-205', title:'패배의 선택', summary:'동료를 버리고 도망칠 것인가, 내가 방패가 될 것인가', requirements:[{"type":"flag","key":"bt.BT-200.win","value":false}], next:'EP-205', branches:[{"to":"R-210","label":"제물로 바치고 도망"},{"to":"R-220","label":"내가 방패가 된다"}] },
  { id:'R-210', title:'비참한 생존', summary:'동료를 제물로 바치고 도망친 뒤의 이야기', requirements:[{"type":"flag","key":"ep.EP-205.sacrifice","value":true}], next:'EP-210', branches:[{"to":"R-300","label":"계속"}] },
  { id:'R-220', title:'배드엔딩: 숭고한 희생', summary:'동료를 지키기 위해 자신을 희생했다', requirements:[{"type":"flag","key":"ep.EP-205.noble","value":true}], next:'EP-220', branches:[] },
  { id:'R-300', title:'세리아와의 만남', summary:'치유사 세리아와 조우', requirements:[{"anyOf":[{"type":"flag","key":"bt.BT-200.win","value":true},{"type":"flag","key":"ep.EP-205.sacrifice","value":true},{"type":"flag","key":"ep.EP-210.done","value":true}]}], next:'EP-300', branches:[{"to":"R-400","label":"함께 한다"}] },
  { id:'R-400', title:'거대 해골 보스전', summary:'거대 해골 몬스터와의 결전', requirements:[{"type":"flag","key":"ep.EP-300.seriaJoin","value":true}], next:'BT-400', branches:[] }
];

export const BATTLES = {
  'BT-100': { id:'BT-100', enemy:['E-101'], seed:12345 },
  // 초반: 해골과 늑대 혼합 전투
  'BT-200': { id:'BT-200', enemy:[
    { unit:'E-301', row:1, col:0 }, // 전열 좌
    'E-101',
    { unit:'E-301', row:1, col:2 }, // 전열 우
    'E-102',
    'E-103'
  ], seed:67890, winNext:'EP-300', loseNext:'EP-205' },
  // 보스전: 거대 해골(임시 한 칸 데이터; 2칸 규칙은 별도 설계 필요)
  'BT-400': { id:'BT-400', enemy:['E-201'], seed:98765 }
};



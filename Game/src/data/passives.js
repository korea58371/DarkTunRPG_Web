export const PASSIVES = {
  // 관통 공격에 대한 추가 회피 보정
  'PS-BONE': {
    id: 'PS-BONE',
    name: '뼈 골격',
    group: 'evasion',
    effects: [
      {
        hook: 'modifyDodge',          // 회피 확률 보정 훅
        applyTo: 'incoming',          // 피격 시 적용
        when: { damageType: 'pierce' },
        add: { dodge: 0.60 },         // 회피 +60% (합연산)
        priority: 100
      }
    ]
  }
  ,
  // 항상 회피 +30%
  'PS-AGILE': {
    id: 'PS-AGILE',
    name: '재빠른 몸놀림',
    group: 'evasion_general',
    effects: [
      {
        hook: 'modifyDodge',
        applyTo: 'incoming',
        when: {},
        add: { dodge: 0.30 },
        priority: 200
      }
    ]
  }
};



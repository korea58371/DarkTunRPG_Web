
## 공격 속성
- 참격(slash), 관통(pierce), 타격(blunt), 마법(magic)
- 카드에 속성 표기, 예상 적중률 계산 시 속성-패시브 보정 반영

## 스킬-속성 매핑(현행)
- 베기(SK-01)=참격, 일도양단(SK-11)=참격
- 활쏘기(SK-02)=관통, 관통샷(SK-12)=관통
- 검면치기(SK-31)=타격, 마력탄(SK-30)=마법

## 패시브 예시
- 뼈 골격(PS-BONE): 관통 속성 공격에 대해 회피 +60% (합연산, 그룹:evasion)

## 패시브 시스템(정의와 적용)
- 데이터: `data/passives.js`에 `{ id, name, group, effects[] }`로 정의
- effect DSL(현행 적용 훅):
  - `hook`: modifyDodge | modifyDamage  (현재 엔진/뷰에서 실사용)
  - (계획) modifyAccuracy | modifyBlock | modifyCrit | onTurnStart | onHitDealt | onHitTaken
  - `applyTo`: outgoing(공격측) | incoming(피격측)
  - `when`: 조건(예: `{ damageType:'pierce' }`)
  - `add`/`mul`: 보정치(예: `{ dodge:+0.60 }`, `{ accMul:0.3 }`)
  - `priority`: 동일 그룹 내 우선순위(낮을수록 우선)
  - `group`: 중복 처리용 그룹명(동일 그룹은 우선순위 높은 하나만 적용)
- 결합 규칙:
  - 동일 그룹: 우선순위 높은(값이 낮은) 규칙만 적용
  - 다른 그룹이 동일 스탯에 관여: 기본 합연산(예: 회피 +60%와 +30% → +90%)
- UI 동기화:
  - 예상 적중률/피해 계산은 패시브 보정이 반영된 동일 로직을 사용한다
- 구현 메모(현행):
  - 회피 합산은 같은 그룹 내 하나만 선택(우선순위), 서로 다른 그룹 값은 합연산 후 clamp01.
  - 피해 배수는 그룹별 최우선 하나 선택 후 전부 곱연산.
- 트리거형 패시브:
  - 상시 패시브와 구분. 트리거로 발동되어 일정 시간 유지되는 효과는 버프/디버프로 정의하고 동일 훅 체계로 적용


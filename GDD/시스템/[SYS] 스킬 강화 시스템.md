### 스킬 강화(레벨업) 시스템

본 문서는 현재 구현된 "스킬 경험치/레벨업/강화" 시스템을 정리한다. 전투 중 사용한 스킬은 경험치를 획득하고, 레벨업 시 즉시 강화 선택 UI가 뜬다. 선택된 강화는 곧바로 전투 수치에 반영된다.

핵심 요약
- 대상: 오직 아군 유닛의 액티브 스킬만 경험치/레벨업 적용(적은 제외)
- 경험치: 스킬 1회 사용 기준으로 획득(다단히트/광역 여부 무관)
  - 지원형(heal/regen/shield): 100% 획득
  - 그 외: 명중 실패만 있었던 경우 50% 획득, 적중이 1회라도 있으면 100%
- 레벨업: 턴 종료 직후 즉시 발동, 강화 3개 중 1개 선택(없으면 스킵)
- 강화 종류: once(1회만) / stack(중첩 가능)
- 저장 범위: 회차(run) 동안 유지, 리셋 시 초기화

설정 값(코드 반영)

| 키        |  기본값 | 설명                      |
| -------- | ---: | ----------------------- |
| baseGain |   10 | 1회 사용 시 기본 경험치          |
| missMul  |  0.5 | 지원형 외에 전부 miss였을 때 보정   |
| baseNext |   20 | Lv1 → Lv2 필요 경험치(2회 사용) |
| curveMul | 1.35 | 다음 레벨 필요치 곱 연산          |
| curveAdd |    5 | 다음 레벨 필요치 가산(레벨 계수)     |

구현 위치: `Game/src/data/skills.js` 상단 `SKILL_CFG`

데이터 모델
- 스킬 업그레이드(스킬 정의 내부)
  - `upgrades: [{ id, name, desc, type:'once'|'stack' }]`
- 진행도(상태)
  - `state.skillProgress[unitBaseId][skillId] = { level, xp, nextXp, taken:[upgradeId…] }`

플로우(레벨업/강화 선택)

```mermaid
flowchart TD
  Use[스킬 사용] --> GainXP[경험치 획득]
  GainXP --> CheckLv{레벨업?}
  CheckLv -- 아니오 --> EndTurn[턴 종료 처리]
  CheckLv -- 예 --> Pool[강화 후보 뽑기]
  Pool --> HasOpt{후보 존재?}
  HasOpt -- 아니오 --> LabelMax[표시만: Lv.Max]
  LabelMax --> Continue1[진행 계속]
  HasOpt -- 예 --> Modal[강화 선택 모달]
  Modal --> Apply[강화 반영]
  Apply --> Continue2[진행 계속]
  Continue1 --> FinishCheck[전멸 검사]
  Continue2 --> FinishCheck
  FinishCheck -- 적 전멸 --> Win[전투 종료]
  FinishCheck -- 전투 계속 --> EndTurn
```

적용 규칙(현재 구현)

| 스킬        | 업그레이드 ID     | 분류    | 효과(전투 반영)                                 |
| --------- | ------------ | ----- | ----------------------------------------- |
| 베기(SK-01) | SK01_DMG30   | stack | `coeff *= 1.3^스택` (대미지 증가)                |
| 베기(SK-01) | SK01_ROW     | once  | 스킬 타입을 `row`, `to:[1]`로 변경(전열 전체 타격)      |
| 베기(SK-01) | SK01_BLEED   | once  | 적중 시 출혈(3턴, 계수 0.3, 100%) 부여              |
| 검막(SK-13) | SK13_SHIELD5 | stack | 실드 부여량 `amount += 5*스택`                   |
| 검막(SK-13) | SK13_BLOCK50 | stack | 방어측 block 확률 +50%p/스택                     |
| 검막(SK-13) | SK13_COUNTER | once  | 반격 플래그 저장(`_counterOnBlock`: 후속 단계 연결 예정) |

UI/UX 규칙
- 카드 표시: `Lv.N (xp/nextXp)` + 선택된 강화 요약(스택은 `xN` 표기)
- 강화 가능 후보가 없으면 `Lv.Max` 표기. 이때 모달은 뜨지 않음
- 비네팅: 타격 대상에게 `is-aoe` 비네팅 표시. 전열 전체 공격 등 광역의 경우 해당 라인의 모든 대상에게 표시
- 업그레이드 모달: 전투 흐름을 블로킹(선택 완료까지 다음 턴/종료로 진행하지 않음)

디버그/안전 장치
- 엔진 로그: `[skill-queue]`, `[skill-row]`, `[skill-line]`(이벤트 큐 길이/대상수 검증)
- 뷰 로그: `[anim] queue`, `[anim-hit] slot not found`, 전멸 상태 체크 로그(`[battle-finish-check]`)
- 전투 뷰 마운트 시에도 전멸 자동 처리(빈 전장 방지)

확장 가이드(데이터 주도화)
- 업그레이드에 `effects` 배열을 도입해 공통 파서로 처리 권장(예: `{ path:'coeff', mul:1.3 }`, `{ path:'type', set:'row' }`, `{ addShield:5 }`, `{ addBlock:0.5 }`, `{ onBlock:{ counter:{ coeff:1.0 } } }`).
- 현재는 SK-01, SK-13에 한해 명시 매핑되어 있으나, 위 형태로 일반화 시 스킬 추가/변경 비용이 낮아짐.

테스트 체크리스트
- [ ] miss 전부일 때 경험치 50%만 증가(지원형 제외)
- [ ] Lv1에서 2회 사용 시 레벨업 → 모달 표시
- [ ] 후보 없을 때 모달 생략 + 카드 `Lv.Max`
- [ ] 베기: 일렬 강화 시 전열 전체 타격/비네팅/대미지 적용
- [ ] 검막: 실드/블록 수치 증가 반영
- [ ] 강화 선택 직후 적 전멸 시 즉시 승리 처리



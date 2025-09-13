// 플래그 레지스트리: 플래그 키의 타입/기본값/설명을 정의합니다.
// 와일드카드 `*`를 지원합니다. 예: 'bt.*.win' → 모든 전투 승리 여부.

export const FLAGS = {
  // 전투 결과
  'bt.*.win': { type: 'boolean', default: false, desc: '전투 승리 여부' },

  // 에피소드 완료/진입 등 상태
  'ep.*.done': { type: 'boolean', default: false, desc: '에피소드 완료 여부' },

  // 엔딩 코드
  'game.ending': { type: 'string', default: '', desc: '게임 엔딩 코드(예: END01)' },

  // 루트 그래프 진행 정보(시스템 내부용) - 필요시 조회만
  'visitedRoutes.*': { type: 'boolean', default: false, desc: '영구 방문 기록' },
  'runVisitedRoutes.*': { type: 'boolean', default: false, desc: '이번 회차 방문 기록' },
  'lastRouteId': { type: 'string', default: '', desc: '마지막 방문 루트 ID' },
};



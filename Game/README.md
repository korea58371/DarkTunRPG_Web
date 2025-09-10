# Prototype RPG (웹)

## 실행
- index.html을 브라우저로 엽니다(ES Module).
- 진입점: `src/main.js` (app.js는 레거시 참고용)
- 네비게이션: 루트 선택 → 에피소드 → 루트/전투.

## 구성
- src/state.js: 전역 상태 생성
- src/temp/data.js: 데이터(루트/에피소드/유닛/스킬/배틀)
- src/engine/rules.js: 조건/효과 엔진
- src/engine/battleCore.js: 턴/타겟/명중/피해/종료
- src/views/routes.js | party.js | episode.js | battle.js: 뷰
- src/views/ui/tooltip.js: 공통 툴팁

## 참고(설계)
- GDD 문서 폴더 참조: GDD/
- 전투: 아군 5, 적 최대 10, 도주 없음, HP/MP/스트레스 자원
- 확률: 시드 고정으로 재현성 보장


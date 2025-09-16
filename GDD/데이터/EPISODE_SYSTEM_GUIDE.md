# 에피소드 시스템 가이드

## 개선된 기능들

### 1. 캐릭터 이미지 출력
- **위치 정렬**: `side` 속성으로 `left`, `center`, `right` 설정 가능
- **세밀한 위치 조절**: `pos` 속성으로 x, y, scale 설정
- **오프셋 조절**: `offset` 속성으로 픽셀 단위 미세 조정

```javascript
{
  "cmd": "show",
  "id": "story/cha_001",  // story 폴더 내 이미지 지원
  "side": "center",       // left, center, right
  "offset": {             // 픽셀 단위 오프셋
    "x": 10,
    "y": -5
  },
  "dur": 500
}
```

### 2. 배경 변경 시스템
- **부드러운 전환**: 새 배경이 페이드인되면서 이전 배경을 대체
- **이전 배경 유지**: 새 배경이 설정되기 전까지 이전 배경 유지
- **전환 시간 조절**: `dur` 속성으로 전환 속도 조절

```javascript
{
  "cmd": "bg",
  "name": "BG_001",
  "dur": 1000  // 1초 페이드 전환
}
```

### 3. 팝업 이미지 기능
- **중앙 팝업**: 화면 중앙에 이미지를 팝업으로 표시
- **크기 조절**: `size` 속성으로 팝업 크기 설정
- **표시/숨김**: `popup`, `hidePopup` 명령어로 제어

```javascript
// 팝업 표시
{
  "cmd": "popup",
  "name": "important_document",
  "size": {
    "width": "60%",
    "height": "60%"
  },
  "dur": 500
}

// 팝업 숨김
{
  "cmd": "hidePopup",
  "dur": 300
}
```

## 레이어 순서 (Z-Index)
1. **배경 이미지** (z-index: 1)
2. **팝업 이미지** (z-index: 2)
3. **캐릭터 이미지** (z-index: 3)
4. **대사창 UI** (z-index: 4)

## 대사창 개선사항
- **크기 3배 확대**: 더 큰 폰트와 여백으로 가독성 향상
- **고정 높이**: `min-height: 240px`로 일관된 크기 유지
- **향상된 스타일링**: 더 진한 배경색과 개선된 테두리

## 에셋 경로 설정
- **캐릭터**: `assets/cha/` (story 폴더 지원)
- **배경**: `assets/bg/`
- **팝업**: `assets/popup/`

## 테스트 에피소드
`EP-DEMO` 에피소드에서 모든 새로운 기능들을 테스트해볼 수 있습니다.

## 명령어 레퍼런스

### show (캐릭터 표시)
- `id`: 캐릭터 ID (story/cha_001 형식 지원)
- `side`: left, center, right
- `pos`: {x: 0-1, y: 0-1, scale: 0-2}
- `offset`: {x: 픽셀, y: 픽셀}
- `dur`: 애니메이션 시간(ms)

### move (캐릭터 이동)
- `id`: 이동할 캐릭터 ID
- `side`, `pos`, `offset`: show와 동일
- `dur`: 이동 시간(ms)

### bg (배경 변경)
- `name`: 배경 이미지 이름 (확장자 제외)
- `dur`: 전환 시간(ms)

### popup (팝업 표시)
- `name`: 팝업 이미지 이름
- `size`: {width: "60%", height: "60%"}
- `dur`: 표시 시간(ms)

### hidePopup (팝업 숨김)
- `dur`: 숨김 시간(ms)

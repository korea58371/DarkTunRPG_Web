---
title: 이미지 프롬프트 생성 가이드
category: 가이드
tags: [이미지생성, AI, 프롬프트, 캐릭터일관성]
---

# 이미지 프롬프트 생성 가이드

## 개요
이 문서는 AI 이미지 생성 도구를 사용하여 일관성 있는 캐릭터 이미지를 생성하기 위한 가이드입니다.

## 기본 원칙

### 1. 캐릭터 일관성 유지
- **고유 식별자 사용**: 각 캐릭터마다 고유한 이름과 식별자를 사용
- **시드(Seed) 값 설정**: 동일한 캐릭터 생성 시 같은 시드 값 사용
- **상세한 외모 묘사**: 머리카락, 눈동자, 피부톤, 얼굴형 등 구체적으로 명시

### 2. 상세 외모 정보 표준화
- **머리카락**: 길이, 스타일, 색상 (영어 명칭 포함)
- **눈동자**: 색상, 크기, 특징 (영어 명칭 포함)
- **피부**: 톤, 질감 (영어 명칭 포함)
- **얼굴형**: 형태, 특징 (영어 명칭 포함)

## 프롬프트 구성 요소

### 1. 기본 정보
```
[나이]세 [국적] [성별], [키]cm, [몸무게]kg, [가슴사이즈]컵, [체형], [가슴크기]
```

### 2. 상세 외모 정보 (필수)
```
[머리카락 길이] [머리카락 스타일] [머리카락 색상], [얼굴형], [눈동자 색상] [눈 특징], [피부 톤] [피부 질감], [코 특징], [입 특징], [전체 인상]
```

**예시:**
- 일본 캐릭터: "Shoulder-length straight dark brown hair, round face, light brown eyes, light beige skin, small nose, small mouth"
- 미국 캐릭터: "Shoulder-length curly blonde hair, round face, blue eyes, light pinkish skin, small nose, small mouth"

### 3. 의상 및 스타일
```
[의상 스타일], [전통 요소], [색상 조합], [특징]
```

### 4. 배경 및 환경
```
[일상/전투] [배경], [조명], [소품], [특별 효과]
```

### 5. 기술적 설정 (필수)
```
고품질, 상세한, 반실사 애니메이션 스타일, 전문 일러스트, [조명], [미학], 캐릭터 일관성, 시드: [숫자]
```

## 국가별 특성 반영

### 일본 캐릭터
- **머리카락**: 주로 검은색 (black), 짙은 갈색 (dark brown)
- **눈동자**: 갈색 계열 (밝은 갈색 light brown, 짙은 갈색 dark brown)
- **피부**: 밝은 베이지 (light beige), 밝은 아이보리 (light ivory)
- **얼굴형**: 둥근 얼굴 (round face), 타원형 얼굴 (oval face)
- **전통 요소**: 기모노, 유카타, 일본 전통 색상
- **특징**: 작은 코, 작은 입, 전통적인 아름다움

### 미국 캐릭터
- **머리카락**: 다양한 색상 (금발 blonde, 갈색 brown, 적갈색 auburn, 검은색 black, 은발 silver)
- **눈동자**: 다양한 색상 (파란색 blue, 녹색 green, 갈색 brown, 회색 gray)
- **피부**: 밝은 핑크빛 (light pinkish), 밝은 베이지 (light beige), 밝은 아이보리 (light ivory), 창백한 흰색 (pale white)
- **얼굴형**: 둥근 얼굴 (round face), 타원형 얼굴 (oval face)
- **전통 요소**: 미국 스트리트 패션, 고급 패션, 할리우드 스타일
- **특징**: 작은 코, 작은 입, 다양한 매력

## 등급별 특성

### D급 (초보자)
- **외모**: 평범한 외모, 일반적인 매력도
- **나이**: 27-30세 (상대적으로 나이가 많음)
- **스타일**: 평범하지만 귀여운/활발한 스타일
- **가슴**: A-B컵 (flat chest, small breasts)
- **특징**: 둥근 얼굴, 평범한 인상

### C급 (숙련자)
- **외모**: 귀여운 외모, 활발한 인상
- **나이**: 25-27세
- **스타일**: 귀여운 스타일, 창의적인 분위기
- **가슴**: B-C컵 (small breasts, medium breasts)
- **특징**: 타원형 얼굴, 귀여운 인상

### B급 (전문가)
- **외모**: 아름다운 외모, 우아한 인상
- **나이**: 23-25세
- **스타일**: 아름다운 스타일, 우아한 분위기
- **가슴**: C-D컵 (medium breasts, large breasts)
- **특징**: 타원형 얼굴, 우아한 인상

### A급 (마스터)
- **외모**: 성숙한 미인, 우아한 인상
- **나이**: 21-24세
- **스타일**: 성숙한 스타일, 전문적인 분위기
- **가슴**: D-E컵 (large breasts)
- **특징**: 타원형 얼굴, 성숙한 인상

### S급 (레전드)
- **외모**: 절대적으로 아름다운 외모, 전설적인 인상
- **나이**: 19-22세 (가장 젊고 절대적인 아름다움)
- **스타일**: 전설적인 스타일, 신비로운 분위기
- **가슴**: E-F컵 (large breasts, huge breasts)
- **특징**: 타원형 얼굴, 전설적인 인상

## 프롬프트 예시

### 일본 D급 캐릭터 (사토 유키)
```
A cute Japanese woman, 29 years old, 158cm tall, 48kg, A-cup, small and cute figure, flat chest. Shoulder-length straight dark brown hair, round face, light brown eyes, light beige skin, small nose, small mouth, cute and ordinary appearance, quiet but sincere expression. Wearing casual Japanese street fashion with traditional elements, yukata or simple t-shirt and jeans. Standing against a simple urban fantasy background with minimal water effects, bright lighting with mystical glow, making water-manipulating gestures with water droplets around her, aquatic aura surrounding her, water-manipulating energy emanating from her, quiet and cute pose, sincere gaze. High quality, detailed, semi-realistic anime style, professional illustration, cinematic lighting, urban fantasy casual aesthetic, character consistency, seed: 12345.
```

### 일본 S급 캐릭터 (야마모토 사쿠라)
```
A legendary Japanese woman, 20 years old, 170cm tall, 56kg, E-cup, absolutely beautiful and legendary figure, large breasts (large breasts: 1.5). Shoulder-length straight black hair, oval face, dark brown eyes, light ivory skin, small nose, small mouth, absolutely beautiful and legendary appearance, mysterious expression. Wearing legendary Japanese high-end fashion, traditional elements. Standing against a simple urban fantasy background with minimal time effects, legendary lighting with mystical glow, making time-manipulating gestures with time distortion around her, temporal aura surrounding her, time-manipulating energy emanating from her, legendary and mysterious pose, divine gaze. High quality, detailed, semi-realistic anime style, professional illustration, cinematic lighting, urban fantasy legendary aesthetic, character consistency, seed: 56789.
```

### 미국 D급 캐릭터 (Jessica Williams)
```
A lively American woman, 28 years old, 165cm tall, 55kg, B-cup, average and lively figure, small breasts. Shoulder-length curly blonde hair, round face, blue eyes, light pinkish skin, small nose, small mouth, average and lively appearance, bright expression. Wearing casual American street fashion, traditional elements. Standing against a simple urban fantasy background with minimal fire effects, bright lighting with mystical glow, making fire-manipulating gestures with fire sparks around her, fiery aura surrounding her, fire energy emanating from her, lively and passionate pose, bright gaze. High quality, detailed, semi-realistic anime style, professional illustration, cinematic lighting, urban fantasy casual aesthetic, character consistency, seed: 67890.
```

### 미국 S급 캐릭터 (Victoria Sterling)
```
A legendary American woman, 19 years old, 180cm tall, 65kg, F-cup, absolutely beautiful and legendary figure, huge breasts (huge breasts: 1.5). Shoulder-length straight silver hair, oval face, gray eyes, pale white skin, small nose, small mouth, absolutely beautiful and legendary appearance, mysterious expression. Wearing legendary American high-end fashion, traditional elements. Standing against a simple urban fantasy background with minimal light effects, legendary lighting with mystical glow, making light-manipulating gestures with light particles around her, light aura surrounding her, light energy emanating from her, legendary and mysterious pose, divine gaze. High quality, detailed, semi-realistic anime style, professional illustration, cinematic lighting, urban fantasy legendary aesthetic, character consistency, seed: 01234.
```

## 주의사항

### 1. 금지 요소
- **신체 하반부 묘사**: 신발, 다리, 하반부 관련 설명 금지
- **근육 묘사**: 여성 캐릭터의 근육 관련 설명 금지
- **과도한 현대적 요소**: SF적인 의상이나 미래적 요소 최소화

### 2. 권장 요소
- **어반판타지 배경**: 현대와 판타지가 조화된 배경
- **능력 반영**: 캐릭터의 능력이 이미지에 반영되도록
- **국가별 특성**: 각 국가의 전통과 현대 문화 반영

## 기술적 팁

### 1. 일관성 유지 (필수)
- **시드 값 고정**: 동일한 캐릭터는 같은 시드 값 사용 (예: seed: 12345)
- **상세한 묘사**: 머리카락, 눈동자, 피부톤, 얼굴형 구체적으로 명시
- **스타일 통일**: "character consistency" 키워드 필수 사용
- **고유 식별자**: 캐릭터 이름과 등급 명시

### 2. 품질 향상 (필수)
- **고품질 키워드**: "High quality, detailed, semi-realistic anime style" 필수
- **조명 설정**: "cinematic lighting" 또는 "mystical glow" 사용
- **전문성**: "professional illustration" 추가
- **미학 설정**: "urban fantasy [등급] aesthetic" 사용

### 3. 상세 외모 정보 (필수)
- **머리카락**: 길이 + 스타일 + 색상 (영어 명칭)
- **눈동자**: 색상 + 크기 + 특징 (영어 명칭)
- **피부**: 톤 + 질감 (영어 명칭)
- **얼굴형**: 형태 + 특징 (영어 명칭)
- **특징**: 코, 입, 전체 인상

### 4. 다양성 확보
- **국가별 차별화**: 각 국가의 고유한 특성 반영
- **등급별 차별화**: 등급에 따른 외모와 스타일 차별화
- **개성 부여**: 각 캐릭터마다 고유한 특징 부여

### 5. 시드 값 관리
- **일본 캐릭터**: 12345, 23456, 34567, 45678, 56789
- **미국 캐릭터**: 67890, 78901, 89012, 90123, 01234
- **한국 캐릭터**: 11111, 22222, 33333, 44444, 55555 (예정)

## 연관 시스템
- [[GDD/설정/[SET] 능력자 등급 시스템]] - 등급별 특성
- [[GDD/설정/[SET] 세계관 설정]] - 국가별 특성
- [[GDD/설정/[SET] 주인공 능력 시스템]] - 주인공과의 관계

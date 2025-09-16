export const EXPLORATIONS = {
  "EXPLO-001": {
    "id": "EXPLO-001",
    "title": "낯선 장소",
    "description": "기억을 잃고 깨어난 이곳... 주변을 탐색해서 단서를 찾아보자.",
    "background": "assets/bg/BG_001.png",
    "objects": [
      {
        "id": "strange_sound",
        "x": 31,
        "y": 32,
        "width": 213,
        "height": 126,
        "image": "",
        "tooltip": "이상한 소리가 나는 곳",
        "event": {
          "type": "message",
          "title": "괴물의 울음소리",
          "text": "크르릉... 무언가 위험한 소리가 들려온다."
        },
        "eventAfter": {
          "type": "message", 
          "title": "조용해진 곳",
          "text": "이제 조용하다. 더 이상 소리가 들리지 않는다."
        },
        "effects": [
          {
            "type": "flag.set",
            "key": "explo.EXPLO-001.sound_heard",
            "value": true
          }
        ],
        "requirements": []
      },
      {
        "id": "monster_encounter",
        "x": 29,
        "y": 65,
        "width": 120,
        "height": 100,
        "image": "",
        "tooltip": "그림자가 움직이는 곳",
        "event": {
          "type": "episode",
          "episodeId": "EP-MONSTER-ENCOUNTER"
        },
        "requirements": [
          {
            "type": "flag",
            "key": "explo.EXPLO-001.sound_heard", 
            "value": true
          }
        ]
      },
      {
        "id": "safe_path",
        "x": 80,
        "y": 80,
        "width": 100,
        "height": 60,
        "image": "",
        "tooltip": "안전해 보이는 길",
        "event": {
          "type": "route"
        },
        "requirements": []
      }
    ],
    "exitRoute": "R-100",
    "exitMessage": "이곳을 떠나시겠습니까?"
  },
  "EXPLO-DEMO": {
    "id": "EXPLO-DEMO",
    "title": "탐색 시스템 데모",
    "description": "탐색 시스템을 테스트해보세요. 화면의 객체들을 클릭해보세요.",
    "background": "assets/bg/BG_002.png",
    "objects": [
      {
        "id": "demo_object1",
        "x": 30,
        "y": 40,
        "width": 100,
        "height": 100,
        "tooltip": "테스트 객체 1",
        "event": {
          "type": "message",
          "title": "발견!",
          "text": "첫 번째 객체를 발견했습니다."
        }
      },
      {
        "id": "demo_object2",
        "x": 70,
        "y": 60,
        "width": 80,
        "height": 80,
        "tooltip": "테스트 객체 2",
        "event": {
          "type": "episode",
          "episodeId": "EP-001"
        }
      }
    ],
    "exitRoute": "R-001",
    "exitMessage": "데모를 마치고 돌아가시겠습니까?"
  }
};

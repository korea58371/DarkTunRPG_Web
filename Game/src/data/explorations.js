export const EXPLORATIONS = {
  "EXPLO-001": {
    "id": "EXPLO-001",
    "title": "낯선 장소",
    "description": "기억을 잃고 깨어난 이곳... 주변을 탐색해서 단서를 찾아보자.",
    "background": "assets/bg/story/BG_001.png",
    "objects": [
      {
        "id": "strange_sound",
        "x": 66,
        "y": 57,
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
          "title": "",
          "text": "",
          "episodeId": "EP-MONSTER-ENCOUNTER"
        },
        "effects": [],
        "requirements": [
          {
            "type": "flag",
            "key": "explo.EXPLO-001.sound_heard",
            "value": true
          }
        ]
      }
    ],
    "exitRoute": "R-100",
    "exitMessage": "이곳을 떠나시겠습니까?"
  }
};

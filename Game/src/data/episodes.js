export const EPISODES = {
  "EP-205": {
    "events": [
      {
        "cmd": "say",
        "speaker": "동료",
        "text": "이대로 가면 모두 죽어... 선택해야 해!"
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "동료를 제물로 바치고 도망친다",
            "effects": [
              {
                "type": "flag.set",
                "key": "ep.EP-205.sacrifice",
                "value": true
              }
            ],
            "next": "R-210"
          },
          {
            "label": "내가 방패가 되어 동료를 지킨다",
            "effects": [
              {
                "type": "flag.set",
                "key": "ep.EP-205.noble",
                "value": true
              }
            ],
            "next": "R-220"
          }
        ]
      }
    ]
  },
  "EP-210": {
    "events": [
      {
        "cmd": "say",
        "speaker": "주인공",
        "text": "나는 살아남았다... 하지만 대가가 너무 컸다."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "계속",
            "effects": [],
            "next": "R-300"
          }
        ]
      }
    ]
  },
  "EP-220": {
    "events": [
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "당신의 숭고한 희생으로 동료는 살아남았다."
      },
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "그러나 당신의 여정은 여기서 끝났다."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "게임 오버",
            "effects": [],
            "next": "R-001"
          }
        ]
      }
    ]
  },
  "EP-001": {
    "events": [
      {
        "cmd": "say",
        "speaker": "주인공",
        "text": "여긴... 어디지?"
      },
      {
        "cmd": "say",
        "speaker": "주인공",
        "text": "으음... 기억이... 아무것도 나지를 않는군."
      },
      {
        "cmd": "say",
        "speaker": "소리",
        "text": "크르릉..."
      },
      {
        "cmd": "say",
        "speaker": "주인공",
        "text": "이건... 짐승의 울음소리인가?"
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "소리를 향해 이동한다.",
            "next": "R-100",
            "effects": []
          }
        ]
      }
    ]
  },
  "EP-101": {
    "events": [
      {
        "cmd": "say",
        "speaker": "???",
        "text": "오... 제법이잖아? "
      },
      {
        "cmd": "say",
        "speaker": "동료A",
        "text": "난 동료A라고 하는데... 같이 다니지 않겠어?"
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "합류한다",
            "next": "R-200",
            "effects": [
              {
                "type": "party.add",
                "unit": "C-014"
              }
            ]
          }
        ]
      }
    ]
  },
  "EP-300": {
    "events": [
      {
        "cmd": "say",
        "speaker": "세리아",
        "text": "상처가 깊군요. 제가 도와드릴게요."
      },
      {
        "cmd": "say",
        "speaker": "세리아",
        "text": "잠시만요, 치료를 준비할게요."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "세리아가 합류한다",
            "next": "R-400",
            "effects": [
              {
                "type": "party.add",
                "unit": "C-050"
              },
              {
                "type": "flag.set",
                "key": "ep.EP-300.seriaJoin",
                "value": true
              }
            ]
          }
        ]
      }
    ]
  },
  "EP-305": {
    "events": [
      {
        "cmd": "say",
        "speaker": "동료",
        "text": "이대로 가면 모두 죽어... 선택해야 해!"
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "동료를 제물로 바치고 도망친다",
            "effects": [
              {
                "type": "flag.set",
                "key": "ep.EP-205.sacrifice",
                "value": true
              }
            ],
            "next": "R-210"
          },
          {
            "label": "내가 방패가 되어 동료를 지킨다",
            "effects": [
              {
                "type": "flag.set",
                "key": "ep.EP-205.noble",
                "value": true
              }
            ],
            "next": "R-220"
          }
        ]
      }
    ]
  },
  "EP-410": {
    "events": [
      {
        "cmd": "say",
        "speaker": "주인공",
        "text": "나는 살아남았다... 하지만 대가가 너무 컸다."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "계속",
            "effects": [],
            "next": "R-300"
          }
        ]
      }
    ]
  },
  "EP-420": {
    "events": [
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "당신의 숭고한 희생으로 동료는 살아남았다."
      },
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "그러나 당신의 여정은 여기서 끝났다."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "게임 오버",
            "effects": [],
            "next": "R-001"
          }
        ]
      }
    ]
  },
  "EP-DEMO": {
    "events": [
      {
        "cmd": "bg",
        "name": "BG_002",
        "dur": 1000
      },
      {
        "cmd": "show",
        "id": "story/cha_001",
        "side": "center",
        "dur": 500
      },
      {
        "cmd": "say",
        "speaker": "민지",
        "text": "안녕하세요! 새로운 에피소드 시스템을 테스트해보겠습니다."
      },
      {
        "cmd": "popup",
        "name": "important_document",
        "dur": 500,
        "size": {
          "width": "60%",
          "height": "60%"
        }
      },
      {
        "cmd": "say",
        "speaker": "민지",
        "text": "이렇게 팝업 이미지도 표시할 수 있어요!"
      },
      {
        "cmd": "hidePopup",
        "dur": 300
      },
      {
        "cmd": "move",
        "id": "story/cha_001",
        "side": "left",
        "dur": 800,
        "offset": {
          "x": 5,
          "y": 0
        }
      },
      {
        "cmd": "say",
        "speaker": "민지",
        "text": "캐릭터 위치도 자유롭게 조절할 수 있습니다."
      },
      {
        "cmd": "bg",
        "name": "BG_001",
        "dur": 800
      },
      {
        "cmd": "say",
        "speaker": "민지",
        "text": "배경도 부드럽게 전환되면서 이전 배경을 유지하다가 새 배경으로 바뀝니다."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "계속 테스트하기",
            "next": "R-100",
            "effects": [
              {
                "type": "party.add",
                "unit": "C-015"
              }
            ]
          },
          {
            "label": "타이틀로 돌아가기",
            "next": "R-001",
            "effects": []
          }
        ]
      }
    ]
  },
  "EP-900": {
    "events": [
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "거대 해골 보스를 처치하자, 밝은 빛과 함께 포탈이 생성된다."
      },
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "직감적으로 현실로 돌아갈 수 있는 포탈이라고 느낀다."
      },
      {
        "cmd": "say",
        "speaker": "나레이션",
        "text": "살아남은 이들과 마지막 인사를 하고, 현실로 향한다."
      },
      {
        "cmd": "choice",
        "items": [
          {
            "label": "End01: 현실로",
            "effects": [
              {
                "type": "flag.set",
                "key": "game.ending",
                "value": "END01"
              }
            ],
            "next": "END-01"
          }
        ]
      }
    ]
  }
};

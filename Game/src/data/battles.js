export const BATTLES = {
  "BT-100": {
    "id": "BT-100",
    "enemy": [
      {
        "unit": "E-101",
        "row": 2,
        "col": 0
      }
    ],
    "seed": 12345,
    "winNext": "EP-101",
    "loseNext": ""
  },
  "BT-200": {
    "id": "BT-200",
    "enemy": [
      {
        "unit": "E-301",
        "row": 1,
        "col": 0
      },
      {
        "unit": "E-101",
        "row": 2,
        "col": 0
      },
      {
        "unit": "E-102",
        "row": 2,
        "col": 1
      },
      {
        "unit": "E-103",
        "row": 2,
        "col": 2
      },
      {
        "unit": "E-301",
        "row": 3,
        "col": 0
      }
    ],
    "seed": 67890,
    "winNext": "EP-300",
    "loseNext": "EP-205"
  },
  "BT-400": {
    "id": "BT-400",
    "enemy": [
      "E-201"
    ],
    "seed": 98765,
    "winNext": "EP-900"
  }
};

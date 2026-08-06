// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/industry-tiles-v2.yaml

export const INDUSTRY_TILE_DATA_VERSION = 2 as const;

export const INDUSTRY_TILE_METADATA = {
  "ruleset": "Brass: Birmingham (Roxley, 2018)",
  "title": "Per-player industry tile manifest",
  "perPlayerTileCount": 45,
  "sourceNote": "Printed player-mat values transcribed from component photography, checked against the official rules and two independent digital implementations."
} as const;

export const INDUSTRY_TILE_SOURCES = {
  "official_rules": {
    "url": "https://cdn.shopify.com/s/files/1/0246/2190/8043/files/Brass-Birmingham-Rulebook.pdf?v=1741712309",
    "role": "Authoritative rules for build costs, resource production, era restrictions, developing, selling, income, victory points, and link icons."
  },
  "official_product": {
    "url": "https://roxley.com/products/brass-birmingham",
    "role": "Publisher product page and source for official component photography."
  },
  "official_setup_photo": {
    "url": "https://cdn.shopify.com/s/files/1/0246/2190/8043/files/Brass-Birmingham-Rulebook.pdf?v=1741712309",
    "role": "Official rulebook setup photograph showing the complete populated player mat."
  },
  "player_mat_photo": {
    "url": "https://blog.cnobi.jp/v1/blog/user/a3ecbd383208b30a32297fdc12a6bcb1/1534769373",
    "role": "Straight-on component photograph used to transcribe printed face values and copy counts."
  },
  "industry_strategy": {
    "url": "https://eriktwice.com/en/2021/01/15/brass-birmingham-understanding-the-industries/",
    "role": "Independent prose cross-check for industry costs, rewards, copy counts, and strategic distinctions between levels."
  },
  "manufacturer_review": {
    "url": "https://www.rpg.net/reviews/view-printable.phtml?reviewNumber=18636",
    "role": "Independent prose cross-check for the first and final manufactured-goods faces."
  },
  "npow_implementation": {
    "url": "https://github.com/npow/brass-birmingham/blob/main/js/gameData.js",
    "role": "Independent machine-readable cross-check of face values and copy distribution."
  },
  "quasrain_implementation": {
    "url": "https://github.com/Quasrain-Coder/BrassBirmingham/blob/main/packages/engine/src/data/tiles.ts",
    "role": "Second independent machine-readable cross-check of face values and copy distribution."
  }
} as const;

export const INDUSTRY_TILE_KIND_ORDER = [
  "manufacturer",
  "cotton",
  "brewery",
  "coal",
  "pottery",
  "iron"
] as const;

export const INDUSTRY_TILE_EXPECTED_KIND_COUNTS = {
  "manufacturer": 11,
  "cotton": 11,
  "brewery": 7,
  "coal": 7,
  "pottery": 5,
  "iron": 4
} as const;

export const INDUSTRY_TILE_FACES = [
  {
    "faceId": "manufacturer-1",
    "industry": "manufacturer",
    "level": 1,
    "stackOrder": 1,
    "copies": 1,
    "physicalIds": [
      "manufacturer-1-a"
    ],
    "build": {
      "money": 8,
      "coal": 1,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 3,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "manufacturer_review",
        "industry_strategy",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-2",
    "industry": "manufacturer",
    "level": 2,
    "stackOrder": 2,
    "copies": 2,
    "physicalIds": [
      "manufacturer-2-a",
      "manufacturer-2-b"
    ],
    "build": {
      "money": 10,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 0,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-3",
    "industry": "manufacturer",
    "level": 3,
    "stackOrder": 3,
    "copies": 1,
    "physicalIds": [
      "manufacturer-3-a"
    ],
    "build": {
      "money": 12,
      "coal": 2,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 4,
    "linkIcons": 0,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-4",
    "industry": "manufacturer",
    "level": 4,
    "stackOrder": 4,
    "copies": 1,
    "physicalIds": [
      "manufacturer-4-a"
    ],
    "build": {
      "money": 14,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 6,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-5",
    "industry": "manufacturer",
    "level": 5,
    "stackOrder": 5,
    "copies": 2,
    "physicalIds": [
      "manufacturer-5-a",
      "manufacturer-5-b"
    ],
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 2,
    "victoryPoints": 8,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-6",
    "industry": "manufacturer",
    "level": 6,
    "stackOrder": 6,
    "copies": 1,
    "physicalIds": [
      "manufacturer-6-a"
    ],
    "build": {
      "money": 20,
      "coal": 0,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 6,
    "victoryPoints": 7,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-7",
    "industry": "manufacturer",
    "level": 7,
    "stackOrder": 7,
    "copies": 1,
    "physicalIds": [
      "manufacturer-7-a"
    ],
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 9,
    "linkIcons": 0,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "manufacturer-8",
    "industry": "manufacturer",
    "level": 8,
    "stackOrder": 8,
    "copies": 2,
    "physicalIds": [
      "manufacturer-8-a",
      "manufacturer-8-b"
    ],
    "build": {
      "money": 20,
      "coal": 0,
      "iron": 2,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 11,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "manufacturer_review",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "cotton-1",
    "industry": "cotton",
    "level": 1,
    "stackOrder": 1,
    "copies": 3,
    "physicalIds": [
      "cotton-1-a",
      "cotton-1-b",
      "cotton-1-c"
    ],
    "build": {
      "money": 12,
      "coal": 0,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "cotton-2",
    "industry": "cotton",
    "level": 2,
    "stackOrder": 2,
    "copies": 2,
    "physicalIds": [
      "cotton-2-a",
      "cotton-2-b"
    ],
    "build": {
      "money": 14,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 4,
    "victoryPoints": 5,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "cotton-3",
    "industry": "cotton",
    "level": 3,
    "stackOrder": 3,
    "copies": 3,
    "physicalIds": [
      "cotton-3-a",
      "cotton-3-b",
      "cotton-3-c"
    ],
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 3,
    "victoryPoints": 9,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "cotton-4",
    "industry": "cotton",
    "level": 4,
    "stackOrder": 4,
    "copies": 3,
    "physicalIds": [
      "cotton-4-a",
      "cotton-4-b",
      "cotton-4-c"
    ],
    "build": {
      "money": 18,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 2,
    "victoryPoints": 12,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "brewery-1",
    "industry": "brewery",
    "level": 1,
    "stackOrder": 1,
    "copies": 2,
    "physicalIds": [
      "brewery-1-a",
      "brewery-1-b"
    ],
    "build": {
      "money": 5,
      "coal": 0,
      "iron": 1,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 4,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "brewery-2",
    "industry": "brewery",
    "level": 2,
    "stackOrder": 2,
    "copies": 2,
    "physicalIds": [
      "brewery-2-a",
      "brewery-2-b"
    ],
    "build": {
      "money": 7,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "brewery-3",
    "industry": "brewery",
    "level": 3,
    "stackOrder": 3,
    "copies": 2,
    "physicalIds": [
      "brewery-3-a",
      "brewery-3-b"
    ],
    "build": {
      "money": 9,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 7,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "brewery-4",
    "industry": "brewery",
    "level": 4,
    "stackOrder": 4,
    "copies": 1,
    "physicalIds": [
      "brewery-4-a"
    ],
    "build": {
      "money": 9,
      "coal": 0,
      "iron": 1,
      "era": "rail_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 10,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "coal-1",
    "industry": "coal",
    "level": 1,
    "stackOrder": 1,
    "copies": 1,
    "physicalIds": [
      "coal-1-a"
    ],
    "build": {
      "money": 5,
      "coal": 0,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 2,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 1,
    "linkIcons": 2,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "coal-2",
    "industry": "coal",
    "level": 2,
    "stackOrder": 2,
    "copies": 2,
    "physicalIds": [
      "coal-2-a",
      "coal-2-b"
    ],
    "build": {
      "money": 7,
      "coal": 0,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 3,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 7,
    "victoryPoints": 2,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "coal-3",
    "industry": "coal",
    "level": 3,
    "stackOrder": 3,
    "copies": 2,
    "physicalIds": [
      "coal-3-a",
      "coal-3-b"
    ],
    "build": {
      "money": 8,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 4,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 6,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "coal-4",
    "industry": "coal",
    "level": 4,
    "stackOrder": 4,
    "copies": 2,
    "physicalIds": [
      "coal-4-a",
      "coal-4-b"
    ],
    "build": {
      "money": 10,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 5,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 4,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "pottery-1",
    "industry": "pottery",
    "level": 1,
    "stackOrder": 1,
    "copies": 1,
    "physicalIds": [
      "pottery-1-a"
    ],
    "build": {
      "money": 17,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 10,
    "linkIcons": 1,
    "developable": false,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "pottery-2",
    "industry": "pottery",
    "level": 2,
    "stackOrder": 2,
    "copies": 1,
    "physicalIds": [
      "pottery-2-a"
    ],
    "build": {
      "money": 0,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 1,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "pottery-3",
    "industry": "pottery",
    "level": 3,
    "stackOrder": 3,
    "copies": 1,
    "physicalIds": [
      "pottery-3-a"
    ],
    "build": {
      "money": 22,
      "coal": 2,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 5,
    "victoryPoints": 11,
    "linkIcons": 1,
    "developable": false,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "pottery-4",
    "industry": "pottery",
    "level": 4,
    "stackOrder": 4,
    "copies": 1,
    "physicalIds": [
      "pottery-4-a"
    ],
    "build": {
      "money": 0,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 1,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "pottery-5",
    "industry": "pottery",
    "level": 5,
    "stackOrder": 5,
    "copies": 1,
    "physicalIds": [
      "pottery-5-a"
    ],
    "build": {
      "money": 24,
      "coal": 2,
      "iron": 0,
      "era": "rail_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 5,
    "victoryPoints": 20,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "industry_strategy",
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "iron-1",
    "industry": "iron",
    "level": 1,
    "stackOrder": 1,
    "copies": 1,
    "physicalIds": [
      "iron-1-a"
    ],
    "build": {
      "money": 5,
      "coal": 1,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 4,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 3,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "iron-2",
    "industry": "iron",
    "level": 2,
    "stackOrder": 2,
    "copies": 1,
    "physicalIds": [
      "iron-2-a"
    ],
    "build": {
      "money": 7,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 4,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 3,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "iron-3",
    "industry": "iron",
    "level": 3,
    "stackOrder": 3,
    "copies": 1,
    "physicalIds": [
      "iron-3-a"
    ],
    "build": {
      "money": 9,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 5,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 2,
    "victoryPoints": 7,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  },
  {
    "faceId": "iron-4",
    "industry": "iron",
    "level": 4,
    "stackOrder": 4,
    "copies": 1,
    "physicalIds": [
      "iron-4-a"
    ],
    "build": {
      "money": 12,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 6,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 1,
    "victoryPoints": 9,
    "linkIcons": 1,
    "developable": true,
    "provenance": {
      "valueSources": [
        "official_rules",
        "player_mat_photo",
        "official_setup_photo"
      ],
      "crossChecks": [
        "npow_implementation",
        "quasrain_implementation"
      ],
      "confidence": "high"
    }
  }
] as const;

export type IndustryTileFace = (typeof INDUSTRY_TILE_FACES)[number];
export type IndustryTileFaceId = IndustryTileFace["faceId"];

export const INDUSTRY_TILE_FACE_BY_ID = {
  "manufacturer-1": INDUSTRY_TILE_FACES[0],
  "manufacturer-2": INDUSTRY_TILE_FACES[1],
  "manufacturer-3": INDUSTRY_TILE_FACES[2],
  "manufacturer-4": INDUSTRY_TILE_FACES[3],
  "manufacturer-5": INDUSTRY_TILE_FACES[4],
  "manufacturer-6": INDUSTRY_TILE_FACES[5],
  "manufacturer-7": INDUSTRY_TILE_FACES[6],
  "manufacturer-8": INDUSTRY_TILE_FACES[7],
  "cotton-1": INDUSTRY_TILE_FACES[8],
  "cotton-2": INDUSTRY_TILE_FACES[9],
  "cotton-3": INDUSTRY_TILE_FACES[10],
  "cotton-4": INDUSTRY_TILE_FACES[11],
  "brewery-1": INDUSTRY_TILE_FACES[12],
  "brewery-2": INDUSTRY_TILE_FACES[13],
  "brewery-3": INDUSTRY_TILE_FACES[14],
  "brewery-4": INDUSTRY_TILE_FACES[15],
  "coal-1": INDUSTRY_TILE_FACES[16],
  "coal-2": INDUSTRY_TILE_FACES[17],
  "coal-3": INDUSTRY_TILE_FACES[18],
  "coal-4": INDUSTRY_TILE_FACES[19],
  "pottery-1": INDUSTRY_TILE_FACES[20],
  "pottery-2": INDUSTRY_TILE_FACES[21],
  "pottery-3": INDUSTRY_TILE_FACES[22],
  "pottery-4": INDUSTRY_TILE_FACES[23],
  "pottery-5": INDUSTRY_TILE_FACES[24],
  "iron-1": INDUSTRY_TILE_FACES[25],
  "iron-2": INDUSTRY_TILE_FACES[26],
  "iron-3": INDUSTRY_TILE_FACES[27],
  "iron-4": INDUSTRY_TILE_FACES[28],
} as const satisfies Record<IndustryTileFaceId, IndustryTileFace>;

export const INDUSTRY_TILES = [
  {
    "id": "manufacturer-1-a",
    "physicalId": "manufacturer-1-a",
    "faceId": "manufacturer-1",
    "industry": "manufacturer",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 0,
    "build": {
      "money": 8,
      "coal": 1,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 3,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "manufacturer-2-a",
    "physicalId": "manufacturer-2-a",
    "faceId": "manufacturer-2",
    "industry": "manufacturer",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 0,
    "build": {
      "money": 10,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 0,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "manufacturer-2-b",
    "physicalId": "manufacturer-2-b",
    "faceId": "manufacturer-2",
    "industry": "manufacturer",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 1,
    "build": {
      "money": 10,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 0,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "manufacturer-3-a",
    "physicalId": "manufacturer-3-a",
    "faceId": "manufacturer-3",
    "industry": "manufacturer",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 0,
    "build": {
      "money": 12,
      "coal": 2,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 4,
    "linkIcons": 0,
    "developable": true
  },
  {
    "id": "manufacturer-4-a",
    "physicalId": "manufacturer-4-a",
    "faceId": "manufacturer-4",
    "industry": "manufacturer",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 0,
    "build": {
      "money": 14,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 6,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "manufacturer-5-a",
    "physicalId": "manufacturer-5-a",
    "faceId": "manufacturer-5",
    "industry": "manufacturer",
    "level": 5,
    "stackOrder": 5,
    "copyIndex": 0,
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 2,
    "victoryPoints": 8,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "manufacturer-5-b",
    "physicalId": "manufacturer-5-b",
    "faceId": "manufacturer-5",
    "industry": "manufacturer",
    "level": 5,
    "stackOrder": 5,
    "copyIndex": 1,
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 2,
    "victoryPoints": 8,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "manufacturer-6-a",
    "physicalId": "manufacturer-6-a",
    "faceId": "manufacturer-6",
    "industry": "manufacturer",
    "level": 6,
    "stackOrder": 6,
    "copyIndex": 0,
    "build": {
      "money": 20,
      "coal": 0,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 6,
    "victoryPoints": 7,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "manufacturer-7-a",
    "physicalId": "manufacturer-7-a",
    "faceId": "manufacturer-7",
    "industry": "manufacturer",
    "level": 7,
    "stackOrder": 7,
    "copyIndex": 0,
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 9,
    "linkIcons": 0,
    "developable": true
  },
  {
    "id": "manufacturer-8-a",
    "physicalId": "manufacturer-8-a",
    "faceId": "manufacturer-8",
    "industry": "manufacturer",
    "level": 8,
    "stackOrder": 8,
    "copyIndex": 0,
    "build": {
      "money": 20,
      "coal": 0,
      "iron": 2,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 11,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "manufacturer-8-b",
    "physicalId": "manufacturer-8-b",
    "faceId": "manufacturer-8",
    "industry": "manufacturer",
    "level": 8,
    "stackOrder": 8,
    "copyIndex": 1,
    "build": {
      "money": 20,
      "coal": 0,
      "iron": 2,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 11,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-1-a",
    "physicalId": "cotton-1-a",
    "faceId": "cotton-1",
    "industry": "cotton",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 0,
    "build": {
      "money": 12,
      "coal": 0,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-1-b",
    "physicalId": "cotton-1-b",
    "faceId": "cotton-1",
    "industry": "cotton",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 1,
    "build": {
      "money": 12,
      "coal": 0,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-1-c",
    "physicalId": "cotton-1-c",
    "faceId": "cotton-1",
    "industry": "cotton",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 2,
    "build": {
      "money": 12,
      "coal": 0,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-2-a",
    "physicalId": "cotton-2-a",
    "faceId": "cotton-2",
    "industry": "cotton",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 0,
    "build": {
      "money": 14,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 4,
    "victoryPoints": 5,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "cotton-2-b",
    "physicalId": "cotton-2-b",
    "faceId": "cotton-2",
    "industry": "cotton",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 1,
    "build": {
      "money": 14,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 4,
    "victoryPoints": 5,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "cotton-3-a",
    "physicalId": "cotton-3-a",
    "faceId": "cotton-3",
    "industry": "cotton",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 0,
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 3,
    "victoryPoints": 9,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-3-b",
    "physicalId": "cotton-3-b",
    "faceId": "cotton-3",
    "industry": "cotton",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 1,
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 3,
    "victoryPoints": 9,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-3-c",
    "physicalId": "cotton-3-c",
    "faceId": "cotton-3",
    "industry": "cotton",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 2,
    "build": {
      "money": 16,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 3,
    "victoryPoints": 9,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-4-a",
    "physicalId": "cotton-4-a",
    "faceId": "cotton-4",
    "industry": "cotton",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 0,
    "build": {
      "money": 18,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 2,
    "victoryPoints": 12,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-4-b",
    "physicalId": "cotton-4-b",
    "faceId": "cotton-4",
    "industry": "cotton",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 1,
    "build": {
      "money": 18,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 2,
    "victoryPoints": 12,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "cotton-4-c",
    "physicalId": "cotton-4-c",
    "faceId": "cotton-4",
    "industry": "cotton",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 2,
    "build": {
      "money": 18,
      "coal": 1,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 2,
    "victoryPoints": 12,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "brewery-1-a",
    "physicalId": "brewery-1-a",
    "faceId": "brewery-1",
    "industry": "brewery",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 0,
    "build": {
      "money": 5,
      "coal": 0,
      "iron": 1,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 4,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "brewery-1-b",
    "physicalId": "brewery-1-b",
    "faceId": "brewery-1",
    "industry": "brewery",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 1,
    "build": {
      "money": 5,
      "coal": 0,
      "iron": 1,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 4,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "brewery-2-a",
    "physicalId": "brewery-2-a",
    "faceId": "brewery-2",
    "industry": "brewery",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 0,
    "build": {
      "money": 7,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "brewery-2-b",
    "physicalId": "brewery-2-b",
    "faceId": "brewery-2",
    "industry": "brewery",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 1,
    "build": {
      "money": 7,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 5,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "brewery-3-a",
    "physicalId": "brewery-3-a",
    "faceId": "brewery-3",
    "industry": "brewery",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 0,
    "build": {
      "money": 9,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 7,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "brewery-3-b",
    "physicalId": "brewery-3-b",
    "faceId": "brewery-3",
    "industry": "brewery",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 1,
    "build": {
      "money": 9,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 7,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "brewery-4-a",
    "physicalId": "brewery-4-a",
    "faceId": "brewery-4",
    "industry": "brewery",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 0,
    "build": {
      "money": 9,
      "coal": 0,
      "iron": 1,
      "era": "rail_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 1,
        "rail": 2
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 10,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "coal-1-a",
    "physicalId": "coal-1-a",
    "faceId": "coal-1",
    "industry": "coal",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 0,
    "build": {
      "money": 5,
      "coal": 0,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 2,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 4,
    "victoryPoints": 1,
    "linkIcons": 2,
    "developable": true
  },
  {
    "id": "coal-2-a",
    "physicalId": "coal-2-a",
    "faceId": "coal-2",
    "industry": "coal",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 0,
    "build": {
      "money": 7,
      "coal": 0,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 3,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 7,
    "victoryPoints": 2,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "coal-2-b",
    "physicalId": "coal-2-b",
    "faceId": "coal-2",
    "industry": "coal",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 1,
    "build": {
      "money": 7,
      "coal": 0,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 3,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 7,
    "victoryPoints": 2,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "coal-3-a",
    "physicalId": "coal-3-a",
    "faceId": "coal-3",
    "industry": "coal",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 0,
    "build": {
      "money": 8,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 4,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 6,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "coal-3-b",
    "physicalId": "coal-3-b",
    "faceId": "coal-3",
    "industry": "coal",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 1,
    "build": {
      "money": 8,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 4,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 6,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "coal-4-a",
    "physicalId": "coal-4-a",
    "faceId": "coal-4",
    "industry": "coal",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 0,
    "build": {
      "money": 10,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 5,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 4,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "coal-4-b",
    "physicalId": "coal-4-b",
    "faceId": "coal-4",
    "industry": "coal",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 1,
    "build": {
      "money": 10,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 5,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 5,
    "victoryPoints": 4,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "pottery-1-a",
    "physicalId": "pottery-1-a",
    "faceId": "pottery-1",
    "industry": "pottery",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 0,
    "build": {
      "money": 17,
      "coal": 0,
      "iron": 1,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 5,
    "victoryPoints": 10,
    "linkIcons": 1,
    "developable": false
  },
  {
    "id": "pottery-2-a",
    "physicalId": "pottery-2-a",
    "faceId": "pottery-2",
    "industry": "pottery",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 0,
    "build": {
      "money": 0,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 1,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "pottery-3-a",
    "physicalId": "pottery-3-a",
    "faceId": "pottery-3",
    "industry": "pottery",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 0,
    "build": {
      "money": 22,
      "coal": 2,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 5,
    "victoryPoints": 11,
    "linkIcons": 1,
    "developable": false
  },
  {
    "id": "pottery-4-a",
    "physicalId": "pottery-4-a",
    "faceId": "pottery-4",
    "industry": "pottery",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 0,
    "build": {
      "money": 0,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 1,
    "incomeSteps": 1,
    "victoryPoints": 1,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "pottery-5-a",
    "physicalId": "pottery-5-a",
    "faceId": "pottery-5",
    "industry": "pottery",
    "level": 5,
    "stackOrder": 5,
    "copyIndex": 0,
    "build": {
      "money": 24,
      "coal": 2,
      "iron": 0,
      "era": "rail_only"
    },
    "production": {
      "coal": 0,
      "iron": 0,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 2,
    "incomeSteps": 5,
    "victoryPoints": 20,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "iron-1-a",
    "physicalId": "iron-1-a",
    "faceId": "iron-1",
    "industry": "iron",
    "level": 1,
    "stackOrder": 1,
    "copyIndex": 0,
    "build": {
      "money": 5,
      "coal": 1,
      "iron": 0,
      "era": "canal_only"
    },
    "production": {
      "coal": 0,
      "iron": 4,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 3,
    "victoryPoints": 3,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "iron-2-a",
    "physicalId": "iron-2-a",
    "faceId": "iron-2",
    "industry": "iron",
    "level": 2,
    "stackOrder": 2,
    "copyIndex": 0,
    "build": {
      "money": 7,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 4,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 3,
    "victoryPoints": 5,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "iron-3-a",
    "physicalId": "iron-3-a",
    "faceId": "iron-3",
    "industry": "iron",
    "level": 3,
    "stackOrder": 3,
    "copyIndex": 0,
    "build": {
      "money": 9,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 5,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 2,
    "victoryPoints": 7,
    "linkIcons": 1,
    "developable": true
  },
  {
    "id": "iron-4-a",
    "physicalId": "iron-4-a",
    "faceId": "iron-4",
    "industry": "iron",
    "level": 4,
    "stackOrder": 4,
    "copyIndex": 0,
    "build": {
      "money": 12,
      "coal": 1,
      "iron": 0,
      "era": "either"
    },
    "production": {
      "coal": 0,
      "iron": 6,
      "beer": {
        "canal": 0,
        "rail": 0
      }
    },
    "beerToSell": 0,
    "incomeSteps": 1,
    "victoryPoints": 9,
    "linkIcons": 1,
    "developable": true
  }
] as const;

export type IndustryTile = (typeof INDUSTRY_TILES)[number];
export type IndustryTileId = IndustryTile["id"];
export type IndustryTileKind = (typeof INDUSTRY_TILE_KIND_ORDER)[number];

export const INDUSTRY_TILE_BY_ID = {
  "manufacturer-1-a": INDUSTRY_TILES[0],
  "manufacturer-2-a": INDUSTRY_TILES[1],
  "manufacturer-2-b": INDUSTRY_TILES[2],
  "manufacturer-3-a": INDUSTRY_TILES[3],
  "manufacturer-4-a": INDUSTRY_TILES[4],
  "manufacturer-5-a": INDUSTRY_TILES[5],
  "manufacturer-5-b": INDUSTRY_TILES[6],
  "manufacturer-6-a": INDUSTRY_TILES[7],
  "manufacturer-7-a": INDUSTRY_TILES[8],
  "manufacturer-8-a": INDUSTRY_TILES[9],
  "manufacturer-8-b": INDUSTRY_TILES[10],
  "cotton-1-a": INDUSTRY_TILES[11],
  "cotton-1-b": INDUSTRY_TILES[12],
  "cotton-1-c": INDUSTRY_TILES[13],
  "cotton-2-a": INDUSTRY_TILES[14],
  "cotton-2-b": INDUSTRY_TILES[15],
  "cotton-3-a": INDUSTRY_TILES[16],
  "cotton-3-b": INDUSTRY_TILES[17],
  "cotton-3-c": INDUSTRY_TILES[18],
  "cotton-4-a": INDUSTRY_TILES[19],
  "cotton-4-b": INDUSTRY_TILES[20],
  "cotton-4-c": INDUSTRY_TILES[21],
  "brewery-1-a": INDUSTRY_TILES[22],
  "brewery-1-b": INDUSTRY_TILES[23],
  "brewery-2-a": INDUSTRY_TILES[24],
  "brewery-2-b": INDUSTRY_TILES[25],
  "brewery-3-a": INDUSTRY_TILES[26],
  "brewery-3-b": INDUSTRY_TILES[27],
  "brewery-4-a": INDUSTRY_TILES[28],
  "coal-1-a": INDUSTRY_TILES[29],
  "coal-2-a": INDUSTRY_TILES[30],
  "coal-2-b": INDUSTRY_TILES[31],
  "coal-3-a": INDUSTRY_TILES[32],
  "coal-3-b": INDUSTRY_TILES[33],
  "coal-4-a": INDUSTRY_TILES[34],
  "coal-4-b": INDUSTRY_TILES[35],
  "pottery-1-a": INDUSTRY_TILES[36],
  "pottery-2-a": INDUSTRY_TILES[37],
  "pottery-3-a": INDUSTRY_TILES[38],
  "pottery-4-a": INDUSTRY_TILES[39],
  "pottery-5-a": INDUSTRY_TILES[40],
  "iron-1-a": INDUSTRY_TILES[41],
  "iron-2-a": INDUSTRY_TILES[42],
  "iron-3-a": INDUSTRY_TILES[43],
  "iron-4-a": INDUSTRY_TILES[44],
} as const satisfies Record<IndustryTileId, IndustryTile>;

export const INDUSTRY_TILE_STACKS = {
  "manufacturer": INDUSTRY_TILES.filter((tile) => tile.industry === "manufacturer"),
  "cotton": INDUSTRY_TILES.filter((tile) => tile.industry === "cotton"),
  "brewery": INDUSTRY_TILES.filter((tile) => tile.industry === "brewery"),
  "coal": INDUSTRY_TILES.filter((tile) => tile.industry === "coal"),
  "pottery": INDUSTRY_TILES.filter((tile) => tile.industry === "pottery"),
  "iron": INDUSTRY_TILES.filter((tile) => tile.industry === "iron"),
} satisfies Record<IndustryTileKind, readonly IndustryTile[]>;

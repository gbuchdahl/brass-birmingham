// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/cards.yaml

export const CARD_DATA_RULESET = "Brass: Birmingham (Roxley, 2018)" as const;

export const CARD_DATA_PROVENANCE = {
  "primaryRules": "https://roxley.com/products/brass-birmingham",
  "componentReference": "https://boardgamegeek.com/image/4231624/brass-birmingham",
  "sourceNote": "Card distribution transcribed from the physical player aid and cross-checked against the official round counts.",
  "confidence": "high"
} as const;

export const WILD_CARD_SUPPLY = {
  "location": 4,
  "industry": 4
} as const;

export const DRAW_DECK_SIZE_BY_PLAYER_COUNT = {
  "2": 40,
  "3": 54,
  "4": 64
} as const;

export const CARD_TEMPLATES = [
  {
    "id": "industry-brewery",
    "kind": "industry",
    "industries": [
      "brewery"
    ],
    "copies": {
      "2": 5,
      "3": 5,
      "4": 5
    }
  },
  {
    "id": "industry-coal-mine",
    "kind": "industry",
    "industries": [
      "coal"
    ],
    "copies": {
      "2": 2,
      "3": 2,
      "4": 3
    }
  },
  {
    "id": "industry-iron-works",
    "kind": "industry",
    "industries": [
      "iron"
    ],
    "copies": {
      "2": 4,
      "3": 4,
      "4": 4
    }
  },
  {
    "id": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "copies": {
      "2": 0,
      "3": 6,
      "4": 8
    }
  },
  {
    "id": "industry-pottery",
    "kind": "industry",
    "industries": [
      "pottery"
    ],
    "copies": {
      "2": 2,
      "3": 2,
      "4": 3
    }
  },
  {
    "id": "location-belper",
    "kind": "location",
    "location": "belper",
    "copies": {
      "2": 0,
      "3": 0,
      "4": 2
    }
  },
  {
    "id": "location-birmingham",
    "kind": "location",
    "location": "birmingham",
    "copies": {
      "2": 3,
      "3": 3,
      "4": 3
    }
  },
  {
    "id": "location-burton-on-trent",
    "kind": "location",
    "location": "burton-on-trent",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-cannock",
    "kind": "location",
    "location": "cannock",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-coalbrookdale",
    "kind": "location",
    "location": "coalbrookdale",
    "copies": {
      "2": 3,
      "3": 3,
      "4": 3
    }
  },
  {
    "id": "location-coventry",
    "kind": "location",
    "location": "coventry",
    "copies": {
      "2": 3,
      "3": 3,
      "4": 3
    }
  },
  {
    "id": "location-derby",
    "kind": "location",
    "location": "derby",
    "copies": {
      "2": 0,
      "3": 0,
      "4": 3
    }
  },
  {
    "id": "location-dudley",
    "kind": "location",
    "location": "dudley",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-kidderminster",
    "kind": "location",
    "location": "kidderminster",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-leek",
    "kind": "location",
    "location": "leek",
    "copies": {
      "2": 0,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-nuneaton",
    "kind": "location",
    "location": "nuneaton",
    "copies": {
      "2": 1,
      "3": 1,
      "4": 1
    }
  },
  {
    "id": "location-redditch",
    "kind": "location",
    "location": "redditch",
    "copies": {
      "2": 1,
      "3": 1,
      "4": 1
    }
  },
  {
    "id": "location-stafford",
    "kind": "location",
    "location": "stafford",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-stoke-on-trent",
    "kind": "location",
    "location": "stoke-on-trent",
    "copies": {
      "2": 0,
      "3": 3,
      "4": 3
    }
  },
  {
    "id": "location-stone",
    "kind": "location",
    "location": "stone",
    "copies": {
      "2": 0,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-tamworth",
    "kind": "location",
    "location": "tamworth",
    "copies": {
      "2": 1,
      "3": 1,
      "4": 1
    }
  },
  {
    "id": "location-uttoxeter",
    "kind": "location",
    "location": "uttoxeter",
    "copies": {
      "2": 0,
      "3": 1,
      "4": 2
    }
  },
  {
    "id": "location-walsall",
    "kind": "location",
    "location": "walsall",
    "copies": {
      "2": 1,
      "3": 1,
      "4": 1
    }
  },
  {
    "id": "location-wolverhampton",
    "kind": "location",
    "location": "wolverhampton",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  },
  {
    "id": "location-worcester",
    "kind": "location",
    "location": "worcester",
    "copies": {
      "2": 2,
      "3": 2,
      "4": 2
    }
  }
] as const;

export const CARD_CATALOG = [
  {
    "id": "industry-brewery-01",
    "templateId": "industry-brewery",
    "kind": "industry",
    "industries": [
      "brewery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-brewery-02",
    "templateId": "industry-brewery",
    "kind": "industry",
    "industries": [
      "brewery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-brewery-03",
    "templateId": "industry-brewery",
    "kind": "industry",
    "industries": [
      "brewery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-brewery-04",
    "templateId": "industry-brewery",
    "kind": "industry",
    "industries": [
      "brewery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-brewery-05",
    "templateId": "industry-brewery",
    "kind": "industry",
    "industries": [
      "brewery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-coal-mine-01",
    "templateId": "industry-coal-mine",
    "kind": "industry",
    "industries": [
      "coal"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-coal-mine-02",
    "templateId": "industry-coal-mine",
    "kind": "industry",
    "industries": [
      "coal"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-coal-mine-03",
    "templateId": "industry-coal-mine",
    "kind": "industry",
    "industries": [
      "coal"
    ],
    "includedAt": [
      4
    ]
  },
  {
    "id": "industry-iron-works-01",
    "templateId": "industry-iron-works",
    "kind": "industry",
    "industries": [
      "iron"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-iron-works-02",
    "templateId": "industry-iron-works",
    "kind": "industry",
    "industries": [
      "iron"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-iron-works-03",
    "templateId": "industry-iron-works",
    "kind": "industry",
    "industries": [
      "iron"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-iron-works-04",
    "templateId": "industry-iron-works",
    "kind": "industry",
    "industries": [
      "iron"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-01",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-02",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-03",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-04",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-05",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-06",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-07",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      4
    ]
  },
  {
    "id": "industry-manufactured-goods-cotton-mill-08",
    "templateId": "industry-manufactured-goods-cotton-mill",
    "kind": "industry",
    "industries": [
      "manufactured",
      "cotton"
    ],
    "includedAt": [
      4
    ]
  },
  {
    "id": "industry-pottery-01",
    "templateId": "industry-pottery",
    "kind": "industry",
    "industries": [
      "pottery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-pottery-02",
    "templateId": "industry-pottery",
    "kind": "industry",
    "industries": [
      "pottery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "industry-pottery-03",
    "templateId": "industry-pottery",
    "kind": "industry",
    "industries": [
      "pottery"
    ],
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-belper-01",
    "templateId": "location-belper",
    "kind": "location",
    "location": "belper",
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-belper-02",
    "templateId": "location-belper",
    "kind": "location",
    "location": "belper",
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-birmingham-01",
    "templateId": "location-birmingham",
    "kind": "location",
    "location": "birmingham",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-birmingham-02",
    "templateId": "location-birmingham",
    "kind": "location",
    "location": "birmingham",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-birmingham-03",
    "templateId": "location-birmingham",
    "kind": "location",
    "location": "birmingham",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-burton-on-trent-01",
    "templateId": "location-burton-on-trent",
    "kind": "location",
    "location": "burton-on-trent",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-burton-on-trent-02",
    "templateId": "location-burton-on-trent",
    "kind": "location",
    "location": "burton-on-trent",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-cannock-01",
    "templateId": "location-cannock",
    "kind": "location",
    "location": "cannock",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-cannock-02",
    "templateId": "location-cannock",
    "kind": "location",
    "location": "cannock",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-coalbrookdale-01",
    "templateId": "location-coalbrookdale",
    "kind": "location",
    "location": "coalbrookdale",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-coalbrookdale-02",
    "templateId": "location-coalbrookdale",
    "kind": "location",
    "location": "coalbrookdale",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-coalbrookdale-03",
    "templateId": "location-coalbrookdale",
    "kind": "location",
    "location": "coalbrookdale",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-coventry-01",
    "templateId": "location-coventry",
    "kind": "location",
    "location": "coventry",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-coventry-02",
    "templateId": "location-coventry",
    "kind": "location",
    "location": "coventry",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-coventry-03",
    "templateId": "location-coventry",
    "kind": "location",
    "location": "coventry",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-derby-01",
    "templateId": "location-derby",
    "kind": "location",
    "location": "derby",
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-derby-02",
    "templateId": "location-derby",
    "kind": "location",
    "location": "derby",
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-derby-03",
    "templateId": "location-derby",
    "kind": "location",
    "location": "derby",
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-dudley-01",
    "templateId": "location-dudley",
    "kind": "location",
    "location": "dudley",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-dudley-02",
    "templateId": "location-dudley",
    "kind": "location",
    "location": "dudley",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-kidderminster-01",
    "templateId": "location-kidderminster",
    "kind": "location",
    "location": "kidderminster",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-kidderminster-02",
    "templateId": "location-kidderminster",
    "kind": "location",
    "location": "kidderminster",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-leek-01",
    "templateId": "location-leek",
    "kind": "location",
    "location": "leek",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-leek-02",
    "templateId": "location-leek",
    "kind": "location",
    "location": "leek",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-nuneaton-01",
    "templateId": "location-nuneaton",
    "kind": "location",
    "location": "nuneaton",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-redditch-01",
    "templateId": "location-redditch",
    "kind": "location",
    "location": "redditch",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-stafford-01",
    "templateId": "location-stafford",
    "kind": "location",
    "location": "stafford",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-stafford-02",
    "templateId": "location-stafford",
    "kind": "location",
    "location": "stafford",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-stoke-on-trent-01",
    "templateId": "location-stoke-on-trent",
    "kind": "location",
    "location": "stoke-on-trent",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-stoke-on-trent-02",
    "templateId": "location-stoke-on-trent",
    "kind": "location",
    "location": "stoke-on-trent",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-stoke-on-trent-03",
    "templateId": "location-stoke-on-trent",
    "kind": "location",
    "location": "stoke-on-trent",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-stone-01",
    "templateId": "location-stone",
    "kind": "location",
    "location": "stone",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-stone-02",
    "templateId": "location-stone",
    "kind": "location",
    "location": "stone",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-tamworth-01",
    "templateId": "location-tamworth",
    "kind": "location",
    "location": "tamworth",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-uttoxeter-01",
    "templateId": "location-uttoxeter",
    "kind": "location",
    "location": "uttoxeter",
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "location-uttoxeter-02",
    "templateId": "location-uttoxeter",
    "kind": "location",
    "location": "uttoxeter",
    "includedAt": [
      4
    ]
  },
  {
    "id": "location-walsall-01",
    "templateId": "location-walsall",
    "kind": "location",
    "location": "walsall",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-wolverhampton-01",
    "templateId": "location-wolverhampton",
    "kind": "location",
    "location": "wolverhampton",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-wolverhampton-02",
    "templateId": "location-wolverhampton",
    "kind": "location",
    "location": "wolverhampton",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-worcester-01",
    "templateId": "location-worcester",
    "kind": "location",
    "location": "worcester",
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "location-worcester-02",
    "templateId": "location-worcester",
    "kind": "location",
    "location": "worcester",
    "includedAt": [
      2,
      3,
      4
    ]
  }
] as const;

export type RulesCardTemplate = typeof CARD_TEMPLATES[number];
export type RulesPhysicalCard = typeof CARD_CATALOG[number];
export type RulesPhysicalCardId = RulesPhysicalCard["id"];

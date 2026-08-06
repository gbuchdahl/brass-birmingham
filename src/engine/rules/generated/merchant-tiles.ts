// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/merchant-tiles.yaml

export const MERCHANT_TILE_DATA_META = {
  "schemaVersion": 1,
  "rulesetId": "brass_birmingham_retail_2018",
  "verifiedOn": "2026-08-06",
  "notes": [
    "Demand-blank Merchant tiles are playable shield-shaped Merchant tiles; they are distinct from the three completely blank punchboard filler tiles that the rulebook says are unused.",
    "Every eligible Merchant tile is shuffled and placed. Only nonblank tiles receive a beer barrel during setup and Canal-to-Rail replenishment."
  ]
} as const;

export const MERCHANT_TILE_DATA_PROVENANCE = {
  "sources": [
    {
      "id": "official_rulebook",
      "kind": "primary_rules",
      "title": "Brass Birmingham Rulebook (Roxley, 2018.11.20)",
      "url": "https://cdn.shopify.com/s/files/1/0246/2190/8043/files/Brass-Birmingham-Rulebook.pdf?v=1741712309"
    },
    {
      "id": "retail_component_photo",
      "kind": "primary_component_image",
      "title": "Retail component inventory photograph (BoardGameGeek image 5293925)",
      "url": "https://boardgamegeek.com/image/5293925/brass-birmingham"
    },
    {
      "id": "andre_implementation",
      "kind": "independent_implementation",
      "title": "AndreSteenbergen/brass-birmingham merchant constants",
      "url": "https://github.com/AndreSteenbergen/brass-birmingham/blob/master/FrontEnd/src/constants/merchants.js"
    }
  ],
  "claims": {
    "setup_filtering_and_beer": {
      "confidence": "high",
      "sources": [
        "official_rulebook",
        "retail_component_photo"
      ]
    },
    "face_catalog_and_distribution": {
      "confidence": "high",
      "sources": [
        "retail_component_photo",
        "andre_implementation"
      ]
    },
    "player_count_bands": {
      "confidence": "medium",
      "sources": [
        "retail_component_photo",
        "andre_implementation"
      ]
    }
  }
} as const;

export const MERCHANT_DEMAND_INDUSTRIES = [
  "cotton_mill",
  "manufacturer",
  "pottery"
] as const;

export const MERCHANT_TILE_COUNTS_BY_PLAYER_COUNT = {
  "2": 5,
  "3": 7,
  "4": 9
} as const;

export const MERCHANT_TILE_CATALOG = [
  {
    "id": "merchant_blank_2p_01",
    "minPlayers": 2,
    "demandIndustries": [],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "merchant_blank_2p_02",
    "minPlayers": 2,
    "demandIndustries": [],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "merchant_cotton_mill_2p",
    "minPlayers": 2,
    "demandIndustries": [
      "cotton_mill"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "merchant_manufacturer_2p",
    "minPlayers": 2,
    "demandIndustries": [
      "manufacturer"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "merchant_universal_2p",
    "minPlayers": 2,
    "demandIndustries": [
      "cotton_mill",
      "manufacturer",
      "pottery"
    ],
    "includedAt": [
      2,
      3,
      4
    ]
  },
  {
    "id": "merchant_blank_3p",
    "minPlayers": 3,
    "demandIndustries": [],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "merchant_pottery_3p",
    "minPlayers": 3,
    "demandIndustries": [
      "pottery"
    ],
    "includedAt": [
      3,
      4
    ]
  },
  {
    "id": "merchant_cotton_mill_4p",
    "minPlayers": 4,
    "demandIndustries": [
      "cotton_mill"
    ],
    "includedAt": [
      4
    ]
  },
  {
    "id": "merchant_manufacturer_4p",
    "minPlayers": 4,
    "demandIndustries": [
      "manufacturer"
    ],
    "includedAt": [
      4
    ]
  }
] as const;

export type RulesMerchantDemandIndustry = typeof MERCHANT_DEMAND_INDUSTRIES[number];
export type RulesMerchantTile = typeof MERCHANT_TILE_CATALOG[number];
export type RulesMerchantTileId = RulesMerchantTile["id"];

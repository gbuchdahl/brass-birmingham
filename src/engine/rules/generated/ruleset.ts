// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Sources: docs/rules-data/ruleset.yaml, markets.yaml, setup.yaml

export const RULESET_META = {
  "schemaVersion": 1,
  "id": "brass-birmingham",
  "version": "2018-standard-v1",
  "sources": {
    "official-rulebook": {
      "role": "primary",
      "url": "https://cdn.shopify.com/s/files/1/0246/2190/8043/files/Brass-Birmingham-Rulebook.pdf?v=1741712309"
    },
    "rulespal-rulebook": {
      "role": "accessible-transcription",
      "url": "https://www.rulespal.com/brass-birmingham/rulebook"
    },
    "order-of-gamers-summary": {
      "role": "secondary-summary",
      "url": "https://www.orderofgamers.com/downloads/BrassBirmingham_v1.2.pdf"
    },
    "board-reference": {
      "role": "visual-reference",
      "url": "https://boardgamegeek.com/image/3733951/brass-birmingham"
    }
  }
} as const;

export const MARKET_DATA = {
  "provenance": {
    "sources": [
      "official-rulebook",
      "board-reference"
    ],
    "detail": "Rulebook setup and fallback prices; printed board market spaces."
  },
  "coal": {
    "fillOrderPrices": [
      7,
      7,
      6,
      6,
      5,
      5,
      4,
      4,
      3,
      3,
      2,
      2,
      1,
      1
    ],
    "initialUnits": 13,
    "fallbackPrice": 8
  },
  "iron": {
    "fillOrderPrices": [
      5,
      5,
      4,
      4,
      3,
      3,
      2,
      2,
      1,
      1
    ],
    "initialUnits": 8,
    "fallbackPrice": 6
  }
} as const;

export const SETUP_DATA = {
  "provenance": {
    "sources": [
      "official-rulebook"
    ],
    "detail": "Components, board setup, player setup, and rounds."
  },
  "shared": {
    "handSize": 8,
    "initialDiscardPerPlayer": 1,
    "startingMoney": 17,
    "startingIncomeSpace": 10,
    "linksPerPlayer": 14,
    "industryTilesPerPlayer": 45,
    "wildLocationCards": 4,
    "wildIndustryCards": 4
  },
  "eras": {
    "canal": {
      "firstRoundActions": 1,
      "laterRoundActions": 2
    },
    "rail": {
      "firstRoundActions": 2,
      "laterRoundActions": 2
    }
  },
  "playerCounts": {
    "2": {
      "roundsPerEra": 10,
      "regularCards": 40,
      "activeMerchantSlots": 5,
      "merchantLocations": [
        "gloucester",
        "oxford",
        "shrewsbury"
      ],
      "excludedLocationBannerColors": [
        "blue",
        "teal"
      ]
    },
    "3": {
      "roundsPerEra": 9,
      "regularCards": 54,
      "activeMerchantSlots": 7,
      "merchantLocations": [
        "gloucester",
        "oxford",
        "shrewsbury",
        "warrington"
      ],
      "excludedLocationBannerColors": [
        "teal"
      ]
    },
    "4": {
      "roundsPerEra": 8,
      "regularCards": 64,
      "activeMerchantSlots": 9,
      "merchantLocations": [
        "gloucester",
        "nottingham",
        "oxford",
        "shrewsbury",
        "warrington"
      ],
      "excludedLocationBannerColors": []
    }
  }
} as const;

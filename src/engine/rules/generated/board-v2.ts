// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/board-v2.yaml

export const BOARD_V2 = {
  "schemaVersion": 1,
  "rulesetId": "brass_birmingham_retail_2018",
  "verifiedOn": "2026-08-06",
  "notes": [
    "All locations and physical link spaces remain available at every supported player count.",
    "Player count changes the Location cards in the draw deck and the Merchant spaces that receive tiles, not board topology.",
    "Link scoring adds each adjacent location's permanent icons and the icons on every built Industry tile there."
  ],
  "provenance": {
    "sources": [
      {
        "id": "board_image",
        "kind": "primary_component_image",
        "title": "Brass Birmingham retail board",
        "url": "https://cf.geekdo-images.com/VyCcrhjhtrtFbXFQC3eKHg__imagepage/img/FXkkkZYMIbyu1cKJSGdjeM3epcA=/fit-in/900x600/filters:no_upscale():strip_icc()/pic3733951.jpg"
      },
      {
        "id": "official_rulebook",
        "kind": "official_rules_transcription",
        "title": "Brass Birmingham Rulebook",
        "url": "https://www.rulespal.com/brass-birmingham/rulebook"
      },
      {
        "id": "andre_implementation",
        "kind": "independent_implementation",
        "title": "AndreSteenbergen/brass-birmingham board constants",
        "url": "https://github.com/AndreSteenbergen/brass-birmingham/tree/master/FrontEnd/src/constants"
      },
      {
        "id": "npow_implementation",
        "kind": "independent_implementation",
        "title": "npow/brass-birmingham game data",
        "url": "https://github.com/npow/brass-birmingham/blob/main/js/gameData.js"
      }
    ],
    "claims": {
      "locations_and_spaces": {
        "confidence": "high",
        "sources": [
          "board_image",
          "andre_implementation",
          "npow_implementation"
        ]
      },
      "links_and_eras": {
        "confidence": "high",
        "sources": [
          "board_image",
          "andre_implementation",
          "npow_implementation"
        ]
      },
      "farm_brewery_adjacency": {
        "confidence": "high",
        "sources": [
          "official_rulebook",
          "board_image",
          "andre_implementation",
          "npow_implementation"
        ]
      },
      "merchants_and_player_counts": {
        "confidence": "high",
        "sources": [
          "official_rulebook",
          "board_image",
          "andre_implementation",
          "npow_implementation"
        ]
      },
      "permanent_link_icons": {
        "confidence": "high",
        "sources": [
          "board_image",
          "npow_implementation"
        ]
      }
    }
  },
  "industryKinds": [
    "cotton_mill",
    "coal_mine",
    "iron_works",
    "manufacturer",
    "pottery",
    "brewery"
  ],
  "locations": {
    "belper": {
      "kind": "city",
      "label": "Belper",
      "banner": "teal",
      "locationCardMinPlayers": 4,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "belper_1",
          "allows": [
            "cotton_mill",
            "manufacturer"
          ]
        },
        {
          "id": "belper_2",
          "allows": [
            "coal_mine"
          ]
        },
        {
          "id": "belper_3",
          "allows": [
            "pottery"
          ]
        }
      ]
    },
    "derby": {
      "kind": "city",
      "label": "Derby",
      "banner": "teal",
      "locationCardMinPlayers": 4,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "derby_1",
          "allows": [
            "cotton_mill",
            "brewery"
          ]
        },
        {
          "id": "derby_2",
          "allows": [
            "cotton_mill",
            "manufacturer"
          ]
        },
        {
          "id": "derby_3",
          "allows": [
            "iron_works"
          ]
        }
      ]
    },
    "leek": {
      "kind": "city",
      "label": "Leek",
      "banner": "blue",
      "locationCardMinPlayers": 3,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "leek_1",
          "allows": [
            "cotton_mill",
            "manufacturer"
          ]
        },
        {
          "id": "leek_2",
          "allows": [
            "cotton_mill",
            "coal_mine"
          ]
        }
      ]
    },
    "stoke_on_trent": {
      "kind": "city",
      "label": "Stoke-on-Trent",
      "banner": "blue",
      "locationCardMinPlayers": 3,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "stoke_on_trent_1",
          "allows": [
            "cotton_mill",
            "manufacturer"
          ]
        },
        {
          "id": "stoke_on_trent_2",
          "allows": [
            "pottery",
            "iron_works"
          ]
        },
        {
          "id": "stoke_on_trent_3",
          "allows": [
            "manufacturer"
          ]
        }
      ]
    },
    "stone": {
      "kind": "city",
      "label": "Stone",
      "banner": "blue",
      "locationCardMinPlayers": 3,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "stone_1",
          "allows": [
            "cotton_mill",
            "brewery"
          ]
        },
        {
          "id": "stone_2",
          "allows": [
            "manufacturer",
            "coal_mine"
          ]
        }
      ]
    },
    "uttoxeter": {
      "kind": "city",
      "label": "Uttoxeter",
      "banner": "blue",
      "locationCardMinPlayers": 3,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "uttoxeter_1",
          "allows": [
            "manufacturer",
            "brewery"
          ]
        },
        {
          "id": "uttoxeter_2",
          "allows": [
            "cotton_mill",
            "brewery"
          ]
        }
      ]
    },
    "stafford": {
      "kind": "city",
      "label": "Stafford",
      "banner": "red",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "stafford_1",
          "allows": [
            "manufacturer",
            "brewery"
          ]
        },
        {
          "id": "stafford_2",
          "allows": [
            "pottery"
          ]
        }
      ]
    },
    "burton_on_trent": {
      "kind": "city",
      "label": "Burton-on-Trent",
      "banner": "red",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "burton_on_trent_1",
          "allows": [
            "manufacturer",
            "coal_mine"
          ]
        },
        {
          "id": "burton_on_trent_2",
          "allows": [
            "brewery"
          ]
        }
      ]
    },
    "cannock": {
      "kind": "city",
      "label": "Cannock",
      "banner": "red",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "cannock_1",
          "allows": [
            "manufacturer",
            "coal_mine"
          ]
        },
        {
          "id": "cannock_2",
          "allows": [
            "coal_mine"
          ]
        }
      ]
    },
    "tamworth": {
      "kind": "city",
      "label": "Tamworth",
      "banner": "red",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "tamworth_1",
          "allows": [
            "cotton_mill",
            "coal_mine"
          ]
        },
        {
          "id": "tamworth_2",
          "allows": [
            "cotton_mill",
            "coal_mine"
          ]
        }
      ]
    },
    "walsall": {
      "kind": "city",
      "label": "Walsall",
      "banner": "red",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "walsall_1",
          "allows": [
            "iron_works",
            "manufacturer"
          ]
        },
        {
          "id": "walsall_2",
          "allows": [
            "manufacturer",
            "brewery"
          ]
        }
      ]
    },
    "wolverhampton": {
      "kind": "city",
      "label": "Wolverhampton",
      "banner": "gold",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "wolverhampton_1",
          "allows": [
            "manufacturer"
          ]
        },
        {
          "id": "wolverhampton_2",
          "allows": [
            "manufacturer",
            "coal_mine"
          ]
        }
      ]
    },
    "coalbrookdale": {
      "kind": "city",
      "label": "Coalbrookdale",
      "banner": "gold",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "coalbrookdale_1",
          "allows": [
            "iron_works",
            "brewery"
          ]
        },
        {
          "id": "coalbrookdale_2",
          "allows": [
            "iron_works"
          ]
        },
        {
          "id": "coalbrookdale_3",
          "allows": [
            "coal_mine"
          ]
        }
      ]
    },
    "dudley": {
      "kind": "city",
      "label": "Dudley",
      "banner": "gold",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "dudley_1",
          "allows": [
            "coal_mine"
          ]
        },
        {
          "id": "dudley_2",
          "allows": [
            "iron_works"
          ]
        }
      ]
    },
    "kidderminster": {
      "kind": "city",
      "label": "Kidderminster",
      "banner": "gold",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "kidderminster_1",
          "allows": [
            "cotton_mill",
            "coal_mine"
          ]
        },
        {
          "id": "kidderminster_2",
          "allows": [
            "cotton_mill"
          ]
        }
      ]
    },
    "worcester": {
      "kind": "city",
      "label": "Worcester",
      "banner": "gold",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "worcester_1",
          "allows": [
            "cotton_mill"
          ]
        },
        {
          "id": "worcester_2",
          "allows": [
            "cotton_mill"
          ]
        }
      ]
    },
    "birmingham": {
      "kind": "city",
      "label": "Birmingham",
      "banner": "purple",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "birmingham_1",
          "allows": [
            "cotton_mill",
            "manufacturer"
          ]
        },
        {
          "id": "birmingham_2",
          "allows": [
            "manufacturer"
          ]
        },
        {
          "id": "birmingham_3",
          "allows": [
            "iron_works"
          ]
        },
        {
          "id": "birmingham_4",
          "allows": [
            "manufacturer"
          ]
        }
      ]
    },
    "coventry": {
      "kind": "city",
      "label": "Coventry",
      "banner": "purple",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "coventry_1",
          "allows": [
            "pottery"
          ]
        },
        {
          "id": "coventry_2",
          "allows": [
            "manufacturer",
            "coal_mine"
          ]
        },
        {
          "id": "coventry_3",
          "allows": [
            "iron_works",
            "manufacturer"
          ]
        }
      ]
    },
    "nuneaton": {
      "kind": "city",
      "label": "Nuneaton",
      "banner": "purple",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "nuneaton_1",
          "allows": [
            "manufacturer",
            "brewery"
          ]
        },
        {
          "id": "nuneaton_2",
          "allows": [
            "cotton_mill",
            "coal_mine"
          ]
        }
      ]
    },
    "redditch": {
      "kind": "city",
      "label": "Redditch",
      "banner": "purple",
      "locationCardMinPlayers": 2,
      "baseLinkIcons": 0,
      "buildSpaces": [
        {
          "id": "redditch_1",
          "allows": [
            "manufacturer",
            "coal_mine"
          ]
        },
        {
          "id": "redditch_2",
          "allows": [
            "iron_works"
          ]
        }
      ]
    },
    "farm_brewery_cannock": {
      "kind": "farm_brewery",
      "label": "Farm Brewery (west of Cannock)",
      "baseLinkIcons": 0,
      "buildCardRule": "industry_or_wild_industry_only",
      "buildSpaces": [
        {
          "id": "farm_brewery_cannock_1",
          "allows": [
            "brewery"
          ]
        }
      ]
    },
    "farm_brewery_kidderminster_worcester": {
      "kind": "farm_brewery",
      "label": "Farm Brewery (west of Kidderminster-Worcester)",
      "baseLinkIcons": 0,
      "buildCardRule": "industry_or_wild_industry_only",
      "buildSpaces": [
        {
          "id": "farm_brewery_kidderminster_worcester_1",
          "allows": [
            "brewery"
          ]
        }
      ]
    },
    "merchant_warrington": {
      "kind": "merchant",
      "label": "Warrington",
      "baseLinkIcons": 2,
      "coalMarketAccess": true,
      "merchantTileMinPlayers": 3,
      "merchantBonus": {
        "kind": "money",
        "amount": 5
      },
      "merchantSpaces": [
        "merchant_warrington_1",
        "merchant_warrington_2"
      ]
    },
    "merchant_nottingham": {
      "kind": "merchant",
      "label": "Nottingham",
      "baseLinkIcons": 2,
      "coalMarketAccess": true,
      "merchantTileMinPlayers": 4,
      "merchantBonus": {
        "kind": "victory_points",
        "amount": 3
      },
      "merchantSpaces": [
        "merchant_nottingham_1",
        "merchant_nottingham_2"
      ]
    },
    "merchant_shrewsbury": {
      "kind": "merchant",
      "label": "Shrewsbury",
      "baseLinkIcons": 2,
      "coalMarketAccess": true,
      "merchantTileMinPlayers": 2,
      "merchantBonus": {
        "kind": "victory_points",
        "amount": 4
      },
      "merchantSpaces": [
        "merchant_shrewsbury_1"
      ]
    },
    "merchant_gloucester": {
      "kind": "merchant",
      "label": "Gloucester",
      "baseLinkIcons": 2,
      "coalMarketAccess": true,
      "merchantTileMinPlayers": 2,
      "merchantBonus": {
        "kind": "free_develop",
        "amount": 1
      },
      "merchantSpaces": [
        "merchant_gloucester_1",
        "merchant_gloucester_2"
      ]
    },
    "merchant_oxford": {
      "kind": "merchant",
      "label": "Oxford",
      "baseLinkIcons": 2,
      "coalMarketAccess": true,
      "merchantTileMinPlayers": 2,
      "merchantBonus": {
        "kind": "income_spaces",
        "amount": 2
      },
      "merchantSpaces": [
        "merchant_oxford_1",
        "merchant_oxford_2"
      ]
    }
  },
  "links": [
    {
      "id": "link_belper_derby",
      "adjacentLocations": [
        "belper",
        "derby"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_belper_leek",
      "adjacentLocations": [
        "belper",
        "leek"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_birmingham_coventry",
      "adjacentLocations": [
        "birmingham",
        "coventry"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_birmingham_dudley",
      "adjacentLocations": [
        "birmingham",
        "dudley"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_birmingham_nuneaton",
      "adjacentLocations": [
        "birmingham",
        "nuneaton"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_birmingham_oxford",
      "adjacentLocations": [
        "birmingham",
        "merchant_oxford"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_birmingham_redditch",
      "adjacentLocations": [
        "birmingham",
        "redditch"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_birmingham_tamworth",
      "adjacentLocations": [
        "birmingham",
        "tamworth"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_birmingham_walsall",
      "adjacentLocations": [
        "birmingham",
        "walsall"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_birmingham_worcester",
      "adjacentLocations": [
        "birmingham",
        "worcester"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_burton_on_trent_cannock",
      "adjacentLocations": [
        "burton_on_trent",
        "cannock"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_burton_on_trent_derby",
      "adjacentLocations": [
        "burton_on_trent",
        "derby"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_burton_on_trent_stone",
      "adjacentLocations": [
        "burton_on_trent",
        "stone"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_burton_on_trent_tamworth",
      "adjacentLocations": [
        "burton_on_trent",
        "tamworth"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_burton_on_trent_walsall",
      "adjacentLocations": [
        "burton_on_trent",
        "walsall"
      ],
      "eras": [
        "canal"
      ]
    },
    {
      "id": "link_cannock_stafford",
      "adjacentLocations": [
        "cannock",
        "stafford"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_cannock_farm_brewery",
      "adjacentLocations": [
        "cannock",
        "farm_brewery_cannock"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_cannock_walsall",
      "adjacentLocations": [
        "cannock",
        "walsall"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_cannock_wolverhampton",
      "adjacentLocations": [
        "cannock",
        "wolverhampton"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_coalbrookdale_kidderminster",
      "adjacentLocations": [
        "coalbrookdale",
        "kidderminster"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_coalbrookdale_shrewsbury",
      "adjacentLocations": [
        "coalbrookdale",
        "merchant_shrewsbury"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_coalbrookdale_wolverhampton",
      "adjacentLocations": [
        "coalbrookdale",
        "wolverhampton"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_coventry_nuneaton",
      "adjacentLocations": [
        "coventry",
        "nuneaton"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_derby_nottingham",
      "adjacentLocations": [
        "derby",
        "merchant_nottingham"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_derby_uttoxeter",
      "adjacentLocations": [
        "derby",
        "uttoxeter"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_dudley_kidderminster",
      "adjacentLocations": [
        "dudley",
        "kidderminster"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_dudley_wolverhampton",
      "adjacentLocations": [
        "dudley",
        "wolverhampton"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_gloucester_redditch",
      "adjacentLocations": [
        "merchant_gloucester",
        "redditch"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_gloucester_worcester",
      "adjacentLocations": [
        "merchant_gloucester",
        "worcester"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_kidderminster_worcester_farm_brewery",
      "adjacentLocations": [
        "kidderminster",
        "worcester",
        "farm_brewery_kidderminster_worcester"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_leek_stoke_on_trent",
      "adjacentLocations": [
        "leek",
        "stoke_on_trent"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_nuneaton_tamworth",
      "adjacentLocations": [
        "nuneaton",
        "tamworth"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_redditch_oxford",
      "adjacentLocations": [
        "redditch",
        "merchant_oxford"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_stafford_stone",
      "adjacentLocations": [
        "stafford",
        "stone"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_stoke_on_trent_stone",
      "adjacentLocations": [
        "stoke_on_trent",
        "stone"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_stoke_on_trent_warrington",
      "adjacentLocations": [
        "stoke_on_trent",
        "merchant_warrington"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    },
    {
      "id": "link_stone_uttoxeter",
      "adjacentLocations": [
        "stone",
        "uttoxeter"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_tamworth_walsall",
      "adjacentLocations": [
        "tamworth",
        "walsall"
      ],
      "eras": [
        "rail"
      ]
    },
    {
      "id": "link_walsall_wolverhampton",
      "adjacentLocations": [
        "walsall",
        "wolverhampton"
      ],
      "eras": [
        "canal",
        "rail"
      ]
    }
  ],
  "playerCountRules": {
    "2": {
      "locationCardBanners": [
        "red",
        "gold",
        "purple"
      ],
      "merchantTileLocations": [
        "merchant_shrewsbury",
        "merchant_gloucester",
        "merchant_oxford"
      ],
      "activeMerchantSpaces": 5
    },
    "3": {
      "locationCardBanners": [
        "blue",
        "red",
        "gold",
        "purple"
      ],
      "merchantTileLocations": [
        "merchant_warrington",
        "merchant_shrewsbury",
        "merchant_gloucester",
        "merchant_oxford"
      ],
      "activeMerchantSpaces": 7
    },
    "4": {
      "locationCardBanners": [
        "teal",
        "blue",
        "red",
        "gold",
        "purple"
      ],
      "merchantTileLocations": [
        "merchant_warrington",
        "merchant_nottingham",
        "merchant_shrewsbury",
        "merchant_gloucester",
        "merchant_oxford"
      ],
      "activeMerchantSpaces": 9
    }
  },
  "counts": {
    "locations": 27,
    "cities": 20,
    "farmBreweries": 2,
    "merchants": 5,
    "buildSpaces": 49,
    "merchantSpaces": 9,
    "links": 39,
    "canalLinks": 31,
    "railLinks": 38,
    "bothEraLinks": 30,
    "canalOnlyLinks": 1,
    "railOnlyLinks": 8,
    "hyperedges": 1
  }
} as const;

export const BOARD_V2_COUNTS = BOARD_V2.counts;

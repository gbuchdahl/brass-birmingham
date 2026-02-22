/* eslint-disable */
// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/board-topology.yaml

export const CITY_DEFS = {
  "Birmingham": {
    "industries": [
      "Coal",
      "Iron",
      "Manufactured",
      "Manufactured",
      "Iron"
    ],
    "slots": [
      [
        "Coal",
        "Iron"
      ],
      [
        "Manufactured"
      ],
      [
        "Manufactured"
      ],
      [
        "Iron"
      ]
    ],
    "mapZone": "center"
  },
  "Coventry": {
    "industries": [
      "Cotton",
      "Pottery",
      "Iron"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Pottery"
      ],
      [
        "Iron"
      ]
    ],
    "mapZone": "east"
  },
  "Wolverhampton": {
    "industries": [
      "Coal",
      "Coal"
    ],
    "slots": [
      [
        "Coal"
      ],
      [
        "Coal"
      ]
    ],
    "mapZone": "west"
  },
  "Dudley": {
    "industries": [
      "Coal",
      "Iron",
      "Manufactured"
    ],
    "slots": [
      [
        "Coal"
      ],
      [
        "Iron"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "southwest"
  },
  "Walsall": {
    "industries": [
      "Iron",
      "Coal"
    ],
    "slots": [
      [
        "Iron"
      ],
      [
        "Coal"
      ]
    ],
    "mapZone": "center"
  },
  "Tamworth": {
    "industries": [
      "Cotton",
      "Manufactured"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "east"
  },
  "Nuneaton": {
    "industries": [
      "Coal",
      "Cotton"
    ],
    "slots": [
      [
        "Coal"
      ],
      [
        "Cotton"
      ]
    ],
    "mapZone": "east"
  },
  "Coalbrookdale": {
    "industries": [
      "Iron",
      "Coal",
      "Iron",
      "Manufactured"
    ],
    "slots": [
      [
        "Iron",
        "Coal"
      ],
      [
        "Iron"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "west"
  },
  "Kidderminster": {
    "industries": [
      "Manufactured",
      "Manufactured"
    ],
    "slots": [
      [
        "Manufactured"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "south"
  },
  "Worcester": {
    "industries": [
      "Cotton",
      "Cotton"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Cotton"
      ]
    ],
    "mapZone": "south"
  },
  "Redditch": {
    "industries": [
      "Iron",
      "Manufactured"
    ],
    "slots": [
      [
        "Iron"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "south"
  },
  "Stafford": {
    "industries": [
      "Coal",
      "Pottery"
    ],
    "slots": [
      [
        "Coal"
      ],
      [
        "Pottery"
      ]
    ],
    "mapZone": "northwest"
  },
  "Burton": {
    "industries": [
      "Beer",
      "Coal"
    ],
    "slots": [
      [
        "Beer"
      ],
      [
        "Coal"
      ]
    ],
    "mapZone": "northeast"
  },
  "Cannock": {
    "industries": [
      "Coal",
      "Manufactured"
    ],
    "slots": [
      [
        "Coal"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "center"
  },
  "Derby": {
    "industries": [
      "Cotton",
      "Coal",
      "Iron",
      "Manufactured",
      "Manufactured"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Coal"
      ],
      [
        "Iron",
        "Manufactured"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "northeast"
  },
  "Stoke-on-Trent": {
    "industries": [
      "Cotton",
      "Manufactured",
      "Pottery",
      "Iron",
      "Coal"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Manufactured"
      ],
      [
        "Pottery"
      ],
      [
        "Iron",
        "Coal"
      ]
    ],
    "mapZone": "north"
  },
  "Stone": {
    "industries": [
      "Beer",
      "Manufactured",
      "Iron"
    ],
    "slots": [
      [
        "Beer"
      ],
      [
        "Manufactured",
        "Iron"
      ]
    ],
    "mapZone": "north"
  },
  "Uttoxeter": {
    "industries": [
      "Beer",
      "Beer"
    ],
    "slots": [
      [
        "Beer"
      ],
      [
        "Beer"
      ]
    ],
    "mapZone": "north"
  },
  "Leek": {
    "industries": [
      "Cotton",
      "Manufactured"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Manufactured"
      ]
    ],
    "mapZone": "north"
  },
  "Belper": {
    "industries": [
      "Cotton",
      "Manufactured",
      "Iron",
      "Pottery"
    ],
    "slots": [
      [
        "Cotton"
      ],
      [
        "Manufactured",
        "Iron"
      ],
      [
        "Pottery"
      ]
    ],
    "mapZone": "northeast"
  }
} as const;

export const PORT_IDS = [
  "Gloucester",
  "Warrington",
  "Nottingham",
  "Shrewsbury",
  "Oxford"
] as const;

export const EDGE_DEFS = [
  {
    "nodes": [
      "Birmingham",
      "Coventry"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Birmingham",
      "Wolverhampton"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Birmingham",
      "Dudley"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Birmingham",
      "Walsall"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Birmingham",
      "Tamworth"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Birmingham",
      "Burton"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Coventry",
      "Nuneaton"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Coventry",
      "Redditch"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Coventry",
      "Oxford"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Wolverhampton",
      "Dudley"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Wolverhampton",
      "Stafford"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Dudley",
      "Kidderminster"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Dudley",
      "Coalbrookdale"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Walsall",
      "Tamworth"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Walsall",
      "Wolverhampton"
    ],
    "kind": "rail"
  },
  {
    "nodes": [
      "Walsall",
      "Cannock"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Tamworth",
      "Nuneaton"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Tamworth",
      "Burton"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Nuneaton",
      "Birmingham"
    ],
    "kind": "rail"
  },
  {
    "nodes": [
      "Coalbrookdale",
      "Kidderminster"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Coalbrookdale",
      "Shrewsbury"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Kidderminster",
      "Worcester"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Worcester",
      "Redditch"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Worcester",
      "Gloucester"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Redditch",
      "Birmingham"
    ],
    "kind": "rail"
  },
  {
    "nodes": [
      "Stafford",
      "Burton"
    ],
    "kind": "rail"
  },
  {
    "nodes": [
      "Stafford",
      "Warrington"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Stafford",
      "Cannock"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Burton",
      "Derby"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Burton",
      "Nottingham"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Derby",
      "Nottingham"
    ],
    "kind": "both"
  },
  {
    "nodes": [
      "Nuneaton",
      "Nottingham"
    ],
    "kind": "rail"
  },
  {
    "nodes": [
      "Redditch",
      "Oxford"
    ],
    "kind": "canal"
  },
  {
    "nodes": [
      "Cannock",
      "Burton"
    ],
    "kind": "rail",
    "comment": "verify if this should be both"
  },
  {
    "nodes": [
      "Cannock",
      "Tamworth"
    ],
    "kind": "rail",
    "comment": "verify if this should be both"
  },
  {
    "nodes": [
      "Stafford",
      "Stone"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Stone",
      "Stoke-on-Trent"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Stoke-on-Trent",
      "Warrington"
    ],
    "kind": "canal",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Stoke-on-Trent",
      "Leek"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Stone",
      "Uttoxeter"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Uttoxeter",
      "Derby"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Leek",
      "Belper"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  },
  {
    "nodes": [
      "Belper",
      "Derby"
    ],
    "kind": "both",
    "comment": "image-inferred edge; verify era availability"
  }
] as const;

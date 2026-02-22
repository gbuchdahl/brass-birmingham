/* eslint-disable */
// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/board-topology.yaml

export const CITY_DEFS = {
  "Birmingham": {
    "industries": [
      "Coal",
      "Iron",
      "Manufactured"
    ]
  },
  "Coventry": {
    "industries": [
      "Cotton"
    ]
  },
  "Wolverhampton": {
    "industries": [
      "Coal"
    ]
  },
  "Dudley": {
    "industries": [
      "Coal",
      "Iron",
      "Beer"
    ]
  },
  "Walsall": {
    "industries": [
      "Iron",
      "Manufactured"
    ]
  },
  "Tamworth": {
    "industries": [
      "Pottery"
    ]
  },
  "Nuneaton": {
    "industries": [
      "Coal"
    ]
  },
  "Coalbrookdale": {
    "industries": [
      "Iron",
      "Pottery"
    ]
  },
  "Kidderminster": {
    "industries": [
      "Manufactured"
    ]
  },
  "Worcester": {
    "industries": [
      "Pottery",
      "Beer"
    ]
  },
  "Redditch": {
    "industries": [
      "Manufactured",
      "Beer"
    ]
  },
  "Stafford": {
    "industries": [
      "Coal"
    ]
  },
  "Burton": {
    "industries": [
      "Beer",
      "Manufactured"
    ]
  },
  "Cannock": {
    "industries": [
      "Coal",
      "Manufactured"
    ]
  },
  "Derby": {
    "industries": [
      "Beer",
      "Pottery"
    ]
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
    "kind": "rail",
    "comment": "needs image verification"
  },
  {
    "nodes": [
      "Redditch",
      "Oxford"
    ],
    "kind": "canal",
    "comment": "verify era and exact endpoint"
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
    "comment": "confirm if this edge exists"
  }
] as const;

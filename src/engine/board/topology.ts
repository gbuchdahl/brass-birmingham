export type EraKind = "canal" | "rail";

export type EdgeKind = EraKind | "both";

export const CITY_DEFS = {
  Birmingham: {
    industries: ["Coal", "Iron", "Manufactured"] as const,
  },
  Coventry: {
    industries: ["Cotton"] as const,
  },
  Wolverhampton: {
    industries: ["Coal"] as const,
  },
} as const;

export type CityId = keyof typeof CITY_DEFS;

export const PORT_IDS = ["Gloucester"] as const;

export type PortId = typeof PORT_IDS[number];

export type NodeId = CityId | PortId;

type EdgeDefinition = {
  nodes: readonly [NodeId, NodeId];
  kind: EdgeKind;
};

export const EDGE_DEFS = [
  { nodes: ["Birmingham", "Coventry"] as const, kind: "both" },
  { nodes: ["Birmingham", "Wolverhampton"] as const, kind: "canal" },
  { nodes: ["Coventry", "Wolverhampton"] as const, kind: "rail" },
  { nodes: ["Coventry", "Gloucester"] as const, kind: "canal" },
] as const satisfies readonly EdgeDefinition[];

export interface Edge {
  nodes: readonly [NodeId, NodeId];
  kind: EdgeKind;
}

export interface Topology {
  cities: CityId[];
  ports: PortId[];
  edges: Edge[];
}

export const TOPOLOGY: Topology = {
  cities: Object.keys(CITY_DEFS) as CityId[],
  ports: [...PORT_IDS],
  edges: EDGE_DEFS.map((edge) => ({ ...edge })),
};

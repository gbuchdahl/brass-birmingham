import type { EraKind } from "../types";

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
  Dudley: {
    industries: ["Coal", "Iron", "Beer"] as const,
  },
  Walsall: {
    industries: ["Iron", "Manufactured"] as const,
  },
  Tamworth: {
    industries: ["Pottery"] as const,
  },
  Nuneaton: {
    industries: ["Coal"] as const,
  },
  Coalbrookdale: {
    industries: ["Iron", "Pottery"] as const,
  },
  Kidderminster: {
    industries: ["Manufactured"] as const,
  },
  Worcester: {
    industries: ["Pottery", "Beer"] as const,
  },
  Redditch: {
    industries: ["Manufactured", "Beer"] as const,
  },
  Stafford: {
    industries: ["Coal"] as const,
  },
  Burton: {
    industries: ["Beer", "Manufactured"] as const,
  },
  Cannock: {
    industries: ["Coal", "Manufactured"] as const,
  },
  Derby: {
    industries: ["Beer", "Pottery"] as const,
  },
} as const;

export type CityId = keyof typeof CITY_DEFS;

export const PORT_IDS = [
  "Gloucester",
  "Warrington",
  "Nottingham",
  "Shrewsbury",
  "Oxford",
] as const;

export type PortId = typeof PORT_IDS[number];

export type NodeId = CityId | PortId;

type EdgeDefinition = {
  nodes: readonly [NodeId, NodeId];
  kind: EdgeKind;
  comment?: string;
};

export const EDGE_DEFS = [
  { nodes: ["Birmingham", "Coventry"] as const, kind: "both" },
  { nodes: ["Birmingham", "Wolverhampton"] as const, kind: "both" },
  { nodes: ["Birmingham", "Dudley"] as const, kind: "both" },
  { nodes: ["Birmingham", "Walsall"] as const, kind: "both" },
  { nodes: ["Birmingham", "Tamworth"] as const, kind: "both" },
  { nodes: ["Coventry", "Nuneaton"] as const, kind: "both" },
  { nodes: ["Coventry", "Redditch"] as const, kind: "canal" },
  { nodes: ["Coventry", "Oxford"] as const, kind: "canal" },
  { nodes: ["Wolverhampton", "Dudley"] as const, kind: "both" },
  { nodes: ["Wolverhampton", "Stafford"] as const, kind: "canal" },
  { nodes: ["Dudley", "Kidderminster"] as const, kind: "both" },
  { nodes: ["Dudley", "Coalbrookdale"] as const, kind: "both" },
  { nodes: ["Walsall", "Tamworth"] as const, kind: "both" },
  { nodes: ["Walsall", "Wolverhampton"] as const, kind: "rail" },
  { nodes: ["Walsall", "Cannock"] as const, kind: "both" },
  { nodes: ["Tamworth", "Nuneaton"] as const, kind: "both" },
  { nodes: ["Tamworth", "Burton"] as const, kind: "both" },
  { nodes: ["Nuneaton", "Birmingham"] as const, kind: "rail" },
  { nodes: ["Coalbrookdale", "Kidderminster"] as const, kind: "both" },
  { nodes: ["Coalbrookdale", "Shrewsbury"] as const, kind: "canal" },
  { nodes: ["Kidderminster", "Worcester"] as const, kind: "both" },
  { nodes: ["Worcester", "Redditch"] as const, kind: "both" },
  { nodes: ["Worcester", "Gloucester"] as const, kind: "canal" },
  { nodes: ["Redditch", "Birmingham"] as const, kind: "rail" },
  { nodes: ["Stafford", "Burton"] as const, kind: "rail" },
  { nodes: ["Stafford", "Warrington"] as const, kind: "canal" },
  { nodes: ["Stafford", "Cannock"] as const, kind: "both" },
  { nodes: ["Burton", "Derby"] as const, kind: "both" },
  { nodes: ["Burton", "Nottingham"] as const, kind: "canal" },
  { nodes: ["Derby", "Nottingham"] as const, kind: "both" },

  // TODO(image-check): I am not fully certain whether this should be a rail-only or both-era route.
  { nodes: ["Nuneaton", "Nottingham"] as const, kind: "rail", comment: "needs image verification" },

  // TODO(image-check): This connection appears present in the source image but label/era is hard to read.
  { nodes: ["Redditch", "Oxford"] as const, kind: "canal", comment: "verify era and exact endpoint" },

  // TODO(image-check): Cannock and Derby were added in this second pass, but these edges still need exact era/icon verification.
  { nodes: ["Cannock", "Burton"] as const, kind: "rail", comment: "verify if this should be both" },
  { nodes: ["Cannock", "Tamworth"] as const, kind: "rail", comment: "confirm if this edge exists" },
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
  edges: EDGE_DEFS.map((edge) => ({
    nodes: edge.nodes,
    kind: edge.kind,
  })),
};

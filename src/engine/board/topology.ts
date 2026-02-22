import type { EraKind } from "../types";
import {
  CITY_DEFS as GENERATED_CITY_DEFS,
  EDGE_DEFS as GENERATED_EDGE_DEFS,
  PORT_IDS as GENERATED_PORT_IDS,
} from "./generated/topology";

export type EdgeKind = EraKind | "both";
export type MapZone =
  | "northwest"
  | "north"
  | "northeast"
  | "west"
  | "center"
  | "east"
  | "southwest"
  | "south"
  | "southeast";

export const CITY_DEFS = GENERATED_CITY_DEFS;
export type CityId = keyof typeof CITY_DEFS;

export const PORT_IDS = GENERATED_PORT_IDS;
export type PortId = typeof PORT_IDS[number];

export type NodeId = CityId | PortId;

export interface Edge {
  nodes: readonly [NodeId, NodeId];
  kind: EdgeKind;
}

export interface Topology {
  cities: CityId[];
  ports: PortId[];
  edges: Edge[];
}

export function cityMapZone(city: CityId): MapZone {
  return CITY_DEFS[city].mapZone as MapZone;
}

export function cityIndustrySlots(city: CityId): ReadonlyArray<ReadonlyArray<string>> {
  const definition = CITY_DEFS[city] as {
    industries: readonly string[];
    slots?: readonly (readonly string[])[];
  };
  if (definition.slots && definition.slots.length > 0) {
    return definition.slots;
  }
  return definition.industries.map((industry) => [industry]);
}

export const EDGE_DEFS = GENERATED_EDGE_DEFS as ReadonlyArray<{
  nodes: readonly [NodeId, NodeId];
  kind: EdgeKind;
  comment?: string;
}>;

export const TOPOLOGY: Topology = {
  cities: Object.keys(CITY_DEFS) as CityId[],
  ports: [...PORT_IDS],
  edges: EDGE_DEFS.map((edge) => ({
    nodes: edge.nodes,
    kind: edge.kind,
  })),
};

export type EraKind = "canal" | "rail";

export type EdgeKind = EraKind | "both";

const EDGE_DEFS = [
  { a: "Birmingham", b: "Coventry", kind: "both" },
  { a: "Birmingham", b: "Wolverhampton", kind: "canal" },
  { a: "Coventry", b: "Wolverhampton", kind: "rail" },
] as const;

export type CityId =
  | typeof EDGE_DEFS[number]["a"]
  | typeof EDGE_DEFS[number]["b"];

export interface Edge {
  a: CityId;
  b: CityId;
  kind: EdgeKind;
}

export interface Topology {
  cities: CityId[];
  edges: Edge[];
}

const citiesFromEdges = (edges: readonly typeof EDGE_DEFS[number][]): CityId[] => {
  const set = new Set<string>();
  for (const edge of edges) {
    set.add(edge.a);
    set.add(edge.b);
  }
  return Array.from(set) as CityId[];
};

export const TOPOLOGY: Topology = {
  cities: citiesFromEdges(EDGE_DEFS),
  edges: EDGE_DEFS.map((edge) => ({ ...edge })) as Edge[],
};

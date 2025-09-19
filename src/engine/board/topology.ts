export type CityId = "Birmingham" | "Coventry" | "Wolverhampton";

export type EraKind = "canal" | "rail";

export type EdgeKind = EraKind | "both";

export interface Edge {
  a: CityId;
  b: CityId;
  kind: EdgeKind;
}

export interface Topology {
  cities: CityId[];
  edges: Edge[];
}

export const TOPOLOGY: Topology = {
  cities: ["Birmingham", "Coventry", "Wolverhampton"],
  edges: [
    { a: "Birmingham", b: "Coventry", kind: "both" },
    { a: "Birmingham", b: "Wolverhampton", kind: "canal" },
    { a: "Coventry", b: "Wolverhampton", kind: "rail" },
  ],
};

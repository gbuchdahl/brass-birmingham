// Tiny subset to get you moving; expand later.
export type CityId = "Birmingham" | "Coventry";
export type LinkId = "Birmingham-Coventry" | string;

export const Cities: CityId[] = ["Birmingham", "Coventry"];

export const Links: { id: LinkId; a: CityId; b: CityId; kind: "canal" | "rail" }[] = [
  { id: "Birmingham-Coventry", a: "Birmingham", b: "Coventry", kind: "canal" },
];

// Adjacency for quick reachability later
export const Adj: Record<CityId, CityId[]> = {
  Birmingham: ["Coventry"],
  Coventry: ["Birmingham"],
};

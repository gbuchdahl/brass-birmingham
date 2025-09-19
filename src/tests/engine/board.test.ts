import { describe, expect, it } from "vitest";
import { createGame } from "@/engine";
import { buildLink, isLegalLink, areConnected } from "@/engine/board/api";

const seats = ["A", "B"] as const;

describe("board links", () => {
  it("permits building only in eligible eras", () => {
    const state = createGame([...seats], "eligible-eras");
    const edges = state.board.topology.edges;

    const bothEdge = edges.find((edge) => edge.kind === "both");
    const canalEdge = edges.find((edge) => edge.kind === "canal");
    const railEdge = edges.find((edge) => edge.kind === "rail");

    expect(bothEdge).toBeDefined();
    expect(canalEdge).toBeDefined();
    expect(railEdge).toBeDefined();

    if (!bothEdge || !canalEdge || !railEdge) return;

    expect(isLegalLink(state, bothEdge.a, bothEdge.b, "canal")).toBe(true);
    expect(isLegalLink(state, bothEdge.a, bothEdge.b, "rail")).toBe(true);

    expect(isLegalLink(state, canalEdge.a, canalEdge.b, "canal")).toBe(true);
    expect(isLegalLink(state, canalEdge.a, canalEdge.b, "rail")).toBe(false);

    expect(isLegalLink(state, railEdge.a, railEdge.b, "rail")).toBe(true);
    expect(isLegalLink(state, railEdge.a, railEdge.b, "canal")).toBe(false);
  });

  it("records the builder and prevents rebuilding", () => {
    const state = createGame([...seats], "build-link");
    const target = state.board.topology.edges.find((edge) => edge.kind === "canal");
    expect(target).toBeDefined();
    if (!target) return;

    const built = buildLink(state, seats[0], target.a, target.b, "canal");
    const idx = built.board.topology.edges.findIndex(
      (edge) => edge.kind === "canal" && edge.a === target.a && edge.b === target.b,
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(built.board.linkStates[idx].builtBy).toBe(seats[0]);
    expect(isLegalLink(built, target.a, target.b, "canal")).toBe(false);
    expect(() => buildLink(built, seats[1], target.a, target.b, "canal")).toThrow();
  });

  it("rejects attempting to build in the wrong era", () => {
    const state = createGame([...seats], "wrong-era");
    const canalEdge = state.board.topology.edges.find((edge) => edge.kind === "canal");
    const railEdge = state.board.topology.edges.find((edge) => edge.kind === "rail");
    expect(canalEdge).toBeDefined();
    expect(railEdge).toBeDefined();
    if (!canalEdge || !railEdge) return;

    expect(isLegalLink(state, canalEdge.a, canalEdge.b, "rail")).toBe(false);
    expect(() => buildLink(state, seats[0], canalEdge.a, canalEdge.b, "rail")).toThrow();

    const builtRail = buildLink(state, seats[0], railEdge.a, railEdge.b, "rail");
    expect(isLegalLink(builtRail, railEdge.a, railEdge.b, "rail")).toBe(false);
  });

  it("updates connectivity when links are built", () => {
    const state = createGame([...seats], "connectivity");
    const edge = state.board.topology.edges.find((e) => e.kind === "canal" || e.kind === "both");
    expect(edge).toBeDefined();
    if (!edge) return;

    const era = edge.kind === "both" ? "canal" : edge.kind;
    expect(areConnected(state, edge.a, edge.b)).toBe(false);

    const withLink = buildLink(state, seats[0], edge.a, edge.b, era);
    expect(areConnected(withLink, edge.a, edge.b)).toBe(true);
  });

  it("connects cities through multi-hop paths", () => {
    const state = createGame([...seats], "multi-hop");
    const bothEdge = state.board.topology.edges.find((edge) => edge.kind === "both");
    const canalEdge = state.board.topology.edges.find((edge) => edge.kind === "canal");

    expect(bothEdge).toBeDefined();
    expect(canalEdge).toBeDefined();
    if (!bothEdge || !canalEdge) return;

    const withFirst = buildLink(state, seats[0], bothEdge.a, bothEdge.b, "canal");
    expect(areConnected(withFirst, bothEdge.b, canalEdge.b)).toBe(false);

    const withSecond = buildLink(withFirst, seats[0], canalEdge.a, canalEdge.b, "canal");
    const start = bothEdge.b;
    const end = canalEdge.b === start ? canalEdge.a : canalEdge.b;
    expect(areConnected(withSecond, start, end)).toBe(true);
  });
});

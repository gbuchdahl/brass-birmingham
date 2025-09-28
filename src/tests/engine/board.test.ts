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

    const [bothA, bothB] = bothEdge.nodes;
    const [canalA, canalB] = canalEdge.nodes;
    const [railA, railB] = railEdge.nodes;

    expect(isLegalLink(state, bothA, bothB, "canal")).toBe(true);
    expect(isLegalLink(state, bothA, bothB, "rail")).toBe(true);

    expect(isLegalLink(state, canalA, canalB, "canal")).toBe(true);
    expect(isLegalLink(state, canalA, canalB, "rail")).toBe(false);

    expect(isLegalLink(state, railA, railB, "rail")).toBe(true);
    expect(isLegalLink(state, railA, railB, "canal")).toBe(false);
  });

  it("records the builder and prevents rebuilding", () => {
    const state = createGame([...seats], "build-link");
    const target = state.board.topology.edges.find((edge) => edge.kind === "canal");
    expect(target).toBeDefined();
    if (!target) return;

    const [a, b] = target.nodes;
    const built = buildLink(state, seats[0], a, b, "canal");
    const idx = built.board.topology.edges.findIndex((edge) => {
      if (edge.kind !== "canal") return false;
      const [edgeA, edgeB] = edge.nodes;
      return (
        (edgeA === a && edgeB === b) ||
        (edgeA === b && edgeB === a)
      );
    });
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(built.board.linkStates[idx].builtBy).toBe(seats[0]);
    expect(isLegalLink(built, a, b, "canal")).toBe(false);
    expect(() => buildLink(built, seats[1], a, b, "canal")).toThrow();
  });

  it("rejects attempting to build in the wrong era", () => {
    const state = createGame([...seats], "wrong-era");
    const canalEdge = state.board.topology.edges.find((edge) => edge.kind === "canal");
    const railEdge = state.board.topology.edges.find((edge) => edge.kind === "rail");
    expect(canalEdge).toBeDefined();
    expect(railEdge).toBeDefined();
    if (!canalEdge || !railEdge) return;

    const [canalA, canalB] = canalEdge.nodes;
    const [railA, railB] = railEdge.nodes;

    expect(isLegalLink(state, canalA, canalB, "rail")).toBe(false);
    expect(() => buildLink(state, seats[0], canalA, canalB, "rail")).toThrow();

    const builtRail = buildLink(state, seats[0], railA, railB, "rail");
    expect(isLegalLink(builtRail, railA, railB, "rail")).toBe(false);
  });

  it("updates connectivity when links are built", () => {
    const state = createGame([...seats], "connectivity");
    const edge = state.board.topology.edges.find((e) => e.kind === "canal" || e.kind === "both");
    expect(edge).toBeDefined();
    if (!edge) return;

    const [a, b] = edge.nodes;
    const era = edge.kind === "both" ? "canal" : edge.kind;
    expect(areConnected(state, a, b)).toBe(false);

    const withLink = buildLink(state, seats[0], a, b, era);
    expect(areConnected(withLink, a, b)).toBe(true);
  });

  it("connects cities through multi-hop paths", () => {
    const state = createGame([...seats], "multi-hop");
    const bothEdge = state.board.topology.edges.find((edge) => edge.kind === "both");
    const canalEdge = state.board.topology.edges.find((edge) => edge.kind === "canal");

    expect(bothEdge).toBeDefined();
    expect(canalEdge).toBeDefined();
    if (!bothEdge || !canalEdge) return;

    const [bothA, bothB] = bothEdge.nodes;
    const [canalA, canalB] = canalEdge.nodes;

    const withFirst = buildLink(state, seats[0], bothA, bothB, "canal");
    expect(areConnected(withFirst, bothB, canalB)).toBe(false);

    const withSecond = buildLink(withFirst, seats[0], canalA, canalB, "canal");
    const start = bothB;
    const end = canalB === start ? canalA : canalB;
    expect(areConnected(withSecond, start, end)).toBe(true);
  });

  it("connects cities to ports once links are built", () => {
    const state = createGame([...seats], "port-hop");
    const portEdge = state.board.topology.edges.find((edge) => {
      const [first, second] = edge.nodes;
      return first === "Gloucester" || second === "Gloucester";
    });

    expect(portEdge).toBeDefined();
    if (!portEdge) return;

    const [nodeA, nodeB] = portEdge.nodes;
    const city = nodeA === "Gloucester" ? nodeB : nodeA;
    const port = nodeA === "Gloucester" ? nodeA : nodeB;

    expect(isLegalLink(state, city, port, "canal")).toBe(true);
    expect(areConnected(state, city, port)).toBe(false);

    const withPort = buildLink(state, seats[0], city, port, "canal");
    expect(areConnected(withPort, city, port)).toBe(true);
  });
});

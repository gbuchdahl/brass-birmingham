import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import type { GameState } from "@/engine";
import type { Edge } from "@/engine/board/topology";

function findEdgeOrThrow(
  state: GameState,
  predicate: (edge: Edge) => boolean,
  label: string,
): Edge {
  const edge = state.board.topology.edges.find(predicate);
  expect(edge, `Missing ${label} edge in test topology`).toBeDefined();
  return edge!;
}

describe("reduce", () => {
  it("deals the correct number of cards to each player", () => {
    const seats = ["A", "B", "C", "D"] as const;
    const state = createGame([...seats], "test-seed");

    const expectedHandSize = 8;
    for (const seat of seats) {
      expect(state.players[seat].hand).toHaveLength(expectedHandSize);
    }
  });

  it("cycles to the next player on END_TURN", () => {
    const state = createGame(["A", "B", "C"]);

    const next = reduce(state, { type: "END_TURN", player: state.currentPlayer });

    expect(next.currentPlayer).toBe("B");
    expect(next.turn).toBe(state.turn + 1);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "END_TURN",
      data: { from: "A", to: "B" },
    });
  });

  it("ignores END_TURN from the wrong player", () => {
    const state = createGame(["A", "B"]);

    const next = reduce(state, { type: "END_TURN", player: "B" });

    expect(next).toBe(state);
  });

  it("builds a legal canal link and appends a log event", () => {
    const state = createGame(["A", "B"], "build-link-success");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;
    const next = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from,
      to,
    });

    expect(next).not.toBe(state);
    expect(next.turn).toBe(state.turn);
    expect(next.currentPlayer).toBe(state.currentPlayer);
    expect(next.log).toHaveLength(state.log.length + 1);
    const edgeIndex = next.board.topology.edges.findIndex((edge) => {
      const [edgeA, edgeB] = edge.nodes;
      return (
        (edgeA === from && edgeB === to) ||
        (edgeA === to && edgeB === from)
      );
    });
    expect(edgeIndex).toBeGreaterThanOrEqual(0);
    expect(next.board.linkStates[edgeIndex].builtBy).toBe("A");
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { player: "A", from, to, era: "canal" },
    });
  });

  it("ignores BUILD_LINK from the wrong player", () => {
    const state = createGame(["A", "B"], "wrong-player");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;
    const next = reduce(state, { type: "BUILD_LINK", player: "B", from, to });
    expect(next).toBe(state);
  });

  it("ignores BUILD_LINK on a rail-only edge during canal phase", () => {
    const state = createGame(["A", "B"], "rail-edge-canal-phase");
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail", "rail");
    const [from, to] = target.nodes;
    const next = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from,
      to,
    });

    expect(next).toBe(state);
  });

  it("ignores BUILD_LINK when edge is already built", () => {
    const state = createGame(["A", "B"], "duplicate-build");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;
    const built = reduce(state, { type: "BUILD_LINK", player: "A", from, to });
    const duplicate = reduce(built, { type: "BUILD_LINK", player: "A", from, to });
    expect(duplicate).toBe(built);
  });

  it("accepts BUILD_LINK when from/to are reversed", () => {
    const state = createGame(["A", "B"], "reverse-order");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;

    const next = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from: to,
      to: from,
    });

    expect(next).not.toBe(state);
    const lastEvent = next.log[next.log.length - 1];
    expect(lastEvent).toMatchObject({
      type: "BUILD_LINK",
      data: { player: "A", from: to, to: from, era: "canal" },
    });
  });

  it("ignores BUILD_LINK when the edge does not exist", () => {
    const state = createGame(["A", "B"], "missing-edge");
    const next = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from: "Birmingham",
      to: "Gloucester",
    });

    expect(next).toBe(state);
  });
});

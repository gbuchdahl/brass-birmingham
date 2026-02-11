import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import type { GameState, ReduceResult } from "@/engine";
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

function expectOk(result: ReduceResult): GameState {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected ok result, got ${result.error.code}`);
  }
  return result.state;
}

function expectInvalid(
  result: ReduceResult,
  previous: GameState,
  code: "NOT_CURRENT_PLAYER" | "ILLEGAL_LINK_FOR_PHASE",
): GameState {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected invalid result");
  }
  expect(result.error.code).toBe(code);
  const next = result.state;
  expect(next).not.toBe(previous);
  expect(next.log).toHaveLength(previous.log.length + 1);
  expect(next.log[next.log.length - 1]).toMatchObject({
    type: "INVALID_ACTION",
    data: {
      code,
      message: result.error.message,
      context: {
        currentPlayer: previous.currentPlayer,
        phase: previous.phase,
      },
    },
  });
  return next;
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

    const result = reduce(state, { type: "END_TURN", player: state.currentPlayer });
    const next = expectOk(result);

    expect(next.currentPlayer).toBe("B");
    expect(next.turn).toBe(state.turn + 1);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "END_TURN",
      data: { from: "A", to: "B" },
    });
  });

  it("ignores END_TURN from the wrong player", () => {
    const state = createGame(["A", "B"]);

    const result = reduce(state, { type: "END_TURN", player: "B" });
    const next = expectInvalid(result, state, "NOT_CURRENT_PLAYER");
    const event = next.log[next.log.length - 1];
    expect(event).toMatchObject({
      type: "INVALID_ACTION",
      data: {
        player: "B",
        action: { type: "END_TURN", player: "B" },
      },
    });

    expect(next.turn).toBe(state.turn);
    expect(next.currentPlayer).toBe(state.currentPlayer);
  });

  it("builds a legal canal link and appends a log event", () => {
    const state = createGame(["A", "B"], "build-link-success");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;
    const result = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from,
      to,
    });
    const next = expectOk(result);

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
    const result = reduce(state, { type: "BUILD_LINK", player: "B", from, to });
    const next = expectInvalid(result, state, "NOT_CURRENT_PLAYER");
    const event = next.log[next.log.length - 1];
    expect(event).toMatchObject({
      type: "INVALID_ACTION",
      data: {
        player: "B",
        action: { type: "BUILD_LINK", player: "B", from, to },
      },
    });
    expect(next.turn).toBe(state.turn);
    expect(next.currentPlayer).toBe(state.currentPlayer);
  });

  it("ignores BUILD_LINK on a rail-only edge during canal phase", () => {
    const state = createGame(["A", "B"], "rail-edge-canal-phase");
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail", "rail");
    const [from, to] = target.nodes;
    const result = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from,
      to,
    });
    const next = expectInvalid(result, state, "ILLEGAL_LINK_FOR_PHASE");

    expect(next.board).toBe(state.board);
  });

  it("ignores BUILD_LINK when edge is already built", () => {
    const state = createGame(["A", "B"], "duplicate-build");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;
    const built = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));
    const duplicate = expectInvalid(
      reduce(built, { type: "BUILD_LINK", player: "A", from, to }),
      built,
      "ILLEGAL_LINK_FOR_PHASE",
    );
    expect(duplicate.board).toBe(built.board);
  });

  it("accepts BUILD_LINK when from/to are reversed", () => {
    const state = createGame(["A", "B"], "reverse-order");
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "both" || edge.kind === "canal",
      "canal/both",
    );
    const [from, to] = target.nodes;

    const result = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from: to,
      to: from,
    });
    const next = expectOk(result);

    expect(next).not.toBe(state);
    const lastEvent = next.log[next.log.length - 1];
    expect(lastEvent).toMatchObject({
      type: "BUILD_LINK",
      data: { player: "A", from: to, to: from, era: "canal" },
    });
  });

  it("ignores BUILD_LINK when the edge does not exist", () => {
    const state = createGame(["A", "B"], "missing-edge");
    const result = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from: "Birmingham",
      to: "Gloucester",
    });
    const next = expectInvalid(result, state, "ILLEGAL_LINK_FOR_PHASE");

    expect(next.board).toBe(state.board);
  });
});

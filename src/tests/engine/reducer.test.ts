import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";

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
    const target = state.board.topology.edges.find(
      (edge) => edge.kind === "both" || edge.kind === "canal",
    );
    expect(target).toBeDefined();
    if (!target) return;

    const [from, to] = target.nodes;
    const next = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from,
      to,
    });

    expect(next).not.toBe(state);
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
    const target = state.board.topology.edges.find(
      (edge) => edge.kind === "both" || edge.kind === "canal",
    );
    expect(target).toBeDefined();
    if (!target) return;

    const [from, to] = target.nodes;
    const next = reduce(state, { type: "BUILD_LINK", player: "B", from, to });
    expect(next).toBe(state);
  });

  it("ignores BUILD_LINK on a rail-only edge during canal phase", () => {
    const state = createGame(["A", "B"], "rail-edge-canal-phase");
    const target = state.board.topology.edges.find((edge) => edge.kind === "rail");
    expect(target).toBeDefined();
    if (!target) return;

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
    const target = state.board.topology.edges.find(
      (edge) => edge.kind === "both" || edge.kind === "canal",
    );
    expect(target).toBeDefined();
    if (!target) return;

    const [from, to] = target.nodes;
    const built = reduce(state, { type: "BUILD_LINK", player: "A", from, to });
    const duplicate = reduce(built, { type: "BUILD_LINK", player: "A", from, to });
    expect(duplicate).toBe(built);
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

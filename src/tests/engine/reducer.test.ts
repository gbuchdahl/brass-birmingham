import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import type { GameState, ReduceResult } from "@/engine";
import { buildLink } from "@/engine/board/api";
import type { Edge } from "@/engine/board/topology";
import { coalMarketPrice } from "@/engine/rules/config";
import { makeTile, withTiles } from "./helpers";

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
  code:
    | "NOT_CURRENT_PLAYER"
    | "ILLEGAL_LINK_FOR_PHASE"
    | "INSUFFICIENT_RESOURCES"
    | "INVALID_TILE_FLIP_STATE"
    | "ILLEGAL_INDUSTRY_BUILD",
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
  it("deals the correct number of cards to each player and starts with 17 money", () => {
    const seats = ["A", "B", "C", "D"] as const;
    const state = createGame([...seats], "test-seed");

    const expectedHandSize = 8;
    for (const seat of seats) {
      expect(state.players[seat].hand).toHaveLength(expectedHandSize);
      expect(state.players[seat].money).toBe(17);
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

  it("consumes connected coal tile when building a rail link", () => {
    const baseState = {
      ...createGame(["A", "B"], "rail-coal-tile"),
      phase: "rail" as const,
    };
    const state = {
      ...baseState,
      board: {
        ...baseState.board,
        tiles: {
          "tile-coal-nuneaton": {
            id: "tile-coal-nuneaton",
            city: "Nuneaton",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 2,
            incomeOnFlip: 2,
            flipped: false,
          },
        },
      },
    };
    const target = findEdgeOrThrow(
      state,
      (edge) =>
        edge.kind !== "canal" &&
        edge.nodes.includes("Nuneaton"),
      "rail-eligible edge touching Nuneaton",
    );
    const [from, to] = target.nodes;
    const beforeCoal = state.board.tiles["tile-coal-nuneaton"];
    expect(beforeCoal.resourcesRemaining).toBeGreaterThan(0);

    const result = reduce(state, {
      type: "BUILD_LINK",
      player: "A",
      from,
      to,
    });
    const next = expectOk(result);
    const afterCoal = next.board.tiles["tile-coal-nuneaton"];

    expect(afterCoal.resourcesRemaining).toBe(beforeCoal.resourcesRemaining - 1);
    expect(next.players.A.money).toBe(state.players.A.money);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { era: "rail", coalConsumed: 1, coalSource: "tile", coalSpend: 0 },
    });
  });

  it("uses coal market when no connected coal tile is available", () => {
    const stateBase = {
      ...createGame(["A", "B"], "rail-coal-market"),
      phase: "rail" as const,
    };
    const emptyTiles = Object.fromEntries(
      Object.entries(stateBase.board.tiles).map(([id, tile]) => [
        id,
        { ...tile, resourcesRemaining: 0, flipped: true },
      ]),
    );
    const state = {
      ...stateBase,
      board: {
        ...stateBase.board,
        tiles: emptyTiles,
      },
    };
    expect(state.market.coal.units).toBeGreaterThan(0);
    const marketPrice = coalMarketPrice(state.market.coal.units);
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "rail" || edge.kind === "both",
      "rail-eligible edge",
    );
    const [from, to] = target.nodes;

    const result = reduce(state, { type: "BUILD_LINK", player: "A", from, to });
    const next = expectOk(result);

    expect(next.players.A.money).toBe(state.players.A.money - marketPrice);
    expect(next.market.coal.units).toBe(state.market.coal.units - 1);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { era: "rail", coalConsumed: 1, coalSource: "market", coalSpend: marketPrice },
    });
  });

  it("uses fallback coal price when market is empty", () => {
    const stateBase = {
      ...createGame(["A", "B"], "rail-coal-fallback"),
      phase: "rail" as const,
    };
    const state = {
      ...stateBase,
      board: {
        ...stateBase.board,
        tiles: Object.fromEntries(
          Object.entries(stateBase.board.tiles).map(([id, tile]) => [
            id,
            { ...tile, resourcesRemaining: 0, flipped: true },
          ]),
        ),
      },
      market: {
        ...stateBase.market,
        coal: {
          ...stateBase.market.coal,
          units: 0,
        },
      },
    };
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "rail" || edge.kind === "both",
      "rail-eligible edge",
    );
    const [from, to] = target.nodes;
    const fallback = state.market.coal.fallbackPrice;

    const result = reduce(state, { type: "BUILD_LINK", player: "A", from, to });
    const next = expectOk(result);

    expect(next.players.A.money).toBe(state.players.A.money - fallback);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { era: "rail", coalConsumed: 1, coalSource: "fallback", coalSpend: fallback },
    });
  });

  it("rejects rail build when no coal source is affordable", () => {
    const stateBase = {
      ...createGame(["A", "B"], "rail-coal-insufficient"),
      phase: "rail" as const,
    };
    const state = {
      ...stateBase,
      board: {
        ...stateBase.board,
        tiles: Object.fromEntries(
          Object.entries(stateBase.board.tiles).map(([id, tile]) => [
            id,
            { ...tile, resourcesRemaining: 0, flipped: true },
          ]),
        ),
      },
      market: {
        ...stateBase.market,
        coal: {
          ...stateBase.market.coal,
          units: 0,
        },
      },
      players: {
        ...stateBase.players,
        A: {
          ...stateBase.players.A,
          money: stateBase.market.coal.fallbackPrice - 1,
        },
      },
    };
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "rail" || edge.kind === "both",
      "rail-eligible edge",
    );
    const [from, to] = target.nodes;

    const result = reduce(state, { type: "BUILD_LINK", player: "A", from, to });
    const next = expectInvalid(result, state, "INSUFFICIENT_RESOURCES");

    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "INVALID_ACTION",
      data: { code: "INSUFFICIENT_RESOURCES" },
    });
    expect(next.board).toEqual(state.board);
  });

  it("flips coal tile and awards income when owner consumes last cube", () => {
    const state = {
      ...createGame(["A", "B"], "flip-owner"),
      phase: "rail" as const,
      board: {
        ...createGame(["A", "B"], "flip-owner").board,
        tiles: {
          "tile-coal-nuneaton": {
            id: "tile-coal-nuneaton",
            city: "Nuneaton",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 2,
            flipped: false,
          },
        },
      },
    };
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "rail" && edge.nodes.includes("Nuneaton"),
      "rail edge with nuneaton",
    );
    const [from, to] = target.nodes;
    const result = reduce(state, { type: "BUILD_LINK", player: "A", from, to });
    const next = expectOk(result);

    expect(next.board.tiles["tile-coal-nuneaton"].flipped).toBe(true);
    expect(next.board.tiles["tile-coal-nuneaton"].resourcesRemaining).toBe(0);
    expect(next.players.A.income).toBe(state.players.A.income + 2);
  });

  it("flips coal tile and awards income to owner when opponent consumes last cube", () => {
    const base = createGame(["A", "B"], "flip-opponent");
    const state = {
      ...base,
      phase: "rail" as const,
      currentPlayer: "B",
      board: {
        ...base.board,
        tiles: {
          "tile-coal-nuneaton": {
            id: "tile-coal-nuneaton",
            city: "Nuneaton",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 3,
            flipped: false,
          },
        },
      },
    };
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind === "rail" && edge.nodes.includes("Nuneaton"),
      "rail edge with nuneaton",
    );
    const [from, to] = target.nodes;
    const result = reduce(state, { type: "BUILD_LINK", player: "B", from, to });
    const next = expectOk(result);
    const event = next.log[next.log.length - 1];

    expect(next.board.tiles["tile-coal-nuneaton"].flipped).toBe(true);
    expect(next.players.A.income).toBe(state.players.A.income + 3);
    expect(next.players.B.income).toBe(state.players.B.income);
    expect(event).toMatchObject({
      type: "BUILD_LINK",
      data: {
        flippedTiles: ["tile-coal-nuneaton"],
        incomeAwards: [{ tileId: "tile-coal-nuneaton", player: "A", amount: 3 }],
      },
    });
  });

  it("builds coal industry and pushes cubes to market when connected to a port", () => {
    const base = createGame(["A", "B"], "build-coal-connected");
    const connected = buildLink(base, "A", "Stafford", "Warrington", "canal");
    const result = reduce(connected, {
      type: "BUILD_INDUSTRY",
      player: "A",
      city: "Stafford",
      industry: "coal",
      level: 1,
    });
    const next = expectOk(result);
    const event = next.log[next.log.length - 1];
    expect(event).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: { city: "Stafford", industry: "coal", marketMoved: 1 },
    });
  });

  it("builds coal industry and keeps cubes when not connected to a port", () => {
    const state = createGame(["A", "B"], "build-coal-disconnected");
    const result = reduce(state, {
      type: "BUILD_INDUSTRY",
      player: "A",
      city: "Stafford",
      industry: "coal",
      level: 1,
    });
    const next = expectOk(result);
    const event = next.log[next.log.length - 1];
    expect(event).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: { city: "Stafford", industry: "coal", marketMoved: 0, flipped: false },
    });
  });

  it("builds iron industry and moves output to market immediately", () => {
    const state = createGame(["A", "B"], "build-iron");
    const result = reduce(state, {
      type: "BUILD_INDUSTRY",
      player: "A",
      city: "Dudley",
      industry: "iron",
      level: 1,
    });
    const next = expectOk(result);
    const event = next.log[next.log.length - 1];
    expect(event).toMatchObject({
      type: "BUILD_INDUSTRY",
      data: { city: "Dudley", industry: "iron", marketMoved: 1, flipped: true, incomeDelta: 1 },
    });
    expect(next.players.A.income).toBe(state.players.A.income + 1);
  });

  it("rejects BUILD_INDUSTRY from non-current player", () => {
    const state = createGame(["A", "B"], "build-industry-wrong-player");
    const next = expectInvalid(
      reduce(state, {
        type: "BUILD_INDUSTRY",
        player: "B",
        city: "Stafford",
        industry: "coal",
        level: 1,
      }),
      state,
      "NOT_CURRENT_PLAYER",
    );
    expect(next.board).toBe(state.board);
  });

  it("rejects BUILD_INDUSTRY in unsupported city/industry slots", () => {
    const state = createGame(["A", "B"], "build-industry-illegal-city");
    const next = expectInvalid(
      reduce(state, {
        type: "BUILD_INDUSTRY",
        player: "A",
        city: "Coventry",
        industry: "coal",
        level: 1,
      }),
      state,
      "ILLEGAL_INDUSTRY_BUILD",
    );
    expect(next.board).toBe(state.board);
  });

  it("rejects BUILD_INDUSTRY when same unflipped industry already exists in city", () => {
    const state = withTiles(createGame(["A", "B"], "build-industry-duplicate"), {
      "tile-coal-stafford": makeTile("tile-coal-stafford", {
        city: "Stafford",
        industry: "coal",
        flipped: false,
      }),
    });
    const next = expectInvalid(
      reduce(state, {
        type: "BUILD_INDUSTRY",
        player: "A",
        city: "Stafford",
        industry: "coal",
        level: 1,
      }),
      state,
      "ILLEGAL_INDUSTRY_BUILD",
    );
    expect(next.players.A.money).toBe(state.players.A.money);
  });

  it("rejects BUILD_INDUSTRY when player cannot afford build cost", () => {
    const base = createGame(["A", "B"], "build-industry-no-money");
    const state = {
      ...base,
      players: {
        ...base.players,
        A: { ...base.players.A, money: 0 },
      },
    };
    const next = expectInvalid(
      reduce(state, {
        type: "BUILD_INDUSTRY",
        player: "A",
        city: "Stafford",
        industry: "coal",
        level: 1,
      }),
      state,
      "ILLEGAL_INDUSTRY_BUILD",
    );
    expect(next.players.A.money).toBe(0);
  });

  it("rejects BUILD_INDUSTRY for unsupported placeholder level", () => {
    const state = createGame(["A", "B"], "build-industry-bad-level");
    const next = expectInvalid(
      reduce(state, {
        type: "BUILD_INDUSTRY",
        player: "A",
        city: "Stafford",
        industry: "coal",
        level: 2,
      }),
      state,
      "ILLEGAL_INDUSTRY_BUILD",
    );
    expect(next.board.tiles).toEqual(state.board.tiles);
  });

  it("returns INVALID_TILE_FLIP_STATE for malformed tile data", () => {
    const base = createGame(["A", "B"], "bad-tile-invariant");
    const badState = {
      ...base,
      board: {
        ...base.board,
        tiles: {
          "tile-bad": {
            id: "tile-bad",
            city: "Stafford",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 0,
            incomeOnFlip: 1,
            flipped: false,
          },
        },
      },
    };
    const result = reduce(badState, { type: "END_TURN", player: "A" });
    const next = expectInvalid(result, badState, "INVALID_TILE_FLIP_STATE");
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "INVALID_ACTION",
      data: { code: "INVALID_TILE_FLIP_STATE" },
    });
  });

  it("returns INVALID_TILE_FLIP_STATE for flipped tile with remaining resources", () => {
    const base = createGame(["A", "B"], "bad-tile-invariant-reverse");
    const badState = withTiles(base, {
      "tile-bad": makeTile("tile-bad", {
        city: "Stafford",
        industry: "coal",
        resourcesRemaining: 1,
        flipped: true,
      }),
    });
    const next = expectInvalid(
      reduce(badState, { type: "END_TURN", player: "A" }),
      badState,
      "INVALID_TILE_FLIP_STATE",
    );
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "INVALID_ACTION",
      data: { code: "INVALID_TILE_FLIP_STATE" },
    });
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

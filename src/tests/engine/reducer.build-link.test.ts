import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import { coalMarketPrice } from "@/engine/rules/config";
import { makeTile, withTiles } from "./helpers";
import { expectInvalid, expectOk, findEdgeOrThrow } from "./reducer.shared";

describe("reduce BUILD_LINK", () => {
  it("auto-ends turn after first action in round 1", () => {
    const state = createGame(["A", "B"], "round1-auto-end");
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "both" || edge.kind === "canal", "canal/both");
    const [from, to] = target.nodes;

    const next = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));
    expect(next.currentPlayer).toBe("B");
    expect(next.actionsTakenThisTurn).toBe(0);
    expect(next.log[next.log.length - 1]).toMatchObject({ type: "AUTO_END_TURN" });
  });

  it("requires two actions in round 2 before auto-ending", () => {
    const base = { ...createGame(["A", "B"], "round2-two-actions"), round: 2 };
    const firstEdge = findEdgeOrThrow(base, (edge) => edge.kind === "both" || edge.kind === "canal", "first");
    const secondEdge = findEdgeOrThrow(
      base,
      (edge) =>
        (edge.kind === "both" || edge.kind === "canal") &&
        !(
          (edge.nodes[0] === firstEdge.nodes[0] && edge.nodes[1] === firstEdge.nodes[1]) ||
          (edge.nodes[0] === firstEdge.nodes[1] && edge.nodes[1] === firstEdge.nodes[0])
        ),
      "second",
    );

    const afterFirst = expectOk(
      reduce(base, { type: "BUILD_LINK", player: "A", from: firstEdge.nodes[0], to: firstEdge.nodes[1] }),
    );
    expect(afterFirst.currentPlayer).toBe("A");
    expect(afterFirst.actionsTakenThisTurn).toBe(1);

    const afterSecond = expectOk(
      reduce(afterFirst, { type: "BUILD_LINK", player: "A", from: secondEdge.nodes[0], to: secondEdge.nodes[1] }),
    );
    expect(afterSecond.currentPlayer).toBe("B");
    expect(afterSecond.actionsTakenThisTurn).toBe(0);
    expect(afterSecond.log[afterSecond.log.length - 1]).toMatchObject({ type: "AUTO_END_TURN" });
  });

  it("rejects third action in round 2", () => {
    const base = { ...createGame(["A", "B"], "round2-third-action"), round: 2, actionsTakenThisTurn: 2 };
    const target = findEdgeOrThrow(base, (edge) => edge.kind === "both" || edge.kind === "canal", "canal/both");
    const [from, to] = target.nodes;
    expectInvalid(
      reduce(base, { type: "BUILD_LINK", player: "A", from, to }),
      base,
      "TURN_ACTION_LIMIT_REACHED",
    );
  });

  it("builds a legal canal link and appends a log event", () => {
    const state = { ...createGame(["A", "B"], "build-link-success"), round: 2 };
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "both" || edge.kind === "canal", "canal/both");
    const [from, to] = target.nodes;

    const next = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));
    const edgeIndex = next.board.topology.edges.findIndex((edge) => {
      const [edgeA, edgeB] = edge.nodes;
      return (edgeA === from && edgeB === to) || (edgeA === to && edgeB === from);
    });

    expect(next.board.linkStates[edgeIndex].builtBy).toBe("A");
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { player: "A", from, to, era: "canal" },
    });
  });

  it("rejects BUILD_LINK from the wrong player", () => {
    const state = createGame(["A", "B"], "wrong-player");
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "both" || edge.kind === "canal", "canal/both");
    const [from, to] = target.nodes;

    const next = expectInvalid(
      reduce(state, { type: "BUILD_LINK", player: "B", from, to }),
      state,
      "NOT_CURRENT_PLAYER",
    );
    expect(next.turn).toBe(state.turn);
  });

  it("rejects BUILD_LINK on rail-only edge during canal phase", () => {
    const state = createGame(["A", "B"], "rail-edge-canal-phase");
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail", "rail");
    const [from, to] = target.nodes;

    const next = expectInvalid(
      reduce(state, { type: "BUILD_LINK", player: "A", from, to }),
      state,
      "ILLEGAL_LINK_FOR_PHASE",
    );
    expect(next.board).toBe(state.board);
  });

  it("consumes connected coal tile when building a rail link", () => {
    const base = { ...createGame(["A", "B"], "rail-coal-tile"), phase: "rail" as const, round: 2 };
    const state = withTiles(base, {
      "tile-coal-nuneaton": makeTile("tile-coal-nuneaton", {
        city: "Nuneaton",
        industry: "coal",
        resourcesRemaining: 2,
        incomeOnFlip: 2,
      }),
    });
    const target = findEdgeOrThrow(
      state,
      (edge) => edge.kind !== "canal" && edge.nodes.includes("Nuneaton"),
      "rail-eligible edge touching Nuneaton",
    );
    const [from, to] = target.nodes;

    const next = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));
    expect(next.board.tiles["tile-coal-nuneaton"].resourcesRemaining).toBe(1);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { coalSource: "tile", coalSpend: 0 },
    });
  });

  it("uses coal market when no connected coal tile is available", () => {
    const state = { ...createGame(["A", "B"], "rail-coal-market"), phase: "rail" as const, round: 2 };
    const marketPrice = coalMarketPrice(state.market.coal.units);
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail" || edge.kind === "both", "rail");
    const [from, to] = target.nodes;

    const next = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));
    expect(next.players.A.money).toBe(state.players.A.money - marketPrice);
    expect(next.market.coal.units).toBe(state.market.coal.units - 1);
  });

  it("uses fallback coal price when market is empty", () => {
    const base = { ...createGame(["A", "B"], "rail-coal-fallback"), phase: "rail" as const, round: 2 };
    const state = {
      ...base,
      market: {
        ...base.market,
        coal: { ...base.market.coal, units: 0 },
      },
    };
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail" || edge.kind === "both", "rail");
    const [from, to] = target.nodes;

    const next = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));
    expect(next.players.A.money).toBe(state.players.A.money - state.market.coal.fallbackPrice);
  });

  it("rejects rail build when no coal source is affordable", () => {
    const base = { ...createGame(["A", "B"], "rail-coal-insufficient"), phase: "rail" as const, round: 2 };
    const state = {
      ...base,
      market: {
        ...base.market,
        coal: { ...base.market.coal, units: 0 },
      },
      players: {
        ...base.players,
        A: { ...base.players.A, money: base.market.coal.fallbackPrice - 1 },
      },
    };
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail" || edge.kind === "both", "rail");
    const [from, to] = target.nodes;

    expectInvalid(
      reduce(state, { type: "BUILD_LINK", player: "A", from, to }),
      state,
      "INSUFFICIENT_RESOURCES",
    );
  });

  it("awards income to owner when opponent consumes last coal cube", () => {
    const base = createGame(["A", "B"], "flip-opponent");
    const state = {
      ...withTiles(base, {
        "tile-coal-nuneaton": makeTile("tile-coal-nuneaton", {
          city: "Nuneaton",
          industry: "coal",
          owner: "A",
          resourcesRemaining: 1,
          incomeOnFlip: 3,
        }),
      }),
      phase: "rail" as const,
      round: 2,
      currentPlayer: "B",
    };
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "rail" && edge.nodes.includes("Nuneaton"), "rail");
    const [from, to] = target.nodes;

    const next = expectOk(reduce(state, { type: "BUILD_LINK", player: "B", from, to }));
    expect(next.players.A.income).toBe(state.players.A.income + 3);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: {
        flippedTiles: ["tile-coal-nuneaton"],
        incomeAwards: [{ tileId: "tile-coal-nuneaton", player: "A", amount: 3 }],
      },
    });
  });

  it("rejects already-built links", () => {
    const state = { ...createGame(["A", "B"], "duplicate-build"), round: 2 };
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "both" || edge.kind === "canal", "canal/both");
    const [from, to] = target.nodes;
    const built = expectOk(reduce(state, { type: "BUILD_LINK", player: "A", from, to }));

    const duplicate = expectInvalid(
      reduce(built, { type: "BUILD_LINK", player: "A", from, to }),
      built,
      "ILLEGAL_LINK_FOR_PHASE",
    );
    expect(duplicate.board).toBe(built.board);
  });

  it("accepts reversed from/to order", () => {
    const state = { ...createGame(["A", "B"], "reverse-order"), round: 2 };
    const target = findEdgeOrThrow(state, (edge) => edge.kind === "both" || edge.kind === "canal", "canal/both");
    const [from, to] = target.nodes;

    const next = expectOk(
      reduce(state, { type: "BUILD_LINK", player: "A", from: to, to: from }),
    );
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "BUILD_LINK",
      data: { from: to, to: from },
    });
  });

  it("rejects missing edges", () => {
    const state = createGame(["A", "B"], "missing-edge");
    expectInvalid(
      reduce(state, { type: "BUILD_LINK", player: "A", from: "Birmingham", to: "Gloucester" }),
      state,
      "ILLEGAL_LINK_FOR_PHASE",
    );
  });

  it("keeps tile flip/resource states consistent after link resolution", () => {
    const base = { ...createGame(["A", "B"], "invariant-flip-state"), phase: "rail" as const };
    const withTile = withTiles(base, {
      "tile-coal-nuneaton": makeTile("tile-coal-nuneaton", {
        city: "Nuneaton",
        industry: "coal",
        owner: "A",
        resourcesRemaining: 1,
      }),
    });

    const result = reduce(withTile, {
      type: "BUILD_LINK",
      player: "A",
      from: "Coventry",
      to: "Nuneaton",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const tile of Object.values(result.state.board.tiles)) {
      if (tile.resourcesRemaining === 0) {
        expect(tile.flipped).toBe(true);
      }
      if (tile.resourcesRemaining > 0) {
        expect(tile.flipped).toBe(false);
      }
    }
  });

  it("preserves no-flipped-with-resources invariant errors", () => {
    const state = withTiles(createGame(["A", "B"], "bad-invariant-2"), {
      "tile-bad": makeTile("tile-bad", {
        city: "Stafford",
        industry: "coal",
        resourcesRemaining: 1,
        flipped: true,
      }),
    });
    expectInvalid(
      reduce(state, { type: "END_TURN", player: "A" }),
      state,
      "INVALID_TILE_FLIP_STATE",
    );
  });
});

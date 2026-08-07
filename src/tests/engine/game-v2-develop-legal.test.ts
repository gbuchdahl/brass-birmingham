import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import type { DevelopActionSelection } from "@/engine/actions-v2/develop";
import type { PlayableCardId } from "@/engine/cards-v2/types";
import { executeDevelopForGameV2 } from "@/engine/game-v2/action-adapters";
import {
  executeGameV2Command,
  type GameV2CommandResult,
} from "@/engine/game-v2/commands";
import { getGameV2DevelopLegalOptions } from "@/engine/game-v2/develop-legal";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import type { IndustryTileKind } from "@/engine/rules/generated/industry-tiles-v2";

function requireValid(state: GameStateV2): GameStateV2 {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) =>
      `${error.path}: ${error.message}`
    ).join("\n"));
  }
  return state;
}

function advanceIndustryInventory(
  state: GameStateV2,
  seat: string,
  industry: IndustryTileKind,
  targetTileId: string,
): GameStateV2 {
  const player = state.players[seat];
  const stack = player.industryInventory.stacks[industry];
  const targetIndex = stack.indexOf(targetTileId as typeof stack[number]);
  if (targetIndex < 0) {
    throw new Error(`${targetTileId} is not in ${seat}'s ${industry} stack`);
  }
  return requireValid({
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            [industry]: stack.slice(targetIndex),
          },
        },
        removedIndustryTileIds: [
          ...player.removedIndustryTileIds,
          ...stack.slice(0, targetIndex),
        ],
      },
    },
  });
}

function placeTopIron(
  state: GameStateV2,
  owner: string,
  buildSpaceId: string,
  locationId: string,
  cubes: number,
): GameStateV2 {
  const player = state.players[owner];
  const stack = player.industryInventory.stacks.iron;
  const tileId = stack[0];
  if (tileId === undefined) throw new Error(`No iron tile for ${owner}`);
  const placement: PlacedIndustryStateV2 = {
    owner,
    tileId,
    locationId,
    spaceId: buildSpaceId,
    resources: { coal: 0, iron: cubes, beer: 0 },
    flipped: cubes === 0,
  };
  return requireValid({
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            iron: stack.slice(1),
          },
        },
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        [buildSpaceId]: placement,
      },
    },
  });
}

function expectCommandSuccess(
  result: GameV2CommandResult,
): Extract<GameV2CommandResult, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function firstCard(state: GameStateV2): PlayableCardId {
  const cardId = state.cards.hands[state.currentSeat][0];
  if (cardId === undefined) throw new Error("Expected an action card");
  return cardId;
}

function plansForTiles(
  plans: ReturnType<typeof getGameV2DevelopLegalOptions>["plans"],
  tileIds: readonly string[],
) {
  return plans.filter((plan) =>
    JSON.stringify(plan.selection.tileIds) === JSON.stringify(tileIds)
  );
}

describe("exact GameStateV2 Develop selector", () => {
  it("enumerates exact one- and two-tile market plans without protected pottery", () => {
    const state = createGameV2(["alice", "bob"], "develop-legal-initial");
    const cardId = firstCard(state);
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);

    expect(options).toMatchObject({
      availability: "exact",
      actorSeat: "alice",
      cardId,
      reason: null,
    });
    expect(options.plans.some((plan) => plan.tiles.length === 1)).toBe(true);
    expect(options.plans.some((plan) => plan.tiles.length === 2)).toBe(true);
    expect(options.plans.every((plan) =>
      plan.tiles.every((tile) => tile.industry !== "pottery")
    )).toBe(true);

    const one = plansForTiles(options.plans, ["manufacturer-1-a"]);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({
      tiles: [{
        id: "manufacturer-1-a",
        industry: "manufacturer",
        faceId: "manufacturer-1",
        level: 1,
      }],
      iron: {
        requiredUnits: 1,
        boardSources: [],
        market: { unitsPurchased: 1, unitPrices: [2], totalCost: 2 },
      },
      moneySpent: 2,
      outcome: { moneyAfter: 15, marketIronUnitsAfter: 7 },
    });

    const two = plansForTiles(options.plans, [
      "manufacturer-1-a",
      "cotton-1-a",
    ]);
    expect(two).toHaveLength(1);
    expect(two[0]).toMatchObject({
      iron: {
        requiredUnits: 2,
        boardSources: [],
        market: { unitsPurchased: 2, unitPrices: [2, 2], totalCost: 4 },
      },
      moneySpent: 4,
      outcome: { moneyAfter: 13, marketIronUnitsAfter: 6 },
    });
  });

  it("preserves authoritative top-tile, sequential-copy, and pottery protection rules", () => {
    let state = createGameV2(["alice", "bob"], "develop-legal-ordering");
    state = advanceIndustryInventory(
      state,
      "alice",
      "manufacturer",
      "manufacturer-2-a",
    );
    state = advanceIndustryInventory(
      state,
      "alice",
      "pottery",
      "pottery-2-a",
    );
    const cardId = firstCard(state);
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);

    expect(plansForTiles(options.plans, ["manufacturer-2-a"])).toHaveLength(1);
    expect(plansForTiles(options.plans, [
      "manufacturer-2-a",
      "manufacturer-2-b",
    ])).toHaveLength(1);
    expect(plansForTiles(options.plans, [
      "manufacturer-2-b",
      "manufacturer-2-a",
    ])).toHaveLength(0);
    expect(plansForTiles(options.plans, ["pottery-2-a"])).toHaveLength(1);
    expect(options.plans.some((plan) =>
      plan.selection.tileIds.includes("pottery-3-a")
    )).toBe(false);
  });

  it("uses board iron before market and projects exact one-source consumption", () => {
    let state = createGameV2(["alice", "bob"], "develop-legal-board-iron");
    state = placeTopIron(
      state,
      "bob",
      "birmingham_3",
      "birmingham",
      2,
    );
    const cardId = firstCard(state);
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);
    const one = plansForTiles(options.plans, ["manufacturer-1-a"]);
    const two = plansForTiles(options.plans, [
      "manufacturer-1-a",
      "cotton-1-a",
    ]);

    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({
      selection: {
        accessibleIronIndustryIds: ["birmingham_3"],
        purchaseMarketShortfall: false,
      },
      iron: {
        boardSources: [{
          buildSpaceId: "birmingham_3",
          locationId: "birmingham",
          locationLabel: "Birmingham",
          owner: "bob",
          cubesBefore: 2,
          unitsConsumed: 1,
          cubesRemaining: 1,
          depleted: false,
        }],
        market: { unitsPurchased: 0, unitPrices: [], totalCost: 0 },
      },
      moneySpent: 0,
      outcome: { moneyAfter: 17, marketIronUnitsAfter: 8 },
    });
    expect(two).toHaveLength(1);
    expect(two[0]).toMatchObject({
      iron: {
        boardSources: [{
          buildSpaceId: "birmingham_3",
          unitsConsumed: 2,
          cubesRemaining: 0,
          depleted: true,
        }],
        market: { unitsPurchased: 0, totalCost: 0 },
      },
      outcome: { flippedProviderSpaceIds: ["birmingham_3"] },
    });
    expect(options.plans.every((plan) =>
      plan.iron.market.unitsPurchased === 0
    )).toBe(true);
  });

  it("handles a board-plus-market shortfall with exact pricing and affordability", () => {
    let state = createGameV2(["alice", "bob"], "develop-legal-shortfall");
    state = placeTopIron(
      state,
      "bob",
      "birmingham_3",
      "birmingham",
      1,
    );
    const cardId = firstCard(state);
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);
    const two = plansForTiles(options.plans, [
      "manufacturer-1-a",
      "cotton-1-a",
    ]);
    expect(two).toHaveLength(1);
    expect(two[0]).toMatchObject({
      selection: {
        accessibleIronIndustryIds: ["birmingham_3"],
        purchaseMarketShortfall: true,
      },
      iron: {
        boardSources: [{
          buildSpaceId: "birmingham_3",
          unitsConsumed: 1,
          depleted: true,
        }],
        market: { unitsPurchased: 1, unitPrices: [2], totalCost: 2 },
      },
      moneySpent: 2,
      outcome: {
        moneyAfter: 15,
        marketIronUnitsAfter: 7,
        flippedProviderSpaceIds: ["birmingham_3"],
      },
    });

    const marketOnly = createGameV2(
      ["alice", "bob"],
      "develop-legal-affordability",
    );
    const selected = firstCard(marketOnly);
    const onePound = requireValid({
      ...marketOnly,
      players: {
        ...marketOnly.players,
        alice: { ...marketOnly.players.alice, money: 1 },
      },
    });
    expect(
      getGameV2DevelopLegalOptions(onePound, "alice", selected),
    ).toMatchObject({
      availability: "disabled",
      plans: [],
      reason: { code: "NO_LEGAL_DEVELOP" },
    });

    const twoPounds = requireValid({
      ...marketOnly,
      players: {
        ...marketOnly.players,
        alice: { ...marketOnly.players.alice, money: 2 },
      },
    });
    const affordable = getGameV2DevelopLegalOptions(
      twoPounds,
      "alice",
      selected,
    );
    expect(affordable.availability).toBe("exact");
    expect(affordable.plans.length).toBeGreaterThan(0);
    expect(affordable.plans.every((plan) => plan.tiles.length === 1)).toBe(true);
  });

  it("keeps materially distinct split-source outcomes and collapses equivalent order", () => {
    let state = createGameV2(["alice", "bob"], "develop-legal-split-iron");
    state = placeTopIron(state, "alice", "derby_3", "derby", 1);
    state = placeTopIron(
      state,
      "bob",
      "birmingham_3",
      "birmingham",
      1,
    );
    const cardId = firstCard(state);
    const tileIds = ["manufacturer-1-a", "cotton-1-a"] as const;
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);
    const plans = plansForTiles(options.plans, tileIds);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      selection: {
        accessibleIronIndustryIds: ["derby_3", "birmingham_3"],
        purchaseMarketShortfall: false,
      },
      iron: {
        boardSources: [
          { buildSpaceId: "derby_3", unitsConsumed: 1, depleted: true },
          { buildSpaceId: "birmingham_3", unitsConsumed: 1, depleted: true },
        ],
      },
    });

    const canonical = executeDevelopForGameV2(state, plans[0].selection);
    const reverseSelection: DevelopActionSelection = {
      ...plans[0].selection,
      accessibleIronIndustryIds: ["birmingham_3", "derby_3"],
    };
    const reverse = executeDevelopForGameV2(state, reverseSelection);
    expect(canonical.ok).toBe(true);
    expect(reverse.ok).toBe(true);
    if (!canonical.ok || !reverse.ok) throw new Error("Expected split iron plans");
    expect(reverse.state).toEqual(canonical.state);
  });

  it("emits only command-reducer-accepted plans with matching outcomes", () => {
    const state = createGameV2(["alice", "bob"], "develop-legal-commands");
    const cardId = firstCard(state);
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);
    expect(options.plans.length).toBeGreaterThan(10);

    for (const [index, plan] of options.plans.entries()) {
      const accepted = expectCommandSuccess(executeGameV2Command(state, {
        schemaVersion: 1,
        commandId: `develop-${index}`,
        gameId: state.gameId,
        expectedRevision: state.revision,
        actorSeat: "alice",
        command: { type: "DEVELOP", selection: plan.selection },
      }));
      expect(accepted.outcome).toMatchObject({
        kind: "player_action",
        actionType: "DEVELOP",
        effect: {
          removedTileIds: plan.outcome.removedTileIds,
          moneySpent: plan.moneySpent,
          iron: {
            requiredUnits: plan.iron.requiredUnits,
            market: plan.iron.market,
          },
        },
      });
    }
  });

  it("fails closed for invalid state, phase, actor, card, and action budget", () => {
    const state = createGameV2(["alice", "bob"], "develop-legal-disabled");
    const cardId = firstCard(state);
    expect(getGameV2DevelopLegalOptions(state, "alice", null)).toMatchObject({
      availability: "disabled",
      reason: { code: "CARD_REQUIRED" },
    });
    expect(
      getGameV2DevelopLegalOptions(state, "alice", state.cards.hands.bob[0]),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "CARD_NOT_IN_HAND" },
    });
    expect(
      getGameV2DevelopLegalOptions(state, "bob", state.cards.hands.bob[0]),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_CURRENT_ACTOR" },
    });
    expect(
      getGameV2DevelopLegalOptions(state, null, cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "ACTOR_REQUIRED" },
    });
    expect(
      getGameV2DevelopLegalOptions(state, "carol", cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "UNKNOWN_ACTOR" },
    });

    const exhausted = requireValid({
      ...state,
      actionsUsed: state.actionLimit,
    });
    expect(
      getGameV2DevelopLegalOptions(exhausted, "alice", cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "ACTION_LIMIT_REACHED" },
    });
    const invalid = { ...state, revision: -1 } as GameStateV2;
    expect(
      getGameV2DevelopLegalOptions(invalid, "alice", cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_GAME_STATE" },
    });

    let boundary = state;
    for (const commandId of ["disabled-pass-alice", "disabled-pass-bob"]) {
      const seat = boundary.currentSeat;
      const accepted = expectCommandSuccess(executeGameV2Command(boundary, {
        schemaVersion: 1,
        commandId,
        gameId: boundary.gameId,
        expectedRevision: boundary.revision,
        actorSeat: seat,
        command: { type: "PASS", cardId: boundary.cards.hands[seat][0] },
      }));
      boundary = accepted.state;
    }
    expect(boundary.progress.phase).toBe("round_settlement");
    expect(
      getGameV2DevelopLegalOptions(
        boundary,
        boundary.currentSeat,
        firstCard(boundary),
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_ACTION_PHASE" },
    });
  });

  it("is deterministic and immutable", () => {
    let state = createGameV2(["alice", "bob"], "develop-legal-purity");
    state = placeTopIron(state, "bob", "birmingham_3", "birmingham", 2);
    const cardId = firstCard(state);
    const snapshot = structuredClone(state);
    const first = getGameV2DevelopLegalOptions(state, "alice", cardId);
    const second = getGameV2DevelopLegalOptions(state, "alice", cardId);
    expect(first).toEqual(second);
    expect(state).toEqual(snapshot);
  });

  it("keeps dense-board enumeration bounded", () => {
    let state = createGameV2(
      ["alice", "bob", "carol", "dave"],
      "develop-legal-dense-board",
    );
    const spaces = [
      ["derby_3", "derby"],
      ["stoke_on_trent_2", "stoke_on_trent"],
      ["walsall_1", "walsall"],
      ["coalbrookdale_1", "coalbrookdale"],
      ["coalbrookdale_2", "coalbrookdale"],
      ["dudley_2", "dudley"],
      ["birmingham_3", "birmingham"],
      ["coventry_3", "coventry"],
      ["redditch_2", "redditch"],
    ] as const;
    const seats = state.turnOrder;
    for (const [index, [buildSpaceId, locationId]] of spaces.entries()) {
      state = placeTopIron(
        state,
        seats[index % seats.length],
        buildSpaceId,
        locationId,
        1,
      );
    }
    const cardId = firstCard(state);
    const snapshot = structuredClone(state);
    const startedAt = performance.now();
    const options = getGameV2DevelopLegalOptions(state, "alice", cardId);
    const elapsedMs = performance.now() - startedAt;

    expect(options.availability).toBe("exact");
    expect(options.plans.length).toBeGreaterThan(500);
    expect(elapsedMs).toBeLessThan(1_500);
    expect(state).toEqual(snapshot);
  });
});

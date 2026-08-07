import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { discardActionCard } from "@/engine/cards-v2/zones";
import { highestSpaceForIncomeLevel } from "@/engine/economy/income";
import { getGameV2LiquidationLegalOptions } from "@/engine/game-v2/liquidation-legal";
import {
  applyAcceptedActionV2,
  resolveCompletedRoundV2,
  type LiquidationChoicesV2,
} from "@/engine/game-v2/turn-lifecycle";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileKind,
} from "@/engine/rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";

function requireValid(state: GameStateV2): GameStateV2 {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) =>
      `${error.path}: ${error.message}`
    ).join("\n"));
  }
  return state;
}

function requireAccepted(
  result: ReturnType<typeof applyAcceptedActionV2>,
): Extract<ReturnType<typeof applyAcceptedActionV2>, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function requireSettled(
  result: ReturnType<typeof resolveCompletedRoundV2>,
): Extract<ReturnType<typeof resolveCompletedRoundV2>, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function playAcceptedAction(state: GameStateV2): GameStateV2 {
  const seat = state.currentSeat;
  const cardId = state.cards.hands[seat][0];
  const afterCard: GameStateV2 = {
    ...state,
    cards: discardActionCard(state.cards, seat, cardId),
  };
  return requireAccepted(applyAcceptedActionV2(afterCard, {
    type: "PASSED",
    actionsConsumed: 1,
    moneySpent: 0,
  })).state;
}

function completeRound(initial: GameStateV2): GameStateV2 {
  let state = initial;
  while (state.progress.phase !== "round_settlement") {
    state = playAcceptedAction(state);
  }
  return state;
}

function withIncome(
  state: GameStateV2,
  seat: string,
  incomeLevel: number,
  money = state.players[seat].money,
  victoryPoints = state.players[seat].victoryPoints,
): GameStateV2 {
  return requireValid({
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...state.players[seat],
        money,
        incomeMarkerSpace: highestSpaceForIncomeLevel(incomeLevel),
        victoryPoints,
      },
    },
  });
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
  if (targetIndex < 0) throw new Error(`Missing ${targetTileId} for ${seat}`);
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

function placeTopIndustry(
  state: GameStateV2,
  owner: string,
  buildSpaceId: string,
  locationId: string,
  industry: IndustryTileKind,
): GameStateV2 {
  const player = state.players[owner];
  const stack = player.industryInventory.stacks[industry];
  const tileId = stack[0];
  if (tileId === undefined) throw new Error(`No ${industry} tile for ${owner}`);
  const productive = industry === "coal" || industry === "iron" ||
    industry === "brewery";
  const placement: PlacedIndustryStateV2 = {
    owner,
    tileId,
    locationId,
    spaceId: buildSpaceId,
    resources: { coal: 0, iron: 0, beer: 0 },
    flipped: productive,
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
            [industry]: stack.slice(1),
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

function withFinalRoundCards(state: GameStateV2): GameStateV2 {
  const regularCards = [
    ...state.turnOrder.flatMap((seat) => state.cards.hands[seat]),
    ...state.cards.draw,
    ...state.cards.discard,
  ].filter((cardId) => !cardId.startsWith("wild-"));
  const cardsNeeded = state.turnOrder.length * state.actionLimit;
  return requireValid({
    ...state,
    cards: {
      hands: Object.fromEntries(state.turnOrder.map((seat, seatIndex) => [
        seat,
        regularCards.slice(
          seatIndex * state.actionLimit,
          (seatIndex + 1) * state.actionLimit,
        ),
      ])) as GameStateV2["cards"]["hands"],
      draw: [],
      discard: regularCards.slice(cardsNeeded) as GameStateV2["cards"]["discard"],
      wildSupplies: { ...state.cards.wildSupplies },
    },
  });
}

function progressFor(
  options: ReturnType<typeof getGameV2LiquidationLegalOptions>,
  seat: string,
) {
  const progress = options.seats.find((candidate) => candidate.seat === seat);
  if (!progress) throw new Error(`Missing liquidation progress for ${seat}`);
  return progress;
}

describe("progressive GameStateV2 liquidation selector", () => {
  it("requires explicit [] when negative income is covered by cash", () => {
    let state = createGameV2(["alice", "bob"], "liquidation-covered-cash");
    state = withIncome(state, "alice", -3, 17, 4);
    const boundary = completeRound(state);

    const missing = getGameV2LiquidationLegalOptions(boundary, {});
    expect(missing).toMatchObject({
      availability: "exact",
      requiredSeats: ["alice"],
      ready: false,
      liquidationChoices: null,
      authority: null,
    });
    expect(progressFor(missing, "alice")).toMatchObject({
      incomeLevel: -3,
      requiredPayment: 3,
      cashBefore: 17,
      cashApplied: 3,
      initialShortfall: 0,
      selectedAssets: [],
      liquidationProceeds: 0,
      remainingShortfall: 0,
      coverage: "covered_by_cash",
      acknowledged: false,
      ready: false,
      nextChoices: [],
      preview: {
        moneyAfter: 14,
        victoryPointsBefore: 4,
        victoryPointsLost: 0,
        victoryPointsAfter: 4,
        unpaidShortfall: 0,
      },
    });

    const ready = getGameV2LiquidationLegalOptions(boundary, { alice: [] });
    expect(ready).toMatchObject({
      availability: "exact",
      ready: true,
      liquidationChoices: { alice: [] },
      reason: null,
      authority: {
        settlements: {
          alice: {
            requiredPayment: 3,
            money: 14,
            victoryPoints: 4,
          },
        },
      },
    });
    expect(progressFor(ready, "alice").authoritativeSettlement).toMatchObject({
      requiredPayment: 3,
      money: 14,
      removedIndustryIds: [],
    });
    expect(ready.authority?.settlements).toEqual(
      requireSettled(resolveCompletedRoundV2(boundary, { alice: [] })).settlements,
    );
  });

  it("returns {} immediately when no seat has negative income", () => {
    const boundary = completeRound(
      createGameV2(["alice", "bob"], "liquidation-none"),
    );
    const options = getGameV2LiquidationLegalOptions(boundary, {});
    expect(options).toMatchObject({
      availability: "exact",
      requiredSeats: [],
      seats: [],
      ready: true,
      liquidationChoices: {},
      reason: null,
    });
    expect(options.authority?.settlements).toEqual(
      requireSettled(resolveCompletedRoundV2(boundary, {})).settlements,
    );
  });

  it("exposes only deterministic one-step positive-value asset branches", () => {
    let state = createGameV2(["alice", "bob"], "liquidation-progressive");
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_1",
      "birmingham",
      "cotton",
    );
    state = withIncome(state, "alice", -10, 0, 5);
    const boundary = completeRound(state);

    const initial = getGameV2LiquidationLegalOptions(boundary, { alice: [] });
    const alice = progressFor(initial, "alice");
    expect(initial.ready).toBe(false);
    expect(alice).toMatchObject({
      requiredPayment: 10,
      cashBefore: 0,
      initialShortfall: 10,
      coverage: "shortfall",
      acknowledged: true,
      ready: false,
      nextChoices: [
        {
          buildSpaceId: "birmingham_1",
          locationId: "birmingham",
          locationLabel: "Birmingham",
          tileId: "cotton-1-a",
          industry: "cotton",
          faceId: "cotton-1",
          level: 1,
          buildCost: 12,
          liquidationValue: 6,
          choicesAfterAppend: ["birmingham_1"],
          liquidationProceedsAfterAppend: 6,
          remainingShortfallAfterAppend: 4,
          coverageAfterAppend: "shortfall",
        },
        {
          buildSpaceId: "birmingham_2",
          tileId: "manufacturer-1-a",
          buildCost: 8,
          liquidationValue: 4,
          choicesAfterAppend: ["birmingham_2"],
          liquidationProceedsAfterAppend: 4,
          remainingShortfallAfterAppend: 6,
          coverageAfterAppend: "shortfall",
        },
      ],
    });

    const afterOne = getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_2"],
    });
    expect(progressFor(afterOne, "alice")).toMatchObject({
      selectedAssets: [{ buildSpaceId: "birmingham_2", liquidationValue: 4 }],
      liquidationProceeds: 4,
      remainingShortfall: 6,
      coverage: "shortfall",
      ready: false,
      nextChoices: [{
        buildSpaceId: "birmingham_1",
        choicesAfterAppend: ["birmingham_2", "birmingham_1"],
        coverageAfterAppend: "covered_by_liquidation",
      }],
    });

    const complete = getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_2", "birmingham_1"],
    });
    expect(complete).toMatchObject({
      ready: true,
      liquidationChoices: {
        alice: ["birmingham_2", "birmingham_1"],
      },
    });
    expect(progressFor(complete, "alice")).toMatchObject({
      liquidationProceeds: 10,
      remainingShortfall: 0,
      coverage: "covered_by_liquidation",
      nextChoices: [],
      preview: {
        moneyAfter: 0,
        victoryPointsLost: 0,
        victoryPointsAfter: 5,
      },
      authoritativeSettlement: {
        liquidationProceeds: 10,
        removedIndustryIds: ["birmingham_2", "birmingham_1"],
      },
    });
  });

  it("stops immediately after overpayment covers the shortfall", () => {
    let state = createGameV2(["alice", "bob"], "liquidation-overpayment");
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_1",
      "birmingham",
      "cotton",
    );
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = withIncome(state, "alice", -5, 0, 5);
    const boundary = completeRound(state);

    const covered = getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_1"],
    });
    expect(covered.ready).toBe(true);
    expect(progressFor(covered, "alice")).toMatchObject({
      liquidationProceeds: 6,
      coverage: "covered_by_liquidation",
      nextChoices: [],
      preview: { moneyAfter: 1, victoryPointsLost: 0 },
    });

    expect(getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_1", "birmingham_2"],
    })).toMatchObject({
      availability: "disabled",
      reason: {
        code: "LIQUIDATION_PAST_COVERAGE",
        seat: "alice",
        industryId: "birmingham_2",
      },
    });
  });

  it("becomes ready when assets are exhausted and previews VP loss", () => {
    let state = createGameV2(["alice", "bob"], "liquidation-vp-loss");
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_1",
      "birmingham",
      "manufacturer",
    );
    state = withIncome(state, "alice", -10, 0, 3);
    const boundary = completeRound(state);
    const options = getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_1"],
    });

    expect(options.ready).toBe(true);
    expect(progressFor(options, "alice")).toMatchObject({
      liquidationProceeds: 4,
      remainingShortfall: 6,
      coverage: "assets_exhausted",
      exhausted: true,
      ready: true,
      nextChoices: [],
      preview: {
        moneyAfter: 0,
        victoryPointsBefore: 3,
        victoryPointsLost: 3,
        victoryPointsAfter: 0,
        unpaidShortfall: 3,
      },
      authoritativeSettlement: {
        liquidationProceeds: 4,
        victoryPointsLost: 3,
        unpaidShortfall: 3,
      },
    });
  });

  it("tracks multiple negative-income seats independently", () => {
    let state = createGameV2(
      ["alice", "bob", "carol"],
      "liquidation-multi-seat",
    );
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = placeTopIndustry(
      state,
      "bob",
      "birmingham_1",
      "birmingham",
      "cotton",
    );
    state = withIncome(state, "alice", -5, 0, 5);
    state = withIncome(state, "bob", -6, 0, 5);
    const boundary = completeRound(state);

    const partial = getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_2"],
    });
    expect(partial.requiredSeats).toEqual(["alice", "bob"]);
    expect(partial.ready).toBe(false);
    expect(progressFor(partial, "alice")).toMatchObject({
      coverage: "assets_exhausted",
      acknowledged: true,
      ready: true,
      preview: { victoryPointsLost: 1 },
    });
    expect(progressFor(partial, "bob")).toMatchObject({
      acknowledged: false,
      ready: false,
      nextChoices: [{ buildSpaceId: "birmingham_1" }],
    });
    expect(progressFor(partial, "bob").nextChoices.every(
      (choice) => choice.buildSpaceId !== "birmingham_2",
    )).toBe(true);

    const completeChoices = {
      alice: ["birmingham_2"],
      bob: ["birmingham_1"],
    } as const;
    const complete = getGameV2LiquidationLegalOptions(
      boundary,
      completeChoices,
    );
    expect(complete).toMatchObject({
      ready: true,
      liquidationChoices: completeChoices,
      authority: {
        settlements: {
          alice: { victoryPointsLost: 1 },
          bob: { victoryPointsLost: 0, liquidationProceeds: 6 },
        },
      },
    });
    expect(complete.authority?.settlements).toEqual(
      requireSettled(resolveCompletedRoundV2(boundary, completeChoices)).settlements,
    );
  });

  it("rejects duplicate, foreign, zero-value, and nonnegative-seat prefixes", () => {
    let state = createGameV2(["alice", "bob"], "liquidation-prefix-errors");
    state = placeTopIndustry(
      state,
      "alice",
      "birmingham_1",
      "birmingham",
      "manufacturer",
    );
    state = placeTopIndustry(
      state,
      "bob",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = withIncome(state, "alice", -10, 0, 5);
    const boundary = completeRound(state);

    expect(getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_1", "birmingham_1"],
    })).toMatchObject({
      availability: "disabled",
      reason: { code: "DUPLICATE_INDUSTRY", industryId: "birmingham_1" },
    });
    expect(getGameV2LiquidationLegalOptions(boundary, {
      alice: ["birmingham_2"],
    })).toMatchObject({
      availability: "disabled",
      reason: {
        code: "INDUSTRY_NOT_OWNED",
        seat: "alice",
        industryId: "birmingham_2",
      },
    });
    expect(getGameV2LiquidationLegalOptions(boundary, {
      alice: [],
      bob: [],
    })).toMatchObject({
      availability: "disabled",
      reason: { code: "NON_NEGATIVE_SEAT", seat: "bob" },
    });

    let zero = createGameV2(["alice", "bob"], "liquidation-zero-value");
    zero = advanceIndustryInventory(zero, "alice", "pottery", "pottery-2-a");
    zero = placeTopIndustry(
      zero,
      "alice",
      "stafford_2",
      "stafford",
      "pottery",
    );
    zero = withIncome(zero, "alice", -5, 0, 5);
    const zeroBoundary = completeRound(zero);
    expect(getGameV2LiquidationLegalOptions(zeroBoundary, {
      alice: ["stafford_2"],
    })).toMatchObject({
      availability: "disabled",
      reason: {
        code: "ZERO_VALUE_INDUSTRY",
        seat: "alice",
        industryId: "stafford_2",
      },
    });
    const exhausted = getGameV2LiquidationLegalOptions(zeroBoundary, {
      alice: [],
    });
    expect(progressFor(exhausted, "alice")).toMatchObject({
      coverage: "assets_exhausted",
      ready: true,
      nextChoices: [],
    });
  });

  it("requires exactly {} and skips all liquidation in final Rail", () => {
    const finalRound = SETUP_DATA.playerCounts[2].roundsPerEra;
    let state = createGameV2(["alice", "bob"], "liquidation-final-rail");
    state = requireValid({
      ...state,
      era: "rail",
      round: finalRound,
      actionLimit: 2,
    });
    state = withIncome(state, "alice", -5, 0, 7);
    state = withFinalRoundCards(state);
    const boundary = completeRound(state);

    const skipped = getGameV2LiquidationLegalOptions(boundary, {});
    expect(skipped).toMatchObject({
      availability: "exact",
      finalRailIncomeSkipped: true,
      requiredSeats: [],
      seats: [],
      ready: true,
      liquidationChoices: {},
      authority: {
        eraComplete: true,
        settlements: {
          alice: {
            incomeLevel: -5,
            skipped: true,
            money: 0,
            victoryPoints: 7,
            removedIndustryIds: [],
          },
        },
      },
    });
    expect(getGameV2LiquidationLegalOptions(boundary, { alice: [] }))
      .toMatchObject({
        availability: "disabled",
        reason: {
          code: "FINAL_RAIL_CHOICES_NOT_ALLOWED",
          seat: "alice",
        },
      });
  });

  it("fails closed outside settlement and for invalid state or payload", () => {
    const state = createGameV2(["alice", "bob"], "liquidation-fail-closed");
    expect(getGameV2LiquidationLegalOptions(state, {})).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_ROUND_SETTLEMENT" },
    });
    const invalid = { ...state, revision: -1 } as GameStateV2;
    expect(getGameV2LiquidationLegalOptions(invalid, {})).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_GAME_STATE" },
    });

    const boundary = completeRound(withIncome(state, "alice", -2));
    expect(getGameV2LiquidationLegalOptions(
      boundary,
      null as unknown as LiquidationChoicesV2,
    )).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_LIQUIDATION_CHOICES" },
    });
    expect(getGameV2LiquidationLegalOptions(
      boundary,
      { alice: null } as unknown as LiquidationChoicesV2,
    )).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_LIQUIDATION_CHOICES", seat: "alice" },
    });
    expect(getGameV2LiquidationLegalOptions(boundary, {
      stranger: [],
    })).toMatchObject({
      availability: "disabled",
      reason: { code: "UNKNOWN_SEAT", seat: "stranger" },
    });
  });

  it("stays linear and immutable on a dense four-player board", () => {
    let state = createGameV2(
      ["alice", "bob", "carol", "dave"],
      "liquidation-dense",
    );
    const boardKinds: Readonly<Record<string, IndustryTileKind>> = {
      manufacturer: "manufacturer",
      cotton_mill: "cotton",
      brewery: "brewery",
      coal_mine: "coal",
      pottery: "pottery",
      iron_works: "iron",
    };
    const candidates = Object.entries(BOARD_V2.locations).flatMap(
      ([locationId, location]) =>
        "buildSpaces" in location
          ? location.buildSpaces.flatMap((space) => {
              const industry = space.allows
                .map((allowed) => boardKinds[allowed])
                .find((candidate) => candidate !== undefined);
              return industry === undefined
                ? []
                : [{ buildSpaceId: space.id, locationId, industry }];
            })
          : [],
    ).slice(0, 32);
    for (const [index, candidate] of candidates.entries()) {
      state = placeTopIndustry(
        state,
        state.turnOrder[index % state.turnOrder.length],
        candidate.buildSpaceId,
        candidate.locationId,
        candidate.industry,
      );
    }
    for (const seat of state.turnOrder) {
      state = withIncome(state, seat, -10, 0, 10);
    }
    const boundary = completeRound(state);
    const partial = Object.fromEntries(
      boundary.turnOrder.map((seat) => [seat, []]),
    ) as LiquidationChoicesV2;
    const snapshot = structuredClone(boundary);

    const startedAt = performance.now();
    const first = getGameV2LiquidationLegalOptions(boundary, partial);
    const elapsedMs = performance.now() - startedAt;
    const second = getGameV2LiquidationLegalOptions(boundary, partial);

    expect(first.availability).toBe("exact");
    expect(first.ready).toBe(false);
    expect(first.seats.reduce(
      (count, seat) => count + seat.nextChoices.length,
      0,
    )).toBe(candidates.filter((candidate) =>
      INDUSTRY_TILE_BY_ID[
        boundary.board.placedIndustries[candidate.buildSpaceId].tileId
      ].build.money >= 2
    ).length);
    expect(first.seats.every((seat) =>
      seat.nextChoices.every(
        (choice) => choice.choicesAfterAppend.length === 1,
      )
    )).toBe(true);
    expect(elapsedMs).toBeLessThan(250);
    expect(second).toEqual(first);
    expect(boundary).toEqual(snapshot);
  });
});

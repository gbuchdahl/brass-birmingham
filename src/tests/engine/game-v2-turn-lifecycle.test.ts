import { describe, expect, it } from "vitest";
import { discardActionCard } from "@/engine/cards-v2/zones";
import { highestSpaceForIncomeLevel } from "@/engine/economy/income";
import {
  applyAcceptedActionV2,
  resolveCompletedRoundV2,
  type AcceptedActionEffectV2,
  type LiquidationChoicesV2,
} from "@/engine/game-v2/turn-lifecycle";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import { removeBuiltIndustryTile } from "@/engine/player-v2";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";

function requireAccepted(
  result: ReturnType<typeof applyAcceptedActionV2>,
): Extract<ReturnType<typeof applyAcceptedActionV2>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function requireSettled(
  result: ReturnType<typeof resolveCompletedRoundV2>,
): Extract<ReturnType<typeof resolveCompletedRoundV2>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function playAcceptedAction(
  state: GameStateV2,
  moneySpent = 0,
  type = "PASSED",
): Extract<ReturnType<typeof applyAcceptedActionV2>, { ok: true }> {
  const seat = state.currentSeat;
  const cardId = state.cards.hands[seat][0];
  const afterCard: GameStateV2 = {
    ...state,
    cards: discardActionCard(state.cards, seat, cardId),
  };
  return requireAccepted(
    applyAcceptedActionV2(afterCard, {
      type,
      actionsConsumed: 1,
      moneySpent,
    }),
  );
}

function completeRound(
  initial: GameStateV2,
  spendBySeat: Readonly<Record<string, number>> = {},
): GameStateV2 {
  let state = initial;
  while (true) {
    const moneySpent = Object.hasOwn(spendBySeat, state.currentSeat)
      ? spendBySeat[state.currentSeat]
      : 0;
    const accepted = playAcceptedAction(
      state,
      state.actionsUsed === 0 ? moneySpent : 0,
    );
    state = accepted.state;
    if (accepted.roundComplete) return state;
  }
}

function withIncome(
  state: GameStateV2,
  seat: string,
  incomeLevel: number,
  money = state.players[seat].money,
  victoryPoints = state.players[seat].victoryPoints,
): GameStateV2 {
  return {
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
  };
}

function withAliceManufacturer(state: GameStateV2): GameStateV2 {
  const removed = removeBuiltIndustryTile(
    state.players.alice.industryInventory,
    "manufacturer-1-a",
    "canal",
  );
  if (!removed.ok) throw new Error(removed.error.message);
  return {
    ...state,
    players: {
      ...state.players,
      alice: {
        ...state.players.alice,
        industryInventory: removed.inventory,
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        birmingham_1: {
          owner: "alice",
          tileId: "manufacturer-1-a",
          locationId: "birmingham",
          spaceId: "birmingham_1",
          resources: { coal: 0, iron: 0, beer: 0 },
          flipped: false,
        },
      },
    },
  };
}

function withTrailingUnrelatedEvent(state: GameStateV2): GameStateV2 {
  return {
    ...state,
    events: [
      ...state.events,
      {
        sequence: state.events.length,
        type: "UNRELATED_EVENT",
        data: { valid: true },
      },
    ],
  };
}

describe("GameStateV2 turn lifecycle", () => {
  it("uses one action in the first Canal round, refills, and advances", () => {
    const initial = createGameV2(["alice", "bob"], "canal-first-action");
    const drawBefore = initial.cards.draw.length;
    const accepted = playAcceptedAction(initial, 3, "NETWORK_BUILT");

    expect(accepted).toMatchObject({
      turnComplete: true,
      roundComplete: false,
      refilledCards: 1,
    });
    expect(accepted.state).toMatchObject({
      currentSeat: "bob",
      actionsUsed: 0,
      turnNumber: 2,
      revision: 1,
      roundSpend: { alice: 3, bob: 0 },
    });
    expect(accepted.state.cards.hands.alice).toHaveLength(8);
    expect(accepted.state.cards.draw).toHaveLength(drawBefore - 1);
  });

  it.each([
    ["canal", 2],
    ["rail", 1],
  ] as const)("uses two actions in %s round %i", (era, round) => {
    const base = createGameV2(["alice", "bob"], `${era}-two-actions`);
    const initial: GameStateV2 = {
      ...base,
      era,
      round,
      actionLimit: 2,
    };
    const first = playAcceptedAction(initial, 2);
    expect(first).toMatchObject({ turnComplete: false, roundComplete: false });
    expect(first.state.currentSeat).toBe("alice");
    expect(first.state.actionsUsed).toBe(1);
    expect(first.state.cards.hands.alice).toHaveLength(7);

    const second = playAcceptedAction(first.state, 4);
    expect(second).toMatchObject({
      turnComplete: true,
      roundComplete: false,
      refilledCards: 2,
    });
    expect(second.state.currentSeat).toBe("bob");
    expect(second.state.actionsUsed).toBe(0);
    expect(second.state.roundSpend.alice).toBe(6);
    expect(second.state.cards.hands.alice).toHaveLength(8);
  });

  it("finishes a turn cleanly when the draw deck is exhausted", () => {
    const base = createGameV2(["alice", "bob"], "empty-draw-refill");
    const initial: GameStateV2 = {
      ...base,
      cards: {
        ...base.cards,
        discard: [...base.cards.discard, ...base.cards.draw],
        draw: [],
      },
    };
    const accepted = playAcceptedAction(initial);

    expect(accepted.refilledCards).toBe(0);
    expect(accepted.state.cards.hands.alice).toHaveLength(7);
    expect(accepted.state.cards.draw).toEqual([]);
    expect(accepted.state.currentSeat).toBe("bob");
  });

  it("settles all players and uses stable least-spend turn order", () => {
    let initial = createGameV2(["alice", "bob", "carol"], "stable-spend-order");
    initial = withIncome(initial, "alice", 3);
    initial = withIncome(initial, "bob", -2, 5);
    const boundary = completeRound(initial, { alice: 4, bob: 0, carol: 4 });
    const settled = requireSettled(
      resolveCompletedRoundV2(boundary, { bob: [] }),
    );

    expect(settled.eraComplete).toBe(false);
    expect(settled.state.round).toBe(2);
    expect(settled.state.actionLimit).toBe(2);
    expect(settled.state.turnOrder).toEqual(["bob", "alice", "carol"]);
    expect(settled.state.currentSeat).toBe("bob");
    expect(settled.state.roundSpend).toEqual({ bob: 0, alice: 0, carol: 0 });
    expect(settled.state.players.alice.money).toBe(20);
    expect(settled.state.players.bob.money).toBe(3);
    expect(settled.settlements.alice).toMatchObject({
      incomeLevel: 3,
      moneyChange: 3,
      skipped: false,
    });
    expect(settled.settlements.bob).toMatchObject({
      incomeLevel: -2,
      requiredPayment: 2,
      moneyChange: -2,
    });
  });

  it("liquidates only explicit owned industries at half build cost", () => {
    let initial = createGameV2(["alice", "bob"], "round-liquidation");
    initial = withAliceManufacturer(initial);
    initial = withIncome(initial, "alice", -5, 0, 3);
    const boundary = completeRound(initial);
    const settled = requireSettled(
      resolveCompletedRoundV2(boundary, { alice: ["birmingham_1"] }),
    );

    expect(settled.settlements.alice).toMatchObject({
      requiredPayment: 5,
      liquidationProceeds: 4,
      victoryPointsLost: 1,
      unpaidShortfall: 0,
      removedIndustryIds: ["birmingham_1"],
    });
    expect(settled.state.players.alice).toMatchObject({
      money: 0,
      victoryPoints: 2,
      removedIndustryTileIds: ["manufacturer-1-a"],
    });
    expect(settled.state.board.placedIndustries).not.toHaveProperty("birmingham_1");
    expect(validateGameStateV2(settled.state)).toMatchObject({ ok: true });
  });

  it("converts an unpayable negative-income shortfall to VP loss", () => {
    let initial = createGameV2(["alice", "bob"], "round-vp-shortfall");
    initial = withIncome(initial, "alice", -5, 0, 3);
    const boundary = completeRound(initial);
    const settled = requireSettled(
      resolveCompletedRoundV2(boundary, { alice: [] }),
    );

    expect(settled.settlements.alice).toMatchObject({
      requiredPayment: 5,
      victoryPointsLost: 3,
      unpaidShortfall: 2,
    });
    expect(settled.state.players.alice).toMatchObject({
      money: 0,
      victoryPoints: 0,
    });
  });

  it("settles income at the end of Canal but skips it after the final Rail round", () => {
    const maxCanalRound = SETUP_DATA.playerCounts[2].roundsPerEra;
    let canal = createGameV2(["alice", "bob"], "final-canal-income");
    canal = {
      ...withIncome(canal, "alice", 2),
      round: maxCanalRound,
      actionLimit: 2,
    };
    const canalResult = requireSettled(
      resolveCompletedRoundV2(completeRound(canal), {}),
    );
    expect(canalResult.eraComplete).toBe(true);
    expect(canalResult.state.round).toBe(maxCanalRound);
    expect(canalResult.state.players.alice.money).toBe(19);
    expect(canalResult.settlements.alice.skipped).toBe(false);

    const maxRailRound = SETUP_DATA.playerCounts[2].roundsPerEra;
    let rail = createGameV2(["alice", "bob"], "final-rail-income");
    rail = {
      ...withIncome(rail, "alice", 2),
      era: "rail",
      round: maxRailRound,
      actionLimit: 2,
    };
    const railResult = requireSettled(
      resolveCompletedRoundV2(completeRound(rail), {}),
    );
    expect(railResult.eraComplete).toBe(true);
    expect(railResult.state.round).toBe(maxRailRound);
    expect(railResult.state.players.alice.money).toBe(17);
    expect(railResult.settlements.alice.skipped).toBe(true);
  });

  it("increments revision and appends sequential JSON-safe lifecycle events", () => {
    const initial = createGameV2(["alice", "bob"], "lifecycle-events");
    const boundary = completeRound(initial, { alice: 2, bob: 5 });
    const settled = requireSettled(resolveCompletedRoundV2(boundary, {}));

    expect(boundary.revision).toBe(2);
    expect(settled.state.revision).toBe(3);
    expect(settled.state.events.map((event) => event.sequence)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(settled.state.events.map((event) => event.type)).toEqual([
      "GAME_CREATED",
      "ACTION_ACCEPTED",
      "ACTION_ACCEPTED",
      "ROUND_SETTLED",
    ]);
    expect(JSON.parse(JSON.stringify(settled))).toEqual(settled);
  });

  it("blocks actions at pending round settlement and pending era transition boundaries", () => {
    const roundBoundary = completeRound(
      createGameV2(["alice", "bob"], "round-action-barrier"),
    );
    expect(validateGameStateV2(roundBoundary)).toMatchObject({ ok: true });
    const trailedRoundBoundary = withTrailingUnrelatedEvent(roundBoundary);
    expect(validateGameStateV2(trailedRoundBoundary)).toMatchObject({ ok: true });
    const beforeSettlement = applyAcceptedActionV2(trailedRoundBoundary, {
      type: "PASSED",
      actionsConsumed: 1,
      moneySpent: 0,
    });
    expect(beforeSettlement).toMatchObject({
      ok: false,
      error: { code: "ROUND_SETTLEMENT_REQUIRED" },
    });
    expect(beforeSettlement.state).toBe(trailedRoundBoundary);

    const finalRound = SETUP_DATA.playerCounts[2].roundsPerEra;
    const finalCanal: GameStateV2 = {
      ...createGameV2(["alice", "bob"], "era-action-barrier"),
      round: finalRound,
      actionLimit: 2,
    };
    const finalBoundary = completeRound(finalCanal);
    const settled = requireSettled(resolveCompletedRoundV2(finalBoundary, {}));
    expect(settled.eraComplete).toBe(true);
    expect(settled.state.events.at(-1)).toMatchObject({
      type: "ROUND_SETTLED",
      data: {
        settlementComplete: true,
        era: "canal",
        eraComplete: true,
        incomeSkipped: false,
      },
    });
    expect(validateGameStateV2(settled.state)).toMatchObject({ ok: true });

    const trailedSettlement = withTrailingUnrelatedEvent(settled.state);
    expect(validateGameStateV2(trailedSettlement)).toMatchObject({ ok: true });
    const beforeEraTransition = applyAcceptedActionV2(trailedSettlement, {
      type: "PASSED",
      actionsConsumed: 1,
      moneySpent: 0,
    });
    expect(beforeEraTransition).toMatchObject({
      ok: false,
      error: { code: "ERA_TRANSITION_REQUIRED" },
    });
    expect(beforeEraTransition.state).toBe(trailedSettlement);
    const repeatedSettlement = resolveCompletedRoundV2(trailedSettlement, {});
    expect(repeatedSettlement).toMatchObject({
      ok: false,
      error: { code: "ERA_TRANSITION_REQUIRED" },
    });
    expect(repeatedSettlement.state).toBe(trailedSettlement);
  });

  it("blocks lifecycle transitions after GAME_ENDED", () => {
    const base = createGameV2(["alice", "bob"], "ended-action-barrier");
    const endedMarker: GameStateV2 = {
      ...base,
      events: [
        ...base.events,
        {
          sequence: base.events.length,
          type: "GAME_ENDED",
          data: { standings: [] },
        },
      ],
    };
    const ended = withTrailingUnrelatedEvent(endedMarker);
    expect(validateGameStateV2(ended)).toMatchObject({ ok: true });

    const action = applyAcceptedActionV2(ended, {
      actionsConsumed: 1,
      moneySpent: 0,
    });
    expect(action).toMatchObject({
      ok: false,
      error: { code: "GAME_ALREADY_ENDED" },
    });
    expect(action.state).toBe(ended);

    const settlement = resolveCompletedRoundV2(ended, {});
    expect(settlement).toMatchObject({
      ok: false,
      error: { code: "GAME_ALREADY_ENDED" },
    });
    expect(settlement.state).toBe(ended);
  });

  it("skips final Rail income without requiring liquidation choices", () => {
    const finalRound = SETUP_DATA.playerCounts[2].roundsPerEra;
    let rail = createGameV2(["alice", "bob"], "negative-final-rail");
    rail = {
      ...withIncome(rail, "alice", -5, 0, 7),
      era: "rail",
      round: finalRound,
      actionLimit: 2,
    };
    const boundary = completeRound(rail);
    expect(validateGameStateV2(boundary)).toMatchObject({ ok: true });

    const skipped = requireSettled(resolveCompletedRoundV2(boundary, {}));
    expect(skipped.settlements.alice).toMatchObject({
      incomeLevel: -5,
      skipped: true,
      money: 0,
      victoryPoints: 7,
      removedIndustryIds: [],
    });
    expect(skipped.state.players.alice).toMatchObject({
      money: 0,
      victoryPoints: 7,
    });
    expect(skipped.state.events.at(-1)?.data).toMatchObject({
      settlementComplete: true,
      eraComplete: true,
      incomeSkipped: true,
    });

    const explicitEmpty = resolveCompletedRoundV2(boundary, { alice: [] });
    expect(explicitEmpty).toMatchObject({
      ok: false,
      error: {
        code: "UNEXPECTED_LIQUIDATION_CHOICES",
        seat: "alice",
      },
    });
    expect(explicitEmpty.state).toBe(boundary);

    const irrelevant = resolveCompletedRoundV2(boundary, {
      alice: ["irrelevant-industry"],
    });
    expect(irrelevant).toMatchObject({
      ok: false,
      error: {
        code: "UNEXPECTED_LIQUIDATION_CHOICES",
        seat: "alice",
      },
    });
    expect(irrelevant.state).toBe(boundary);
  });

  it("stores settlements safely for prototype-looking player IDs", () => {
    const initial = createGameV2(
      ["__proto__", "constructor"],
      "prototype-settlements",
    );
    const boundary = completeRound(initial);
    const result = requireSettled(resolveCompletedRoundV2(boundary, {}));

    expect(Object.hasOwn(result.settlements, "__proto__")).toBe(true);
    expect(Object.hasOwn(result.settlements, "constructor")).toBe(true);
    expect(result.settlements["__proto__"]).toMatchObject({
      incomeLevel: 0,
      skipped: false,
    });
    expect(result.settlements.constructor).toMatchObject({
      incomeLevel: 0,
      skipped: false,
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(validateGameStateV2(result.state)).toMatchObject({ ok: true });
  });

  it("rejects invalid effects, exhausted budgets, and late refill failures atomically", () => {
    const initial = createGameV2(["alice", "bob"], "atomic-actions");
    const invalidEffects = [
      { actionsConsumed: 0, moneySpent: 0 },
      { actionsConsumed: 1, moneySpent: -1 },
    ];
    for (const effect of invalidEffects) {
      const result = applyAcceptedActionV2(
        initial,
        effect as unknown as AcceptedActionEffectV2,
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_ACTION_EFFECT" },
      });
      expect(result.state).toBe(initial);
    }

    const exhausted: GameStateV2 = { ...initial, actionsUsed: 1 };
    const exhaustedResult = applyAcceptedActionV2(exhausted, {
      actionsConsumed: 1,
      moneySpent: 0,
    });
    expect(exhaustedResult).toMatchObject({
      ok: false,
      error: { code: "ACTION_LIMIT_REACHED" },
    });
    expect(exhaustedResult.state).toBe(exhausted);

    const [extra, ...remainingDraw] = initial.cards.draw;
    const oversized: GameStateV2 = {
      ...initial,
      cards: {
        ...initial.cards,
        hands: {
          ...initial.cards.hands,
          alice: [...initial.cards.hands.alice, extra],
        },
        draw: remainingDraw,
      },
    };
    const refillFailure = applyAcceptedActionV2(oversized, {
      actionsConsumed: 1,
      moneySpent: 0,
    });
    expect(refillFailure).toMatchObject({
      ok: false,
      error: { code: "CARD_REFILL_FAILED" },
    });
    expect(refillFailure.state).toBe(oversized);
  });

  it("requires a completed boundary and explicit negative-income choices", () => {
    const initial = createGameV2(["alice", "bob"], "atomic-boundary");
    const early = resolveCompletedRoundV2(initial, {});
    expect(early).toMatchObject({
      ok: false,
      error: { code: "ROUND_NOT_COMPLETE" },
    });
    expect(early.state).toBe(initial);

    const negative = withIncome(initial, "alice", -1, 17);
    const boundary = completeRound(negative);
    const missing = resolveCompletedRoundV2(boundary, {});
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "MISSING_LIQUIDATION_CHOICES", seat: "alice" },
    });
    expect(missing.state).toBe(boundary);

    const unexpected = resolveCompletedRoundV2(boundary, {
      alice: [],
      bob: [],
    });
    expect(unexpected).toMatchObject({
      ok: false,
      error: { code: "UNEXPECTED_LIQUIDATION_CHOICES", seat: "bob" },
    });
    expect(unexpected.state).toBe(boundary);
  });

  it("rejects a late foreign-industry liquidation without committing earlier plans", () => {
    let initial = createGameV2(["alice", "bob"], "atomic-liquidation");
    initial = withAliceManufacturer(initial);
    initial = withIncome(initial, "alice", -5, 0, 5);
    initial = withIncome(initial, "bob", -5, 0, 5);
    const boundary = completeRound(initial);
    const snapshot = structuredClone(boundary);
    const choices: LiquidationChoicesV2 = {
      alice: ["birmingham_1"],
      bob: ["birmingham_1"],
    };
    const result = resolveCompletedRoundV2(boundary, choices);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INDUSTRY_NOT_OWNED",
        seat: "bob",
        industryId: "birmingham_1",
      },
    });
    expect(result.state).toBe(boundary);
    expect(boundary).toEqual(snapshot);
  });
});

import { describe, expect, it } from "vitest";
import { discardActionCard } from "@/engine/cards-v2/zones";
import {
  deriveRailSetupSeed,
  resolveGameEra,
} from "@/engine/game-v2/era-lifecycle";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { highestSpaceForIncomeLevel } from "@/engine/economy/income";
import {
  developIndustryTiles,
  removeBuiltIndustryTile,
} from "@/engine/player-v2";
import { CARD_CATALOG, WILD_CARD_SUPPLY } from "@/engine/rules/generated/cards";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILES,
  type IndustryTileId,
} from "@/engine/rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";
import {
  applyAcceptedActionV2,
  resolveCompletedRoundV2,
} from "@/engine/game-v2/turn-lifecycle";

const PLAYER_COUNTS = [2, 3, 4] as const;

function seats(playerCount: number): string[] {
  return Array.from({ length: playerCount }, (_, index) =>
    String.fromCharCode("a".charCodeAt(0) + index),
  );
}

function requireValid(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  expect(validation.ok).toBe(true);
  if (!validation.ok) throw new Error(validation.errors[0].message);
}

function requireSuccess(
  result: ReturnType<typeof resolveGameEra>,
): Extract<ReturnType<typeof resolveGameEra>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function regularCards(state: GameStateV2): GameStateV2["cards"]["discard"] {
  return [
    ...state.turnOrder.flatMap((seat) => state.cards.hands[seat]),
    ...state.cards.draw,
    ...state.cards.discard,
  ].filter((cardId) => !cardId.startsWith("wild-")) as GameStateV2["cards"]["discard"];
}

function completedRoundBoundary(state: GameStateV2): GameStateV2 {
  const playerCount = state.turnOrder.length as 2 | 3 | 4;
  const allCards = regularCards(state);
  const finalCard = allCards.at(-1);
  if (!finalCard) throw new Error("Expected a final regular action card");
  const finalSeat = state.turnOrder.at(-1) as string;
  const beforeFinalAction: GameStateV2 = {
    ...state,
    round: SETUP_DATA.playerCounts[playerCount].roundsPerEra,
    currentSeat: finalSeat,
    actionsUsed: 1,
    actionLimit: 2,
    cards: {
      hands: Object.fromEntries(
        state.turnOrder.map((seat) => [
          seat,
          seat === finalSeat ? [finalCard] : [],
        ]),
      ),
      draw: [],
      discard: allCards.slice(0, -1),
      wildSupplies: {
        location: WILD_CARD_SUPPLY.location,
        industry: WILD_CARD_SUPPLY.industry,
      },
    },
  };
  requireValid(beforeFinalAction);
  const afterCard: GameStateV2 = {
    ...beforeFinalAction,
    cards: discardActionCard(
      beforeFinalAction.cards,
      finalSeat,
      finalCard,
    ),
  };
  const accepted = applyAcceptedActionV2(afterCard, {
    type: "PASSED",
    actionsConsumed: 1,
    moneySpent: 0,
  });
  expect(accepted).toMatchObject({ ok: true, roundComplete: true });
  if (!accepted.ok) throw new Error(accepted.error.message);
  requireValid(accepted.state);
  return accepted.state;
}

function settledEraBoundary(state: GameStateV2): GameStateV2 {
  const completed = completedRoundBoundary(state);
  const settled = resolveCompletedRoundV2(completed, {});
  expect(settled).toMatchObject({ ok: true, eraComplete: true });
  if (!settled.ok) throw new Error(settled.error.message);
  requireValid(settled.state);
  return settled.state;
}

function placeIndustry(
  state: GameStateV2,
  seat: string,
  tileId: IndustryTileId,
  locationId: string,
  spaceId: string,
  flipped = true,
): GameStateV2 {
  const player = state.players[seat];
  const removed = removeBuiltIndustryTile(
    player.industryInventory,
    tileId,
    state.era,
  );
  if (!removed.ok) throw new Error(removed.error.message);
  const placed: PlacedIndustryStateV2 = {
    owner: seat,
    tileId,
    locationId,
    spaceId,
    resources: { coal: 0, iron: 0, beer: 0 },
    flipped,
  };
  return {
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...player,
        industryInventory: removed.inventory,
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        [spaceId]: placed,
      },
    },
  };
}

function developOne(
  state: GameStateV2,
  seat: string,
  tileId: IndustryTileId,
): GameStateV2 {
  const player = state.players[seat];
  const developed = developIndustryTiles(player.industryInventory, [tileId]);
  if (!developed.ok) throw new Error(developed.error.message);
  return {
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...player,
        industryInventory: developed.inventory,
        removedIndustryTileIds: [
          ...player.removedIndustryTileIds,
          ...developed.removedTileIds,
        ],
      },
    },
  };
}

function buildLink(
  state: GameStateV2,
  linkId: string,
  owner: string,
): GameStateV2 {
  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...state.players[owner],
        linkTokensRemaining: state.players[owner].linkTokensRemaining - 1,
      },
    },
    board: {
      ...state.board,
      builtLinks: { ...state.board.builtLinks, [linkId]: owner },
    },
  };
}

function canalBoundaryWithAssets(seed = "canal-boundary-assets"): GameStateV2 {
  let state = createGameV2(["alice", "bob"], seed);
  state = developOne(state, "alice", "cotton-1-a");
  state = placeIndustry(
    state,
    "alice",
    "manufacturer-1-a",
    "birmingham",
    "birmingham_1",
  );
  state = placeIndustry(
    state,
    "alice",
    "manufacturer-2-a",
    "coventry",
    "coventry_2",
  );
  state = buildLink(state, "link_birmingham_oxford", "bob");
  state = {
    ...state,
    players: {
      ...state.players,
      alice: { ...state.players.alice, victoryPoints: 2 },
      bob: { ...state.players.bob, victoryPoints: 1 },
    },
    roundSpend: { alice: 9, bob: 2 },
    merchants: {
      ...state.merchants,
      spaces: state.merchants.spaces.map((space) => ({
        ...space,
        beer: 0,
      })),
    },
  };
  const boundary = settledEraBoundary(state);
  requireValid(boundary);
  return boundary;
}

function enterRail(seatIds: readonly string[], seed: string): GameStateV2 {
  const canal = settledEraBoundary(createGameV2(seatIds, seed));
  const result = requireSuccess(resolveGameEra(canal));
  expect(result.gameEnded).toBe(false);
  return result.state;
}

describe("composite Canal-to-Rail resolution", () => {
  it("scores the pre-cleanup board, adds VP, then removes Canal assets", () => {
    const initial = canalBoundaryWithAssets("score-before-cleanup");
    const result = requireSuccess(resolveGameEra(initial));

    expect(result).toMatchObject({
      completedEra: "canal",
      gameEnded: false,
      standings: null,
      railSeed: deriveRailSetupSeed(initial.seed),
      scoring: {
        totalByOwner: { bob: 4, alice: 8 },
        linkPointsByOwner: { bob: 4 },
        industryPointsByOwner: { alice: 8 },
      },
    });
    expect(result.state.players.alice.victoryPoints).toBe(10);
    expect(result.state.players.bob.victoryPoints).toBe(5);
    expect(result.state.board.builtLinks).toEqual({});
    expect(Object.keys(result.state.board.placedIndustries)).toEqual([
      "coventry_2",
    ]);
    expect(result.state.board.placedIndustries.coventry_2.tileId).toBe(
      "manufacturer-2-a",
    );
    expect(result.state.players.bob.linkTokensRemaining).toBe(14);
  });

  it("purges every remaining and placed level-1 tile into each removed zone", () => {
    const initial = canalBoundaryWithAssets("level-one-purge");
    const result = requireSuccess(resolveGameEra(initial));
    const allLevelOneIds = INDUSTRY_TILES.filter((tile) => tile.level === 1)
      .map((tile) => tile.id)
      .sort();

    for (const seat of initial.turnOrder) {
      const player = result.state.players[seat];
      const remaining = Object.values(player.industryInventory.stacks).flat();
      expect(
        remaining.every((tileId) => INDUSTRY_TILE_BY_ID[tileId].level > 1),
      ).toBe(true);
      expect(
        player.removedIndustryTileIds
          .filter((tileId) => INDUSTRY_TILE_BY_ID[tileId].level === 1)
          .sort(),
      ).toEqual(allLevelOneIds);
      expect(new Set(player.removedIndustryTileIds)).toHaveLength(
        player.removedIndustryTileIds.length,
      );
    }
    expect(result.state.players.alice.removedIndustryTileIds).toContain(
      "cotton-1-a",
    );
    expect(result.state.players.alice.removedIndustryTileIds).toContain(
      "manufacturer-1-a",
    );
  });

  it("replenishes demand Merchant beer, resets the Rail turn, and appends events", () => {
    const initial = canalBoundaryWithAssets("rail-turn-reset");
    const result = requireSuccess(resolveGameEra(initial));
    const state = result.state;

    expect(initial.turnOrder).toEqual(["bob", "alice"]);
    expect(state).toMatchObject({
      revision: initial.revision + 1,
      era: "rail",
      round: 1,
      turnNumber: 1,
      currentSeat: "bob",
      actionsUsed: 0,
      actionLimit: 2,
      progress: { phase: "action" },
      roundSpend: { bob: 0, alice: 0 },
    });
    for (const space of state.merchants.spaces) {
      expect(space.beer).toBe(
        space.active && space.demandIndustries.length > 0 ? 1 : 0,
      );
    }
    expect(state.events.slice(-2).map((event) => event.type)).toEqual([
      "ERA_SCORED",
      "RAIL_STARTED",
    ]);
    expect(state.events.map((event) => event.sequence)).toEqual(
      state.events.map((_, index) => index),
    );
    expect(state.events.at(-1)?.data).toMatchObject({
      railSeed: deriveRailSetupSeed(initial.seed),
      removedLinkIds: ["link_birmingham_oxford"],
      removedIndustrySpaceIds: ["birmingham_1"],
    });
  });

  it("collects and deterministically redeals the complete Rail deck", () => {
    const initial = canalBoundaryWithAssets("deterministic-rail-cards");
    const first = requireSuccess(resolveGameEra(initial));
    const repeated = requireSuccess(resolveGameEra(initial));

    expect(repeated.state.cards).toEqual(first.state.cards);
    expect(first.state.cards.discard).toEqual([]);
    expect(first.state.cards.wildSupplies).toEqual(WILD_CARD_SUPPLY);
    for (const seat of initial.turnOrder) {
      expect(first.state.cards.hands[seat]).toHaveLength(8);
    }
    const expectedCards = CARD_CATALOG.filter((card) =>
      (card.includedAt as readonly number[]).includes(initial.turnOrder.length),
    ).map((card) => card.id);
    expect(regularCards(first.state).sort()).toEqual(expectedCards.sort());

    const different = requireSuccess(
      resolveGameEra(canalBoundaryWithAssets("different-rail-cards")),
    );
    expect(regularCards(different.state)).not.toEqual(regularCards(first.state));
  });

  it.each(PLAYER_COUNTS)(
    "preserves validator conservation through both era boundaries for %i players",
    (playerCount) => {
      const canal = settledEraBoundary(
        createGameV2(seats(playerCount), `full-journey-${playerCount}`),
      );
      const rail = requireSuccess(resolveGameEra(canal));
      expect(rail.gameEnded).toBe(false);
      requireValid(rail.state);
      for (const seat of rail.state.turnOrder) {
        expect(rail.state.players[seat].linkTokensRemaining).toBe(14);
        expect(
          Object.values(rail.state.players[seat].industryInventory.stacks)
            .flat()
            .every((tileId) => INDUSTRY_TILE_BY_ID[tileId].level > 1),
        ).toBe(true);
      }

      const railBoundary = settledEraBoundary(rail.state);
      const ended = requireSuccess(resolveGameEra(railBoundary));
      expect(ended.gameEnded).toBe(true);
      requireValid(ended.state);
    },
  );
});

describe("final Rail resolution", () => {
  it("scores and preserves Rail assets without paying income or cleaning the board", () => {
    let rail = enterRail(["alice", "bob"], "final-assets");
    rail = placeIndustry(
      rail,
      "alice",
      "manufacturer-2-a",
      "birmingham",
      "birmingham_1",
    );
    rail = buildLink(rail, "link_birmingham_oxford", "bob");
    rail = {
      ...rail,
      players: {
        ...rail.players,
        alice: {
          ...rail.players.alice,
          money: 9,
          incomeMarkerSpace: highestSpaceForIncomeLevel(2),
          victoryPoints: 10,
        },
        bob: {
          ...rail.players.bob,
          money: 7,
          incomeMarkerSpace: highestSpaceForIncomeLevel(1),
          victoryPoints: 12,
        },
      },
    };
    const initial = settledEraBoundary(rail);
    requireValid(initial);
    const result = requireSuccess(resolveGameEra(initial));
    if (!result.gameEnded) throw new Error("Expected final Rail resolution");

    expect(result).toMatchObject({
      completedEra: "rail",
      gameEnded: true,
      railSeed: null,
      scoring: {
        totalByOwner: { bob: 3, alice: 5 },
      },
    });
    expect(result.state.board).toEqual(initial.board);
    expect(result.state.merchants).toEqual(initial.merchants);
    expect(result.state.players.alice).toMatchObject({
      victoryPoints: 15,
      money: 9,
      incomeMarkerSpace: highestSpaceForIncomeLevel(2),
    });
    expect(result.state.players.bob).toMatchObject({
      victoryPoints: 15,
      money: 7,
      incomeMarkerSpace: highestSpaceForIncomeLevel(1),
    });
    expect(result.standings.map((standing) => standing.playerId)).toEqual([
      "alice",
      "bob",
    ]);
    expect(result.state.events.slice(-2).map((event) => event.type)).toEqual([
      "ERA_SCORED",
      "GAME_ENDED",
    ]);
    expect(result.state.progress).toEqual({
      phase: "ended",
      terminal: { standings: result.standings },
    });
  });

  it("uses VP, income, cash, and explicit shared ranks after final scoring", () => {
    const base = enterRail(["a", "b", "c", "d"], "final-rank-ties");
    const rail: GameStateV2 = {
      ...base,
      players: {
        a: {
          ...base.players.a,
          victoryPoints: 20,
          incomeMarkerSpace: highestSpaceForIncomeLevel(0),
          money: 5,
        },
        b: {
          ...base.players.b,
          victoryPoints: 20,
          incomeMarkerSpace: highestSpaceForIncomeLevel(1),
          money: 0,
        },
        c: {
          ...base.players.c,
          victoryPoints: 20,
          incomeMarkerSpace: highestSpaceForIncomeLevel(0),
          money: 5,
        },
        d: {
          ...base.players.d,
          victoryPoints: 19,
          incomeMarkerSpace: highestSpaceForIncomeLevel(30),
          money: 999,
        },
      },
    };
    const result = requireSuccess(resolveGameEra(settledEraBoundary(rail)));
    expect(
      result.standings?.map(({ playerId, rank, tied }) => ({
        playerId,
        rank,
        tied,
      })),
    ).toEqual([
      { playerId: "b", rank: 1, tied: false },
      { playerId: "a", rank: 2, tied: true },
      { playerId: "c", rank: 2, tied: true },
      { playerId: "d", rank: 4, tied: false },
    ]);
  });

  it("rejects a second final resolution without duplicating scoring", () => {
    const rail = enterRail(["alice", "bob"], "already-ended");
    const ended = requireSuccess(
      resolveGameEra(settledEraBoundary(rail)),
    );
    const repeated = resolveGameEra(ended.state);

    expect(repeated).toMatchObject({
      ok: false,
      error: { code: "ALREADY_ENDED" },
    });
    expect(repeated.state).toBe(ended.state);
  });

  it("rejects final scoring when any later event follows GAME_ENDED", () => {
    const rail = enterRail(["alice", "bob"], "ended-with-trailing-event");
    const ended = requireSuccess(
      resolveGameEra(settledEraBoundary(rail)),
    );
    const trailing: GameStateV2 = {
      ...ended.state,
      revision: ended.state.revision + 1,
      events: [
        ...ended.state.events,
        {
          sequence: ended.state.events.length,
          type: "AUDIT_TRAILER",
          data: { note: "GAME_ENDED is no longer the latest event" },
        },
      ],
    };
    requireValid(trailing);

    const repeated = resolveGameEra(trailing);

    expect(repeated).toMatchObject({
      ok: false,
      error: { code: "ALREADY_ENDED" },
    });
    expect(repeated.state).toBe(trailing);
    requireValid(repeated.state);
  });
});

describe("era lifecycle validation and immutability", () => {
  it("requires a matching final-round settlement event", () => {
    const completed = completedRoundBoundary(
      createGameV2(["alice", "bob"], "missing-settlement-marker"),
    );
    requireValid(completed);

    const missing = resolveGameEra(completed);
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "NOT_ERA_BOUNDARY" },
    });
    expect(missing.state).toBe(completed);
    requireValid(missing.state);

    const settled = settledEraBoundary(
      createGameV2(["alice", "bob"], "mismatched-settlement-marker"),
    );
    const settlementEvent = settled.events.at(-1);
    if (
      settlementEvent?.type !== "ROUND_SETTLED" ||
      typeof settlementEvent.data !== "object" ||
      settlementEvent.data === null ||
      Array.isArray(settlementEvent.data)
    ) {
      throw new Error("Expected a structured ROUND_SETTLED event");
    }
    const settlementData = settlementEvent.data as Record<string, unknown>;
    const mismatches: readonly Record<string, unknown>[] = [
      { era: "rail" },
      { completedRound: settled.round - 1 },
      { eraComplete: false },
    ];
    for (const mismatch of mismatches) {
      const invalidMarker: GameStateV2 = {
        ...settled,
        events: [
          ...settled.events.slice(0, -1),
          {
            ...settlementEvent,
            data: { ...settlementData, ...mismatch },
          },
        ],
      };
      const validation = validateGameStateV2(invalidMarker);
      expect(validation).toMatchObject({ ok: false });
      if (validation.ok) throw new Error("Expected inconsistent progress");
      expect(validation.errors.map((error) => error.code)).toContain(
        "PROGRESS_STATE",
      );

      const result = resolveGameEra(invalidMarker);

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_GAME_STATE" },
      });
      expect(result.state).toBe(invalidMarker);
    }
  });

  it("requires an explicitly complete round settlement", () => {
    const settled = settledEraBoundary(
      createGameV2(["alice", "bob"], "incomplete-settlement-marker"),
    );
    const settlementEvent = settled.events.at(-1);
    if (
      settlementEvent?.type !== "ROUND_SETTLED" ||
      typeof settlementEvent.data !== "object" ||
      settlementEvent.data === null ||
      Array.isArray(settlementEvent.data)
    ) {
      throw new Error("Expected a structured ROUND_SETTLED event");
    }
    const settlementData = settlementEvent.data as Record<string, unknown>;
    const withoutCompletion = Object.fromEntries(
      Object.entries(settlementData).filter(
        ([property]) => property !== "settlementComplete",
      ),
    );
    const incompletePayloads = [
      withoutCompletion,
      { ...settlementData, settlementComplete: false },
    ];

    for (const data of incompletePayloads) {
      const incomplete: GameStateV2 = {
        ...settled,
        events: [
          ...settled.events.slice(0, -1),
          { ...settlementEvent, data },
        ],
      };
      const validation = validateGameStateV2(incomplete);
      expect(validation).toMatchObject({ ok: false });
      if (validation.ok) throw new Error("Expected inconsistent progress");
      expect(validation.errors.map((error) => error.code)).toContain(
        "PROGRESS_STATE",
      );

      const result = resolveGameEra(incomplete);

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_GAME_STATE" },
      });
      expect(result.state).toBe(incomplete);
    }
  });

  it("rejects mid-era and nonempty-card states as the exact input", () => {
    const midEra = createGameV2(["alice", "bob"], "wrong-boundary");
    const midResult = resolveGameEra(midEra);
    expect(midResult).toMatchObject({
      ok: false,
      error: { code: "NOT_ERA_BOUNDARY" },
    });
    expect(midResult.state).toBe(midEra);

    const settled = settledEraBoundary(
      createGameV2(["alice", "bob"], "wrong-boundary-cards"),
    );
    const [unexpectedCard, ...remainingDiscard] = settled.cards.discard;
    const wrongCards: GameStateV2 = {
      ...settled,
      cards: {
        ...settled.cards,
        hands: {
          ...settled.cards.hands,
          alice: [unexpectedCard],
        },
        discard: remainingDiscard,
      },
    };
    requireValid(wrongCards);
    const cardResult = resolveGameEra(wrongCards);
    expect(cardResult).toMatchObject({
      ok: false,
      error: { code: "NOT_ERA_BOUNDARY" },
    });
    expect(cardResult.state).toBe(wrongCards);
  });

  it("rejects invalid input through the shared state validator", () => {
    const initial = settledEraBoundary(
      createGameV2(["alice", "bob"], "invalid-boundary"),
    );
    const invalid: GameStateV2 = {
      ...initial,
      players: {
        ...initial.players,
        alice: { ...initial.players.alice, linkTokensRemaining: 13 },
      },
    };
    const result = resolveGameEra(invalid);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_GAME_STATE",
        validationErrors: [expect.objectContaining({ code: "LINK_CONSERVATION" })],
      },
    });
    expect(result.state).toBe(invalid);
  });

  it("does not mutate a frozen boundary and returns JSON-safe output", () => {
    const initial = settledEraBoundary(
      createGameV2(["alice", "bob"], "immutable-era-boundary"),
    );
    const snapshot = structuredClone(initial);
    Object.freeze(initial.cards.draw);
    Object.freeze(initial.cards.discard);
    for (const hand of Object.values(initial.cards.hands)) Object.freeze(hand);
    Object.freeze(initial.cards.hands);
    Object.freeze(initial.cards);
    Object.freeze(initial.board.builtLinks);
    Object.freeze(initial.board.placedIndustries);
    Object.freeze(initial.board);
    Object.freeze(initial);

    const result = requireSuccess(resolveGameEra(initial));
    expect(initial).toEqual(snapshot);
    expect(result.state).not.toBe(initial);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

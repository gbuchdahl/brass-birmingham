import { describe, expect, it } from "vitest";
import {
  GAME_STATE_V2_SCHEMA_VERSION,
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
import { INCOME_TRACK_DATA } from "@/engine/rules/generated/income-track";
import {
  INDUSTRY_TILE_DATA_VERSION,
  INDUSTRY_TILES,
} from "@/engine/rules/generated/industry-tiles-v2";
import {
  MERCHANT_TILE_CATALOG,
  MERCHANT_TILE_DATA_META,
} from "@/engine/rules/generated/merchant-tiles";
import { RULESET_META, SETUP_DATA } from "@/engine/rules/generated/ruleset";

const PLAYER_COUNTS = [2, 3, 4] as const;

function seats(playerCount: number): string[] {
  return Array.from({ length: playerCount }, (_, index) => `seat-${index + 1}`);
}

function allRegularCards(state: GameStateV2): string[] {
  return [
    ...state.turnOrder.flatMap((seat) => state.cards.hands[seat]),
    ...state.cards.draw,
    ...state.cards.discard,
  ].filter((cardId) => !cardId.startsWith("wild-"));
}

function requireValid(state: unknown): GameStateV2 {
  const result = validateGameStateV2(state);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.errors[0].message);
  return result.state;
}

describe("GameStateV2 deterministic setup", () => {
  it.each(PLAYER_COUNTS)(
    "creates exact starting values and shared counts for %i players",
    (playerCount) => {
      const state = requireValid(
        createGameV2(seats(playerCount), `exact-${playerCount}`),
      );

      expect(state).toMatchObject({
        schemaVersion: 3,
        revision: 0,
        seed: `exact-${playerCount}`,
        era: "canal",
        round: 1,
        turnNumber: 1,
        currentSeat: "seat-1",
        actionsUsed: 0,
        actionLimit: 1,
        roundSpend: Object.fromEntries(
          seats(playerCount).map((seat) => [seat, 0]),
        ),
        market: { coal: 13, iron: 8 },
        board: { builtLinks: {}, placedIndustries: {} },
      });
      expect(state.turnOrder).toEqual(seats(playerCount));
      expect(Object.keys(state.players)).toEqual(seats(playerCount));
      for (const seat of state.turnOrder) {
        const player = state.players[seat];
        expect(player).toMatchObject({
          seat,
          money: 17,
          incomeMarkerSpace: 10,
          victoryPoints: 0,
          removedIndustryTileIds: [],
          linkTokensRemaining: 14,
        });
        expect(Object.values(player.industryInventory.stacks).flat())
          .toHaveLength(45);
      }
      expect(state.cards.draw).toHaveLength({ 2: 22, 3: 27, 4: 28 }[playerCount]);
      expect(state.cards.discard).toHaveLength(playerCount);
      expect(state.merchants.spaces).toHaveLength(9);
      expect(state.merchants.spaces.filter((space) => space.active)).toHaveLength(
        { 2: 5, 3: 7, 4: 9 }[playerCount],
      );
    },
  );

  it("is exactly reproducible and separates cards, Merchants, and future RNG", () => {
    const seatOrder = ["alice", "bob", "carol", "dave"];
    const first = createGameV2(seatOrder, "same-composite-seed");
    const repeated = createGameV2(seatOrder, "same-composite-seed");
    const different = createGameV2(seatOrder, "different-composite-seed");

    expect(repeated).toEqual(first);
    expect(different).not.toEqual(first);
    expect(different.gameId).not.toBe(first.gameId);
    expect(allRegularCards(different)).not.toEqual(allRegularCards(first));
    expect(different.merchants.spaces.map((space) => space.tileId)).not.toEqual(
      first.merchants.spaces.map((space) => space.tileId),
    );
    expect(new Set(Object.values(first.setupSeeds))).toHaveLength(3);
    expect(first.randomState.draws).toBe(0);
    expect(first.randomState.value).not.toBe(0);
    expect(first.setupSeeds.random).not.toBe(first.setupSeeds.cards);
  });

  it("keeps game identity valid when turn order changes between rounds", () => {
    const initial = createGameV2(["alice", "bob", "carol"], "stable-game-id");
    const reordered: GameStateV2 = {
      ...structuredClone(initial),
      turnOrder: ["carol", "alice", "bob"],
      currentSeat: "carol",
      roundSpend: { carol: 0, alice: 0, bob: 0 },
    };

    expect(reordered.gameId).toBe(initial.gameId);
    expect(validateGameStateV2(reordered)).toMatchObject({ ok: true });
  });

  it("does not share player, inventory, stack, or removed-zone references", () => {
    const state = createGameV2(["alice", "bob", "carol"], "isolated-players");
    const alice = state.players.alice;
    const bob = state.players.bob;

    expect(alice).not.toBe(bob);
    expect(alice.industryInventory).not.toBe(bob.industryInventory);
    expect(alice.industryInventory.stacks.manufacturer)
      .not.toBe(bob.industryInventory.stacks.manufacturer);
    expect(alice.removedIndustryTileIds).not.toBe(bob.removedIndustryTileIds);
    expect(alice.industryInventory).toEqual(bob.industryInventory);
  });

  it.each(PLAYER_COUNTS)(
    "conserves cards, per-player tiles, links, and Merchants at %i players",
    (playerCount) => {
      const state = createGameV2(seats(playerCount), `conserve-${playerCount}`);
      const regularCards = allRegularCards(state);
      const expectedCards = CARD_CATALOG.filter((card) =>
        (card.includedAt as readonly number[]).includes(playerCount),
      ).map((card) => card.id);

      expect([...regularCards].sort()).toEqual([...expectedCards].sort());
      expect(new Set(regularCards)).toHaveLength(regularCards.length);
      for (const player of Object.values(state.players)) {
        const tileIds = Object.values(player.industryInventory.stacks).flat();
        expect(tileIds).toEqual(INDUSTRY_TILES.map((tile) => tile.id));
        expect(new Set(tileIds)).toHaveLength(45);
        expect(player.linkTokensRemaining).toBe(14);
      }

      const placedMerchantIds = state.merchants.spaces.flatMap((space) =>
        space.tileId === null ? [] : [space.tileId],
      );
      const allMerchantIds = [
        ...placedMerchantIds,
        ...state.merchants.returnedToBox,
      ];
      expect([...allMerchantIds].sort()).toEqual(
        MERCHANT_TILE_CATALOG.map((tile) => tile.id).sort(),
      );
      expect(new Set(allMerchantIds)).toHaveLength(MERCHANT_TILE_CATALOG.length);
      expect(validateGameStateV2(state)).toMatchObject({ ok: true });
    },
  );

  it("survives a JSON round trip with deterministic event provenance", () => {
    const state = createGameV2(["__proto__", "constructor"], "json-round-trip");
    const restored = JSON.parse(JSON.stringify(state));

    expect(restored).toEqual(state);
    expect(requireValid(restored)).toEqual(state);
    expect(restored.players["__proto__"].industryInventory.stacks.iron)
      .toHaveLength(4);
    expect(state.events).toEqual([{
      sequence: 0,
      type: "GAME_CREATED",
      data: {
        gameId: state.gameId,
        seed: state.seed,
        setupSeeds: state.setupSeeds,
        seats: state.turnOrder,
        playerCount: 2,
        ruleset: { id: RULESET_META.id, version: RULESET_META.version },
      },
    }]);
  });

  it("records authoritative generated metadata rather than copied magic values", () => {
    const state = createGameV2(["alice", "bob"], "metadata");

    expect(GAME_STATE_V2_SCHEMA_VERSION).toBe(3);
    expect(state.ruleset).toEqual({
      id: RULESET_META.id,
      version: RULESET_META.version,
      dataSchemas: {
        ruleset: RULESET_META.schemaVersion,
        board: BOARD_V2.schemaVersion,
        boardRulesetId: BOARD_V2.rulesetId,
        cardsRuleset: "Brass: Birmingham (Roxley, 2018)",
        incomeTrack: INCOME_TRACK_DATA.schemaVersion,
        industryTiles: INDUSTRY_TILE_DATA_VERSION,
        merchantTiles: MERCHANT_TILE_DATA_META.schemaVersion,
        merchantRulesetId: MERCHANT_TILE_DATA_META.rulesetId,
      },
    });
    expect(state.players.alice.money).toBe(SETUP_DATA.shared.startingMoney);
    expect(state.players.alice.incomeMarkerSpace).toBe(
      INCOME_TRACK_DATA.track.startingSpace,
    );
    expect(state.progress).toEqual({ phase: "action" });
  });

  it("rejects malformed or boundary-inconsistent authoritative progress", () => {
    const initial = createGameV2(["alice", "bob"], "malformed-progress");
    const corruptions: unknown[] = [
      {},
      { phase: "unknown" },
      { phase: "round_settlement" },
      {
        phase: "merchant_free_develop",
        pending: {
          seat: "bob",
          count: 0,
          source: "merchant_bonus",
          merchantSpaceIds: ["not-a-merchant-space"],
        },
      },
      { phase: "ended", terminal: { standings: [] } },
    ];

    for (const progress of corruptions) {
      const invalid = {
        ...initial,
        progress,
      } as GameStateV2;
      const result = validateGameStateV2(invalid);
      expect(result).toMatchObject({ ok: false });
      if (result.ok) throw new Error("Expected invalid progress");
      expect(result.errors.map((error) => error.code)).toContain(
        "PROGRESS_STATE",
      );
    }
  });

  it("rejects malformed schema, identity, RNG, and turn state", () => {
    const initial = createGameV2(["alice", "bob"], "malformed-core");
    const mutations: Array<[string, (state: GameStateV2) => void]> = [
      ["SCHEMA_VERSION", (state) => { (state as { schemaVersion: number }).schemaVersion = 99; }],
      ["RULESET", (state) => { (state.ruleset as { version: string }).version = "other"; }],
      ["IDENTITY", (state) => { (state.setupSeeds as { cards: string }).cards = "shared"; }],
      ["RANDOM_STATE", (state) => { (state.randomState as { draws: number }).draws = -1; }],
      ["TURN_STATE", (state) => { (state as { actionLimit: 1 | 2 }).actionLimit = 2; }],
      ["TURN_STATE", (state) => { state.turnOrder[1] = "alice"; }],
    ];

    for (const [code, mutate] of mutations) {
      const invalid = structuredClone(initial);
      mutate(invalid);
      const result = validateGameStateV2(invalid);
      expect(result).toMatchObject({ ok: false });
      if (result.ok) throw new Error("Expected invalid state");
      expect(result.errors.map((error) => error.code)).toContain(code);
    }
  });

  it("detects card, tile, link, Merchant, board, market, and event corruption", () => {
    const initial = createGameV2(["alice", "bob"], "malformed-zones");
    const corruptions: Array<[string, (state: GameStateV2) => void]> = [
      ["CARD_CONSERVATION", (state) => { state.cards.hands.alice.pop(); }],
      ["TILE_CONSERVATION", (state) => {
        state.players.alice.industryInventory.stacks.iron.pop();
      }],
      ["LINK_CONSERVATION", (state) => {
        (state.players.alice as { linkTokensRemaining: number }).linkTokensRemaining = 13;
      }],
      ["MERCHANT_CONSERVATION", (state) => {
        state.merchants.returnedToBox.push(
          state.merchants.spaces.find((space) => space.tileId !== null)?.tileId as never,
        );
      }],
      ["BOARD_STATE", (state) => {
        (state.board.builtLinks as Record<string, string>).unknown = "alice";
      }],
      ["MARKET_STATE", (state) => { (state.market as { iron: number }).iron = 11; }],
      ["EVENT_LOG", (state) => { (state.events[0] as { sequence: number }).sequence = 2; }],
    ];

    for (const [code, corrupt] of corruptions) {
      const invalid = structuredClone(initial);
      corrupt(invalid);
      const result = validateGameStateV2(invalid);
      expect(result).toMatchObject({ ok: false });
      if (result.ok) throw new Error("Expected invalid state");
      expect(result.errors.map((error) => error.code)).toContain(code);
    }
  });

  it("rejects reordered stacks, mismatched build spaces, and wrong player-count Merchants", () => {
    const initial = createGameV2(["alice", "bob"], "deep-invariants");

    const reordered = structuredClone(initial);
    const manufacturer = reordered.players.alice.industryInventory.stacks.manufacturer;
    [manufacturer[0], manufacturer[1]] = [manufacturer[1], manufacturer[0]];
    const reorderedResult = validateGameStateV2(reordered);
    expect(reorderedResult).toMatchObject({ ok: false });
    if (reorderedResult.ok) throw new Error("Expected invalid stack order");
    expect(reorderedResult.errors.map((error) => error.code)).toContain(
      "PLAYER_STATE",
    );

    const mismatchedSpace = structuredClone(initial);
    const coalTileId = mismatchedSpace.players.alice.industryInventory.stacks.coal.shift();
    if (!coalTileId) throw new Error("Expected a coal tile");
    (mismatchedSpace.board.placedIndustries as Record<string, unknown>).cannock_2 = {
      owner: "alice",
      tileId: coalTileId,
      locationId: "birmingham",
      spaceId: "cannock_2",
      resources: { coal: 2, iron: 0, beer: 0 },
      flipped: false,
    };
    const boardResult = validateGameStateV2(mismatchedSpace);
    expect(boardResult).toMatchObject({ ok: false });
    if (boardResult.ok) throw new Error("Expected invalid board placement");
    expect(boardResult.errors.map((error) => error.code)).toContain("BOARD_STATE");

    const wrongMerchant = structuredClone(initial);
    const activeIndex = wrongMerchant.merchants.spaces.findIndex(
      (space) => space.active,
    );
    const fourPlayerTileIndex = wrongMerchant.merchants.returnedToBox.findIndex(
      (tileId) => tileId.endsWith("_4p"),
    );
    if (activeIndex < 0 || fourPlayerTileIndex < 0) {
      throw new Error("Expected active and returned Merchant tiles");
    }
    const activeTileId = wrongMerchant.merchants.spaces[activeIndex].tileId;
    const fourPlayerTileId = wrongMerchant.merchants.returnedToBox[fourPlayerTileIndex];
    wrongMerchant.merchants.spaces[activeIndex].tileId = fourPlayerTileId;
    wrongMerchant.merchants.returnedToBox[fourPlayerTileIndex] = activeTileId as never;
    const merchantResult = validateGameStateV2(wrongMerchant);
    expect(merchantResult).toMatchObject({ ok: false });
    if (merchantResult.ok) throw new Error("Expected invalid Merchant band");
    expect(merchantResult.errors.map((error) => error.code)).toContain(
      "MERCHANT_CONSERVATION",
    );
  });

  it("rejects non-objects, non-JSON values, invalid seats, and non-string seeds", () => {
    expect(validateGameStateV2(null)).toMatchObject({
      ok: false,
      errors: [{ code: "NOT_AN_OBJECT", path: "$" }],
    });

    const nonJson = createGameV2(["alice", "bob"], "non-json");
    (nonJson as unknown as Record<string, unknown>).bad = Number.NaN;
    const validation = validateGameStateV2(nonJson);
    expect(validation).toMatchObject({ ok: false });
    if (validation.ok) throw new Error("Expected invalid state");
    expect(validation.errors.map((error) => error.code)).toContain("NOT_JSON_SAFE");

    expect(() => createGameV2(["alice"], "seed")).toThrow(/2–4/);
    expect(() => createGameV2(["alice", "alice"], "seed")).toThrow(/unique/);
    expect(() => createGameV2(["alice", ""], "seed")).toThrow(/nonempty/);
    expect(() => createGameV2(["alice", "bob"], 42 as never)).toThrow(TypeError);
  });
});

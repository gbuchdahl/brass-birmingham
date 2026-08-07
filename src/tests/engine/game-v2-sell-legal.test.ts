import { describe, expect, it } from "vitest";
import type {
  SellActionSelection,
  SellTileSelection,
} from "@/engine/actions-v2/sell";
import { executeSellForGameV2 } from "@/engine/game-v2/action-adapters";
import {
  executeGameV2Command,
  type GameV2CommandEnvelope,
} from "@/engine/game-v2/commands";
import {
  getGameV2SellLegalOptions,
  type GameV2SellLegalOptions,
} from "@/engine/game-v2/sell-legal";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import type { IndustryTileKind } from "@/engine/rules/generated/industry-tiles-v2";

function requireValid(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  expect(validation).toMatchObject({ ok: true });
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
}

function placeTopTile(
  state: GameStateV2,
  owner: string,
  spaceId: string,
  locationId: string,
  industry: IndustryTileKind,
  beer = 0,
): GameStateV2 {
  const player = state.players[owner];
  const stack = player.industryInventory.stacks[industry];
  const tileId = stack[0];
  if (!tileId) throw new Error(`No ${industry} tile for ${owner}.`);
  const placement: PlacedIndustryStateV2 = {
    owner,
    tileId,
    locationId,
    spaceId,
    resources: { coal: 0, iron: 0, beer },
    flipped: false,
  };
  return {
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
        [spaceId]: placement,
      },
    },
  };
}

function linkPath(
  from: string,
  to: string,
  era: GameStateV2["era"],
): readonly string[] {
  const queue: Array<{
    readonly locationId: string;
    readonly links: readonly string[];
  }> = [{ locationId: from, links: [] }];
  const visited = new Set([from]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.locationId === to) return current.links;
    for (const link of BOARD_V2.links) {
      if (!(link.eras as readonly string[]).includes(era)) continue;
      if (!(link.adjacentLocations as readonly string[]).includes(current.locationId)) {
        continue;
      }
      for (const locationId of link.adjacentLocations) {
        if (visited.has(locationId)) continue;
        visited.add(locationId);
        queue.push({
          locationId,
          links: [...current.links, link.id],
        });
      }
    }
  }
  throw new Error(`No ${era} path from ${from} to ${to}.`);
}

function withLinks(
  state: GameStateV2,
  owner: string,
  linkIds: readonly string[],
): GameStateV2 {
  const newIds = [...new Set(linkIds)].filter(
    (linkId) => state.board.builtLinks[linkId] === undefined,
  );
  const player = state.players[owner];
  if (newIds.length > player.linkTokensRemaining) {
    throw new Error(`Too many fixture links for ${owner}.`);
  }
  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...player,
        linkTokensRemaining: player.linkTokensRemaining - newIds.length,
      },
    },
    board: {
      ...state.board,
      builtLinks: {
        ...state.board.builtLinks,
        ...Object.fromEntries(newIds.map((linkId) => [linkId, owner])),
      },
    },
  };
}

function withUniversalMerchantAt(
  state: GameStateV2,
  locationId: string,
): {
  readonly state: GameStateV2;
  readonly merchantSpaceId: string;
} {
  const target = state.merchants.spaces.find(
    (space) => space.active && space.locationId === locationId,
  );
  const donor = state.merchants.spaces.find(
    (space) =>
      space.active &&
      space.demandIndustries.length === 3 &&
      space.beer === 1,
  );
  if (!target || !donor || target.tileId === null || donor.tileId === null) {
    throw new Error(`Expected active universal Merchant fixture at ${locationId}.`);
  }
  if (target.merchantSpaceId === donor.merchantSpaceId) {
    return { state, merchantSpaceId: target.merchantSpaceId };
  }
  return {
    state: {
      ...state,
      merchants: {
        ...state.merchants,
        spaces: state.merchants.spaces.map((space) => {
          if (space.merchantSpaceId === target.merchantSpaceId) {
            return {
              ...space,
              tileId: donor.tileId,
              demandIndustries: [...donor.demandIndustries],
              beer: donor.beer,
            };
          }
          if (space.merchantSpaceId === donor.merchantSpaceId) {
            return {
              ...space,
              tileId: target.tileId,
              demandIndustries: [...target.demandIndustries],
              beer: target.beer,
            };
          }
          return space;
        }),
      },
    },
    merchantSpaceId: target.merchantSpaceId,
  };
}

function withMerchantBeer(
  state: GameStateV2,
  merchantSpaceId: string,
  beer: 0 | 1,
): GameStateV2 {
  return {
    ...state,
    merchants: {
      ...state.merchants,
      spaces: state.merchants.spaces.map((space) =>
        space.merchantSpaceId === merchantSpaceId
          ? { ...space, beer }
          : space
      ),
    },
  };
}

function command(
  state: GameStateV2,
  actorSeat: string,
  selection: SellActionSelection,
): GameV2CommandEnvelope {
  return {
    schemaVersion: 1,
    commandId: `sell-legal-${selection.sales.length}`,
    gameId: state.gameId,
    expectedRevision: state.revision,
    actorSeat,
    command: {
      type: "SELL",
      selection,
    },
  };
}

function expectEveryPlanAccepted(
  state: GameStateV2,
  actorSeat: string,
  options: GameV2SellLegalOptions,
): void {
  for (const [index, option] of options.nextSales.entries()) {
    const envelope = command(state, actorSeat, option.plan.selection);
    const result = executeGameV2Command(state, {
      ...envelope,
      commandId: `${envelope.commandId}-${index}`,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.ok).toBe(true);
  }
}

function sellFixture(
  seed: string,
  playerCount: 2 | 3 | 4,
  merchantLocationId: string,
  productSpaceId: string,
  productLocationId: string,
): {
  readonly state: GameStateV2;
  readonly merchantSpaceId: string;
} {
  const seats = ["alice", "bob", "carol", "dave"].slice(0, playerCount);
  const base = createGameV2(seats, seed);
  const merchant = withUniversalMerchantAt(base, merchantLocationId);
  let state = placeTopTile(
    merchant.state,
    "alice",
    productSpaceId,
    productLocationId,
    "manufacturer",
  );
  state = withLinks(
    state,
    "bob",
    linkPath(productLocationId, merchantLocationId, state.era),
  );
  requireValid(state);
  return { state, merchantSpaceId: merchant.merchantSpaceId };
}

describe("exact progressive GameStateV2 Sell selector", () => {
  it("projects Gloucester's pending free Develop and emits reducer-ready plans", () => {
    const fixture = sellFixture(
      "sell-legal-gloucester",
      2,
      "merchant_gloucester",
      "birmingham_1",
      "birmingham",
    );
    let state = placeTopTile(
      fixture.state,
      "alice",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = placeTopTile(
      state,
      "alice",
      "farm_brewery_cannock_1",
      "farm_brewery_cannock",
      "brewery",
      1,
    );
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const options = getGameV2SellLegalOptions(
      state,
      "alice",
      cardId,
    );
    expectEveryPlanAccepted(state, "alice", options);

    expect(options.availability).toBe("exact");
    const gloucester = options.nextSales.find(
      (option) =>
        option.sale.industryId === "birmingham_1" &&
        option.sale.merchantSpaceId === fixture.merchantSpaceId,
    );
    expect(gloucester).toMatchObject({
      industry: {
        locationLabel: "Birmingham",
        industryLabel: "Manufacturer",
      },
      merchant: { locationLabel: "Gloucester" },
      beer: {
        kind: "merchant",
        bonus: { kind: "free_develop", amount: 1 },
      },
      plan: {
        actionsConsumed: 1,
        moneySpent: 0,
        rewards: { freeDevelops: 1 },
        resultingProgressPhase: "merchant_free_develop",
        pendingFollowUp: {
          kind: "free_develop",
          seat: "alice",
          count: 1,
          source: "merchant_bonus",
          merchantSpaceIds: [fixture.merchantSpaceId],
        },
      },
    });
    if (!gloucester) throw new Error("Expected Gloucester Sell option.");

    const reduced = executeGameV2Command(
      state,
      command(state, "alice", gloucester.plan.selection),
    );
    expect(reduced).toMatchObject({
      ok: true,
      outcome: { pendingFollowUp: true },
      state: { progress: { phase: "merchant_free_develop" } },
    });

    const continuation = getGameV2SellLegalOptions(
      state,
      "alice",
      cardId,
      gloucester.plan.selection.sales,
    );
    expect(continuation.currentPlan?.pendingFollowUp).toMatchObject({
      kind: "free_develop",
      count: 1,
    });
    const secondSale = continuation.nextSales.find(
      (option) =>
        option.sale.industryId === "birmingham_2" &&
        option.sale.merchantSpaceId === fixture.merchantSpaceId &&
        option.sale.beerSource.kind === "brewery",
    );
    expect(secondSale?.plan).toMatchObject({
      soldIndustryIds: ["birmingham_1", "birmingham_2"],
      pendingFollowUp: { kind: "free_develop", count: 1 },
      resultingProgressPhase: "merchant_free_develop",
    });
    expectEveryPlanAccepted(state, "alice", continuation);
    if (!secondSale) throw new Error("Expected atomic Gloucester continuation.");
    expect(
      executeGameV2Command(
        state,
        command(state, "alice", secondSale.plan.selection),
      ),
    ).toMatchObject({
      ok: true,
      outcome: { pendingFollowUp: true },
    });
  });

  it("projects Merchant money rewards and enforces Merchant-beer priority", () => {
    const fixture = sellFixture(
      "sell-legal-warrington",
      3,
      "merchant_warrington",
      "stoke_on_trent_1",
      "stoke_on_trent",
    );
    let state = placeTopTile(
      fixture.state,
      "alice",
      "farm_brewery_cannock_1",
      "farm_brewery_cannock",
      "brewery",
      1,
    );
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const options = getGameV2SellLegalOptions(state, "alice", cardId);
    const targetOptions = options.nextSales.filter(
      (option) =>
        option.sale.industryId === "stoke_on_trent_1" &&
        option.sale.merchantSpaceId === fixture.merchantSpaceId,
    );

    expect(targetOptions).toHaveLength(1);
    expect(targetOptions[0]).toMatchObject({
      beer: {
        kind: "merchant",
        bonus: { kind: "money", amount: 5 },
      },
      plan: {
        moneySpent: 0,
        playerResult: { moneyChange: 5 },
        rewards: { money: 5 },
      },
    });

    state = withMerchantBeer(state, fixture.merchantSpaceId, 0);
    requireValid(state);
    const breweryOptions = getGameV2SellLegalOptions(state, "alice", cardId)
      .nextSales.filter(
        (option) =>
          option.sale.industryId === "stoke_on_trent_1" &&
          option.sale.merchantSpaceId === fixture.merchantSpaceId,
      );
    expect(breweryOptions).toHaveLength(1);
    expect(breweryOptions[0]).toMatchObject({
      beer: {
        kind: "brewery",
        industryId: "farm_brewery_cannock_1",
        own: true,
        beerRemaining: 0,
        depleted: true,
      },
      plan: { rewards: { money: 0 } },
    });
  });

  it("extends accepted prefixes without losing equivalent sale orders", () => {
    const merchant = withUniversalMerchantAt(
      createGameV2(["alice", "bob"], "sell-legal-progressive"),
      "merchant_oxford",
    );
    let state = placeTopTile(
      merchant.state,
      "alice",
      "birmingham_1",
      "birmingham",
      "manufacturer",
    );
    state = placeTopTile(
      state,
      "alice",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = placeTopTile(
      state,
      "alice",
      "farm_brewery_cannock_1",
      "farm_brewery_cannock",
      "brewery",
      1,
    );
    state = withLinks(
      state,
      "bob",
      linkPath("birmingham", "merchant_oxford", state.era),
    );
    requireValid(state);
    const snapshot = structuredClone(state);
    const cardId = state.cards.hands.alice[0];
    const initial = getGameV2SellLegalOptions(state, "alice", cardId);
    expectEveryPlanAccepted(state, "alice", initial);

    const firstById = (industryId: string) => initial.nextSales.find(
      (option) =>
        option.sale.industryId === industryId &&
        option.sale.merchantSpaceId === merchant.merchantSpaceId,
    );
    const firstA = firstById("birmingham_1");
    const firstB = firstById("birmingham_2");
    if (!firstA || !firstB) throw new Error("Expected both first-sale orders.");
    expect(firstA.beer.kind).toBe("merchant");
    expect(firstB.beer.kind).toBe("merchant");

    const extend = (first: typeof firstA, secondIndustryId: string) => {
      const layer = getGameV2SellLegalOptions(
        state,
        "alice",
        cardId,
        first.plan.selection.sales,
      );
      expect(layer.currentPlan?.selection).toEqual(first.plan.selection);
      expectEveryPlanAccepted(state, "alice", layer);
      const second = layer.nextSales.find(
        (option) =>
          option.sale.industryId === secondIndustryId &&
          option.sale.merchantSpaceId === merchant.merchantSpaceId &&
          option.sale.beerSource.kind === "brewery",
      );
      if (!second) throw new Error("Expected Brewery-backed continuation.");
      expect(second.plan.selection.sales).toHaveLength(2);
      return second;
    };
    const ab = extend(firstA, "birmingham_2");
    const ba = extend(firstB, "birmingham_1");
    const resultAB = executeSellForGameV2(state, ab.plan.selection);
    const resultBA = executeSellForGameV2(state, ba.plan.selection);
    expect(resultAB.ok).toBe(true);
    expect(resultBA.ok).toBe(true);
    if (!resultAB.ok || !resultBA.ok) throw new Error("Expected accepted orders.");
    expect(resultAB.state).toEqual(resultBA.state);
    expect(state).toEqual(snapshot);
  });

  it("rejects disconnected opponent beer and fails closed at common boundaries", () => {
    const fixture = sellFixture(
      "sell-legal-blockers",
      2,
      "merchant_oxford",
      "birmingham_1",
      "birmingham",
    );
    let state = withMerchantBeer(
      fixture.state,
      fixture.merchantSpaceId,
      0,
    );
    state = placeTopTile(
      state,
      "bob",
      "stafford_1",
      "stafford",
      "brewery",
      1,
    );
    requireValid(state);
    const cardId = state.cards.hands.alice[0];

    const blockedMerchant = getGameV2SellLegalOptions(
      state,
      "alice",
      cardId,
    ).nextSales.filter(
      (option) =>
        option.sale.industryId === "birmingham_1" &&
        option.sale.merchantSpaceId === fixture.merchantSpaceId,
    );
    expect(blockedMerchant).toEqual([]);
    expect(getGameV2SellLegalOptions(state, "bob", cardId)).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_CURRENT_ACTOR" },
    });
    expect(
      getGameV2SellLegalOptions(
        { ...state, actionsUsed: state.actionLimit },
        "alice",
        cardId,
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "ACTION_LIMIT_REACHED" },
    });
    expect(
      getGameV2SellLegalOptions(
        state,
        "alice",
        state.cards.hands.bob[0],
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "CARD_NOT_IN_HAND" },
    });
    expect(
      getGameV2SellLegalOptions(
        { ...state, schemaVersion: 999 } as unknown as GameStateV2,
        "alice",
        cardId,
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_GAME_STATE" },
    });
  });

  it("rejects a non-authoritative prefix and remains deterministic and immutable", () => {
    const fixture = sellFixture(
      "sell-legal-pure",
      2,
      "merchant_oxford",
      "birmingham_1",
      "birmingham",
    );
    const state = fixture.state;
    const cardId = state.cards.hands.alice[0];
    const snapshot = structuredClone(state);
    const prefix: readonly SellTileSelection[] = [{
      industryId: "birmingham_1",
      merchantSpaceId: fixture.merchantSpaceId,
      beerSource: { kind: "merchant" },
    }];
    const prefixSnapshot = structuredClone(prefix);
    const first = getGameV2SellLegalOptions(state, "alice", cardId);
    const second = getGameV2SellLegalOptions(state, "alice", cardId);

    expect(first).toEqual(second);
    expect(state).toEqual(snapshot);
    getGameV2SellLegalOptions(state, "alice", cardId, prefix);
    expect(prefix).toEqual(prefixSnapshot);
    expect(
      getGameV2SellLegalOptions(state, "alice", cardId, [{
        industryId: "missing",
        merchantSpaceId: fixture.merchantSpaceId,
        beerSource: { kind: "merchant" },
      }]),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_SALE_PREFIX" },
    });
    expect(
      getGameV2SellLegalOptions(
        state,
        "alice",
        cardId,
        [{
          industryId: "birmingham_1",
          merchantSpaceId: fixture.merchantSpaceId,
          beerSource: null,
        }] as unknown as readonly SellTileSelection[],
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_SALE_PREFIX" },
    });
    expect(state).toEqual(snapshot);
  });

  it("collapses choices whose empty Merchants produce the same material state", () => {
    let fixture: ReturnType<typeof withUniversalMerchantAt> | null = null;
    for (let index = 0; index < 100; index += 1) {
      const candidate = withUniversalMerchantAt(
        createGameV2(["alice", "bob"], `sell-legal-dedup-${index}`),
        "merchant_oxford",
      );
      const matchingOxfordSpaces = candidate.state.merchants.spaces.filter(
        (space) =>
          space.active &&
          space.locationId === "merchant_oxford" &&
          space.demandIndustries.includes("manufacturer"),
      );
      if (matchingOxfordSpaces.length === 2) {
        fixture = candidate;
        break;
      }
    }
    if (!fixture) throw new Error("Expected two Oxford manufacturer Merchants.");

    let state = {
      ...fixture.state,
      merchants: {
        ...fixture.state.merchants,
        spaces: fixture.state.merchants.spaces.map((space) =>
          space.locationId === "merchant_oxford" &&
            space.demandIndustries.includes("manufacturer")
            ? { ...space, beer: 0 as const }
            : space
        ),
      },
    };
    state = placeTopTile(
      state,
      "alice",
      "birmingham_1",
      "birmingham",
      "manufacturer",
    );
    state = placeTopTile(
      state,
      "alice",
      "farm_brewery_cannock_1",
      "farm_brewery_cannock",
      "brewery",
      1,
    );
    state = withLinks(
      state,
      "bob",
      linkPath("birmingham", "merchant_oxford", state.era),
    );
    requireValid(state);
    const options = getGameV2SellLegalOptions(
      state,
      "alice",
      state.cards.hands.alice[0],
    );
    const oxfordBrewerySales = options.nextSales.filter(
      (option) =>
        option.sale.industryId === "birmingham_1" &&
        option.merchant.locationId === "merchant_oxford" &&
        option.beer.kind === "brewery",
    );

    expect(oxfordBrewerySales).toHaveLength(1);
    const materialStates = options.nextSales.map((option) => {
      const result = executeSellForGameV2(state, option.plan.selection);
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return JSON.stringify(result.state);
    });
    expect(new Set(materialStates).size).toBe(materialStates.length);
  });

  it("keeps a dense physical decision layer bounded and fast", () => {
    const merchant = withUniversalMerchantAt(
      createGameV2(
        ["alice", "bob", "carol", "dave"],
        "sell-legal-dense",
      ),
      "merchant_oxford",
    );
    let state = withMerchantBeer(
      merchant.state,
      merchant.merchantSpaceId,
      0,
    );
    for (const [spaceId, locationId] of [
      ["birmingham_1", "birmingham"],
      ["birmingham_2", "birmingham"],
      ["birmingham_4", "birmingham"],
      ["coventry_2", "coventry"],
      ["coventry_3", "coventry"],
    ] as const) {
      state = placeTopTile(
        state,
        "alice",
        spaceId,
        locationId,
        "manufacturer",
      );
    }
    for (const [owner, spaceId, locationId] of [
      ["alice", "farm_brewery_cannock_1", "farm_brewery_cannock"],
      ["bob", "stafford_1", "stafford"],
      ["carol", "burton_on_trent_2", "burton_on_trent"],
      ["dave", "stone_1", "stone"],
    ] as const) {
      state = placeTopTile(state, owner, spaceId, locationId, "brewery", 1);
    }
    state = withLinks(state, "bob", [
      ...linkPath("birmingham", "merchant_oxford", state.era),
      ...linkPath("coventry", "merchant_oxford", state.era),
    ]);
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const started = performance.now();
    const options = getGameV2SellLegalOptions(state, "alice", cardId);
    const elapsed = performance.now() - started;

    expect(options.availability).toBe("exact");
    expect(options.nextSales.length).toBeGreaterThanOrEqual(5);
    expect(options.nextSales.length).toBeLessThanOrEqual(5 * 9 * 5);
    expect(elapsed).toBeLessThan(1_500);
    const materialStates = options.nextSales.map((option) => {
      const result = executeSellForGameV2(state, option.plan.selection);
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return JSON.stringify(result.state);
    });
    expect(new Set(materialStates).size).toBe(materialStates.length);
  });
});

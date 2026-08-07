import { describe, expect, it } from "vitest";
import type { BuildActionSelection } from "@/engine/actions-v2/build";
import type { DevelopActionSelection } from "@/engine/actions-v2/develop";
import type { NetworkActionSelection } from "@/engine/actions-v2/network";
import type { SellActionSelection } from "@/engine/actions-v2/sell";
import * as actionAdapters from "@/engine/game-v2/action-adapters";
import {
  executeBuildForGameV2,
  executeDevelopForGameV2,
  executeLoanForGameV2,
  executeNetworkForGameV2,
  executePassForGameV2,
  executeScoutForGameV2,
  executeSellForGameV2,
} from "@/engine/game-v2/action-adapters";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { applyAcceptedActionV2 } from "@/engine/game-v2/turn-lifecycle";
import { advanceIncomeSpaces } from "@/engine/economy/income";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
} from "@/engine/rules/generated/industry-tiles-v2";
import type { PlayableCardId } from "@/engine/cards-v2/types";

function card(templateId: string): PlayableCardId {
  const match = CARD_CATALOG.find((candidate) => candidate.templateId === templateId);
  if (!match) throw new Error(`Missing card template: ${templateId}`);
  return match.id;
}

function withCard(state: GameStateV2, cardId: PlayableCardId): GameStateV2 {
  const seat = state.currentSeat;
  const hands = Object.fromEntries(
    Object.entries(state.cards.hands).map(([handSeat, hand]) => [
      handSeat,
      [...hand],
    ]),
  ) as GameStateV2["cards"]["hands"];
  const draw = [...state.cards.draw];
  const discard = [...state.cards.discard];
  const hand = hands[seat];
  const existingIndex = hand.indexOf(cardId);
  if (existingIndex >= 0) {
    [hand[0], hand[existingIndex]] = [hand[existingIndex], hand[0]];
  } else {
    const displaced = hand[0];
    let found = false;
    for (const otherSeat of state.turnOrder) {
      const source = hands[otherSeat];
      const index = source.indexOf(cardId);
      if (index < 0) continue;
      source[index] = displaced;
      found = true;
      break;
    }
    if (!found) {
      const drawIndex = draw.indexOf(cardId as (typeof draw)[number]);
      if (drawIndex >= 0) {
        draw[drawIndex] = displaced as (typeof draw)[number];
        found = true;
      }
    }
    if (!found) {
      const discardIndex = discard.indexOf(cardId as (typeof discard)[number]);
      if (discardIndex >= 0) {
        discard[discardIndex] = displaced as (typeof discard)[number];
        found = true;
      }
    }
    if (!found) throw new Error(`Card is not conserved in the fixture: ${cardId}`);
    hand[0] = cardId;
  }
  return {
    ...state,
    cards: {
      ...state.cards,
      hands,
      draw,
      discard,
    },
  };
}

function placed(
  owner: string,
  spaceId: string,
  locationId: string,
  tileId: IndustryTileId,
  resources: Partial<PlacedIndustryStateV2["resources"]> = {},
  flipped = false,
): PlacedIndustryStateV2 {
  return {
    owner,
    tileId,
    locationId,
    spaceId,
    resources: {
      coal: resources.coal ?? 0,
      iron: resources.iron ?? 0,
      beer: resources.beer ?? 0,
    },
    flipped,
  };
}

function withPlacedIndustry(
  state: GameStateV2,
  placement: PlacedIndustryStateV2,
): GameStateV2 {
  const tile = INDUSTRY_TILE_BY_ID[placement.tileId];
  const player = state.players[placement.owner];
  if (!player) throw new Error(`Unknown placement owner: ${placement.owner}`);
  const stack = player.industryInventory.stacks[tile.industry];
  const index = stack.indexOf(placement.tileId);
  if (index < 0) throw new Error(`Tile unavailable in fixture: ${placement.tileId}`);
  return {
    ...state,
    players: {
      ...state.players,
      [placement.owner]: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            [tile.industry]: stack.slice(index + 1),
          },
        },
        removedIndustryTileIds: [
          ...player.removedIndustryTileIds,
          ...stack.slice(0, index),
        ],
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        [placement.spaceId]: placement,
      },
    },
  };
}

function asRail(state: GameStateV2): GameStateV2 {
  return { ...state, era: "rail", actionLimit: 2 };
}

function linkPath(
  from: string,
  to: string,
  era: GameStateV2["era"],
): string[] {
  const queue: { readonly locationId: string; readonly linkIds: string[] }[] = [{
    locationId: from,
    linkIds: [],
  }];
  const visited = new Set([from]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.locationId === to) return current.linkIds;
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
          linkIds: [...current.linkIds, link.id],
        });
      }
    }
  }
  throw new Error(`No ${era} link path from ${from} to ${to}`);
}

function withBuiltLinks(
  state: GameStateV2,
  owner: string,
  linkIds: readonly string[],
): GameStateV2 {
  const uniqueIds = [...new Set(linkIds)];
  const player = state.players[owner];
  if (uniqueIds.length > player.linkTokensRemaining) {
    throw new Error(`Too many fixture links for ${owner}`);
  }
  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...player,
        linkTokensRemaining: player.linkTokensRemaining - uniqueIds.length,
      },
    },
    board: {
      ...state.board,
      builtLinks: {
        ...state.board.builtLinks,
        ...Object.fromEntries(uniqueIds.map((linkId) => [linkId, owner])),
      },
    },
  };
}

function requireValid(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  expect(validation).toMatchObject({ ok: true });
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
}

function requireSuccess<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`Expected adapter success: ${JSON.stringify(result)}`);
  expect(result.ok).toBe(true);
}

function expectLifecycleUnchanged(before: GameStateV2, after: GameStateV2): void {
  expect(after.revision).toBe(before.revision);
  expect(after.turnNumber).toBe(before.turnNumber);
  expect(after.currentSeat).toBe(before.currentSeat);
  expect(after.actionsUsed).toBe(before.actionsUsed);
  expect(after.roundSpend).toBe(before.roundSpend);
}

describe("GameStateV2 action adapter boundary", () => {
  it("keeps projections private and isolates kernel card state from the input", () => {
    expect(Object.keys(actionAdapters).some((key) => key.startsWith("project")))
      .toBe(false);
    const state = createGameV2(["alice", "bob"], "adapter-boundary");
    requireValid(state);
    const bobFirstCard = state.cards.hands.bob[0];
    const result = executePassForGameV2(state, state.cards.hands.alice[0]);
    requireSuccess(result);
    requireValid(result.state);
    result.state.cards.hands.bob[0] = result.state.cards.hands.bob[1];
    expect(state.cards.hands.bob[0]).toBe(bobFirstCard);
  });
});

describe("simple GameStateV2 action adapters", () => {
  it("merges Pass, Scout, and Loan without touching lifecycle fields", () => {
    const passState = createGameV2(["alice", "bob"], "adapter-pass");
    requireValid(passState);
    const passCard = passState.cards.hands.alice[0];
    const passed = executePassForGameV2(passState, passCard);
    requireSuccess(passed);
    requireValid(passed.state);
    expect(passed.state.cards.hands.alice).not.toContain(passCard);
    expectLifecycleUnchanged(passState, passed.state);

    const scoutState = createGameV2(["alice", "bob"], "adapter-scout");
    requireValid(scoutState);
    const cards = scoutState.cards.hands.alice.slice(0, 3) as [
      PlayableCardId,
      PlayableCardId,
      PlayableCardId,
    ];
    const scouted = executeScoutForGameV2(scoutState, { cardsToDiscard: cards });
    requireSuccess(scouted);
    requireValid(scouted.state);
    expect(scouted.state.cards.hands.alice).toContain("wild-location");
    expect(scouted.state.cards.hands.alice).toContain("wild-industry");
    expectLifecycleUnchanged(scoutState, scouted.state);

    const loanState = createGameV2(["alice", "bob"], "adapter-loan");
    requireValid(loanState);
    const loanCard = loanState.cards.hands.alice[0];
    const loaned = executeLoanForGameV2(loanState, loanCard);
    requireSuccess(loaned);
    requireValid(loaned.state);
    expect(loaned.state.players.alice).toMatchObject({
      money: loanState.players.alice.money + 30,
      incomeMarkerSpace: 7,
    });
    expect(loaned.effect.incomeAwards).toEqual([]);
    expectLifecycleUnchanged(loanState, loaned.state);
  });

  it("returns exact original state for active-player and kernel rejection", () => {
    const base = createGameV2(["alice", "bob"], "adapter-atomic");
    requireValid(base);
    const invalidActive = { ...base, currentSeat: "ghost" } as GameStateV2;
    const invalidResult = executePassForGameV2(
      invalidActive,
      base.cards.hands.alice[0],
    );
    expect(invalidResult).toMatchObject({
      ok: false,
      error: { code: "INVALID_ACTIVE_PLAYER" },
    });
    expect(invalidResult.state).toBe(invalidActive);

    const missing = executeLoanForGameV2(base, "wild-location");
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missing.state).toBe(base);
    expect(JSON.parse(JSON.stringify(missing))).toEqual(missing);
  });

  it("atomically rejects malformed Network link selections", () => {
    const state = createGameV2(["alice", "bob"], "adapter-network-malformed");
    requireValid(state);
    const malformed = [
      {},
      { linkIds: null },
    ] as unknown as readonly NetworkActionSelection[];

    for (const selection of malformed) {
      let result: ReturnType<typeof executeNetworkForGameV2> | undefined;
      expect(() => {
        result = executeNetworkForGameV2(state, selection);
      }).not.toThrow();
      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_LINK_COUNT" },
      });
      expect(result?.state).toBe(state);
      requireValid(state);
    }
  });
});

describe("board and inventory adapter merges", () => {
  it("merges Build overbuilding, inventory conservation, and provider flip income", () => {
    const coalCard = card("industry-coal-mine");
    const base = withCard(
      asRail(createGameV2(["alice", "bob"], "adapter-build-overbuild")),
      coalCard,
    );
    let state = withPlacedIndustry(
      base,
      placed(
        "alice",
        "cannock_2",
        "cannock",
        "coal-2-b",
        {},
        true,
      ),
    );
    state = withPlacedIndustry(
      state,
      placed(
        "bob",
        "birmingham_3",
        "birmingham",
        "iron-2-a",
        { iron: 1 },
      ),
    );
    state = {
      ...state,
      players: {
        ...state.players,
        alice: {
          ...state.players.alice,
          money: 8,
        },
      },
    };
    requireValid(state);
    const selection: BuildActionSelection = {
      buildSpaceId: "cannock_2",
      industry: "coal",
      cardId: coalCard,
      coalSources: [],
      ironSources: [{ kind: "works", buildSpaceId: "birmingham_3" }],
    };
    const result = executeBuildForGameV2(state, selection);
    requireSuccess(result);
    requireValid(result.state);

    expect(result.state.board.placedIndustries.cannock_2.tileId).toBe("coal-3-a");
    expect(result.state.players.alice.removedIndustryTileIds)
      .toContain("coal-2-b");
    expect(result.state.players.alice.industryInventory.stacks.coal[0])
      .not.toBe("coal-3-a");
    expect(result.state.board.placedIndustries.birmingham_3.flipped).toBe(true);
    const ironIncome = INDUSTRY_TILE_BY_ID["iron-2-a"].incomeSteps;
    expect(result.state.players.bob.incomeMarkerSpace).toBe(
      advanceIncomeSpaces(base.players.bob.incomeMarkerSpace, ironIncome),
    );
    expect(result.effect.incomeAwards).toEqual([
      expect.objectContaining({
        buildSpaceId: "birmingham_3",
        owner: "bob",
        tileId: "iron-2-a",
      }),
    ]);
    expectLifecycleUnchanged(state, result.state);
  });

  it("merges Develop removals and awards depleted Iron Works income once", () => {
    const base = createGameV2(["alice", "bob"], "adapter-develop");
    const cardId = base.cards.hands.alice[0];
    const state = withPlacedIndustry(
      base,
      placed(
        "bob",
        "birmingham_3",
        "birmingham",
        "iron-1-a",
        { iron: 1 },
      ),
    );
    requireValid(state);
    const selection: DevelopActionSelection = {
      cardId,
      tileIds: ["coal-1-a"],
      accessibleIronIndustryIds: ["birmingham_3"],
      purchaseMarketShortfall: false,
    };
    const result = executeDevelopForGameV2(state, selection);
    requireSuccess(result);
    requireValid(result.state);

    expect(result.state.players.alice.removedIndustryTileIds)
      .toContain("coal-1-a");
    expect(result.state.board.placedIndustries.birmingham_3).toMatchObject({
      resources: { iron: 0 },
      flipped: true,
    });
    expect(result.state.players.bob.incomeMarkerSpace).toBe(
      advanceIncomeSpaces(10, INDUSTRY_TILE_BY_ID["iron-1-a"].incomeSteps),
    );
    expect(result.effect.incomeAwards).toHaveLength(1);
  });

  it("merges Network links, decrements tokens, and awards Coal Mine income", () => {
    const base = asRail(createGameV2(["alice", "bob"], "adapter-network"));
    const cardId = base.cards.hands.alice[0];
    let state = withPlacedIndustry(
      base,
      placed(
        "alice",
        "birmingham_1",
        "birmingham",
        "manufacturer-2-a",
      ),
    );
    state = withPlacedIndustry(
      state,
      placed(
        "bob",
        "nuneaton_2",
        "nuneaton",
        "coal-2-a",
        { coal: 1 },
      ),
    );
    state = {
      ...state,
      players: {
        ...state.players,
        alice: { ...state.players.alice, money: 5 },
      },
    };
    requireValid(state);
    const selection: NetworkActionSelection = {
      linkIds: ["link_birmingham_nuneaton"],
      coalSources: [{ kind: "mine", industryId: "nuneaton_2" }],
      beerSourceId: null,
      cardId,
    };
    const result = executeNetworkForGameV2(state, selection);
    requireSuccess(result);
    requireValid(result.state);

    expect(result.state.board.builtLinks.link_birmingham_nuneaton).toBe("alice");
    expect(result.state.players.alice.linkTokensRemaining).toBe(
      state.players.alice.linkTokensRemaining - 1,
    );
    expect(result.state.board.placedIndustries.nuneaton_2.flipped).toBe(true);
    expect(result.state.players.bob.incomeMarkerSpace).toBe(
      advanceIncomeSpaces(10, INDUSTRY_TILE_BY_ID["coal-2-a"].incomeSteps),
    );
    expect(result.effect.incomeAwards).toHaveLength(1);

    const noTokenBase = createGameV2(["alice", "bob"], "adapter-no-tokens");
    const canalLinks = BOARD_V2.links.filter((link) =>
      (link.eras as readonly string[]).includes("canal") &&
      link.id !== "link_birmingham_coventry"
    );
    const noTokens = withBuiltLinks(
      noTokenBase,
      "alice",
      canalLinks.slice(0, noTokenBase.players.alice.linkTokensRemaining)
        .map((link) => link.id),
    );
    requireValid(noTokens);
    const rejected = executeNetworkForGameV2(noTokens, {
      linkIds: ["link_birmingham_coventry"],
      coalSources: [],
      beerSourceId: null,
      cardId: noTokens.cards.hands.alice[0],
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_LINK_TOKENS" },
    });
    expect(rejected.state).toBe(noTokens);
  });
});

function demandTileId(demand: string): IndustryTileId {
  if (demand === "cotton_mill") return "cotton-1-a";
  if (demand === "manufacturer") return "manufacturer-1-a";
  return "pottery-1-a";
}

function spaceForTile(tileId: IndustryTileId): {
  readonly spaceId: string;
  readonly locationId: string;
} {
  const tile = INDUSTRY_TILE_BY_ID[tileId];
  const boardKind = tile.industry === "cotton"
    ? "cotton_mill"
    : tile.industry;
  for (const [locationId, location] of Object.entries(BOARD_V2.locations)) {
    if (!("buildSpaces" in location)) continue;
    const space = location.buildSpaces.find((candidate) =>
      (candidate.allows as readonly string[]).includes(boardKind),
    );
    if (space) return { spaceId: space.id, locationId };
  }
  throw new Error(`No board space for ${tileId}`);
}

describe("Sell adapter Merchant and income responsibilities", () => {
  it("merges Merchant beer and exposes Gloucester free Develop as pending", () => {
    const base = createGameV2(["alice", "bob"], "adapter-sell-gloucester");
    const gloucester = base.merchants.spaces.find(
      (space) => space.locationId === "merchant_gloucester" && space.active,
    );
    const donor = base.merchants.spaces.find(
      (space) =>
        space.active &&
        space.beer === 1 &&
        space.demandIndustries.length > 0,
    );
    if (!gloucester || !donor) throw new Error("Expected active Merchant fixtures");
    const merchantSpaces = base.merchants.spaces.map((space) => {
      if (space.merchantSpaceId === gloucester.merchantSpaceId) {
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
          tileId: gloucester.tileId,
          demandIndustries: [...gloucester.demandIndustries],
          beer: gloucester.beer,
        };
      }
      return space;
    });
    const merchant = merchantSpaces.find(
      (space) => space.merchantSpaceId === gloucester.merchantSpaceId,
    );
    if (!merchant || merchant.beer !== 1) {
      throw new Error("Expected deterministic Gloucester demand Merchant");
    }
    const tileId = demandTileId(merchant.demandIndustries[0]);
    const buildSpace = spaceForTile(tileId);
    const cardId = base.cards.hands.alice[0];
    let state: GameStateV2 = {
      ...base,
      merchants: { ...base.merchants, spaces: merchantSpaces },
    };
    state = withPlacedIndustry(
      state,
      placed(
        "alice",
        buildSpace.spaceId,
        buildSpace.locationId,
        tileId,
      ),
    );
    state = withBuiltLinks(
      state,
      "bob",
      linkPath(buildSpace.locationId, merchant.locationId, state.era),
    );
    requireValid(state);
    const selection: SellActionSelection = {
      cardId,
      sales: [{
        industryId: buildSpace.spaceId,
        merchantSpaceId: merchant.merchantSpaceId,
        beerSource: { kind: "merchant" },
      }],
    };
    const result = executeSellForGameV2(state, selection);
    requireSuccess(result);
    requireValid(result.state);

    expect(
      result.state.merchants.spaces.find(
        (space) => space.merchantSpaceId === merchant.merchantSpaceId,
      )?.beer,
    ).toBe(0);
    expect(result.pending).toEqual({
      kind: "free_develop",
      seat: "alice",
      count: 1,
      source: "merchant_bonus",
      merchantSpaceIds: [merchant.merchantSpaceId],
    });
    expect(result.state.progress).toEqual({
      phase: "merchant_free_develop",
      pending: {
        seat: "alice",
        count: 1,
        source: "merchant_bonus",
        merchantSpaceIds: [merchant.merchantSpaceId],
      },
    });
    const blockedAction = executePassForGameV2(
      result.state,
      result.state.cards.hands.alice[0],
    );
    expect(blockedAction).toMatchObject({
      ok: false,
      error: { code: "PENDING_FOLLOW_UP_REQUIRED" },
    });
    expect(blockedAction.state).toBe(result.state);
    const blockedLifecycle = applyAcceptedActionV2(result.state, {
      type: "SOLD",
      actionsConsumed: 1,
      moneySpent: 0,
    });
    expect(blockedLifecycle).toMatchObject({
      ok: false,
      error: { code: "PENDING_FOLLOW_UP_REQUIRED" },
    });
    expect(blockedLifecycle.state).toBe(result.state);
    expect(result.state.board.placedIndustries[buildSpace.spaceId].flipped)
      .toBe(true);
    expect(result.effect.incomeAwards).toEqual([]);
  });

  it("keeps sold-tile income single-applied and additionally awards Brewery flip income", () => {
    const base = createGameV2(["alice", "bob"], "adapter-sell-brewery");
    const merchant = base.merchants.spaces.find(
      (space) => space.active && space.demandIndustries.length > 0,
    );
    if (!merchant) throw new Error("Expected active demand Merchant");
    const tileId = demandTileId(merchant.demandIndustries[0]);
    const buildSpace = spaceForTile(tileId);
    const soldIncome = INDUSTRY_TILE_BY_ID[tileId].incomeSteps;
    const breweryIncome = INDUSTRY_TILE_BY_ID["brewery-1-a"].incomeSteps;
    const merchantSpaces = base.merchants.spaces.map((space) =>
      space.merchantSpaceId === merchant.merchantSpaceId
        ? { ...space, beer: 0 as const }
        : space,
    );
    let state: GameStateV2 = {
      ...base,
      merchants: { ...base.merchants, spaces: merchantSpaces },
    };
    state = withPlacedIndustry(
      state,
      placed(
        "alice",
        buildSpace.spaceId,
        buildSpace.locationId,
        tileId,
      ),
    );
    state = withPlacedIndustry(
      state,
      placed(
        "bob",
        "stafford_1",
        "stafford",
        "brewery-1-a",
        { beer: 1 },
      ),
    );
    state = withBuiltLinks(
      state,
      "bob",
      [
        ...linkPath(buildSpace.locationId, merchant.locationId, state.era),
        ...linkPath(buildSpace.locationId, "stafford", state.era),
      ],
    );
    requireValid(state);
    const selection: SellActionSelection = {
      cardId: state.cards.hands.alice[0],
      sales: [{
        industryId: buildSpace.spaceId,
        merchantSpaceId: merchant.merchantSpaceId,
        beerSource: { kind: "brewery", industryId: "stafford_1" },
      }],
    };
    const result = executeSellForGameV2(state, selection);
    requireSuccess(result);
    requireValid(result.state);

    expect(result.state.players.alice.incomeMarkerSpace).toBe(
      advanceIncomeSpaces(10, soldIncome),
    );
    expect(result.state.players.bob.incomeMarkerSpace).toBe(
      advanceIncomeSpaces(10, breweryIncome),
    );
    expect(result.effect.incomeAwards).toEqual([
      expect.objectContaining({
        buildSpaceId: "stafford_1",
        owner: "bob",
        tileId: "brewery-1-a",
      }),
    ]);
    expect(result.pending).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

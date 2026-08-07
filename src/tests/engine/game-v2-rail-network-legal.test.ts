import { describe, expect, it } from "vitest";
import type { NetworkActionSelection } from "@/engine/actions-v2/network";
import { executeNetworkForGameV2 } from "@/engine/game-v2/action-adapters";
import {
  executeGameV2Command,
  type GameV2CommandEnvelope,
} from "@/engine/game-v2/commands";
import {
  getGameV2RailNetworkLegalOptions,
  type GameV2RailNetworkLegalOptions,
} from "@/engine/game-v2/rail-network-legal";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
  type IndustryTileKind,
} from "@/engine/rules/generated/industry-tiles-v2";

const RAIL_LINKS = BOARD_V2.links.filter((link) =>
  (link.eras as readonly string[]).includes("rail")
);

const SPACE_LOCATIONS = new Map<string, string>();
for (const [locationId, location] of Object.entries(BOARD_V2.locations)) {
  if (!("buildSpaces" in location)) continue;
  for (const space of location.buildSpaces) {
    SPACE_LOCATIONS.set(space.id, locationId);
  }
}

function asRail(state: GameStateV2): GameStateV2 {
  return { ...state, era: "rail", actionLimit: 2 };
}

function withMoney(state: GameStateV2, money: number): GameStateV2 {
  const seat = state.currentSeat;
  return {
    ...state,
    players: {
      ...state.players,
      [seat]: { ...state.players[seat], money },
    },
  };
}

function requireValid(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
  expect(validation).toMatchObject({ ok: true });
}

function pendingFreeDevelop(state: GameStateV2): GameStateV2 {
  const merchant = state.merchants.spaces.find((space) => {
    const location = BOARD_V2.locations[
      space.locationId as keyof typeof BOARD_V2.locations
    ];
    return space.active &&
      space.beer === 1 &&
      location.kind === "merchant" &&
      location.merchantBonus.kind === "free_develop";
  });
  if (!merchant) throw new Error("Expected an active Gloucester Merchant.");
  return {
    ...state,
    progress: {
      phase: "merchant_free_develop",
      pending: {
        seat: state.currentSeat,
        count: 1,
        source: "merchant_bonus",
        merchantSpaceIds: [merchant.merchantSpaceId],
      },
    },
    merchants: {
      ...state.merchants,
      spaces: state.merchants.spaces.map((space) =>
        space.merchantSpaceId === merchant.merchantSpaceId
          ? { ...space, beer: 0 }
          : space
      ),
    },
  };
}

function placeTile(
  state: GameStateV2,
  owner: string,
  spaceId: string,
  tileId: IndustryTileId,
  resources: Partial<PlacedIndustryStateV2["resources"]> = {},
): GameStateV2 {
  const locationId = SPACE_LOCATIONS.get(spaceId);
  if (!locationId) throw new Error(`Unknown fixture space: ${spaceId}.`);
  const tile = INDUSTRY_TILE_BY_ID[tileId];
  const player = state.players[owner];
  const stack = player.industryInventory.stacks[tile.industry];
  const index = stack.indexOf(tileId);
  if (index < 0) throw new Error(`Tile unavailable to ${owner}: ${tileId}.`);
  const placement: PlacedIndustryStateV2 = {
    owner,
    tileId,
    locationId,
    spaceId,
    resources: {
      coal: resources.coal ?? 0,
      iron: resources.iron ?? 0,
      beer: resources.beer ?? 0,
    },
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
        [spaceId]: placement,
      },
    },
  };
}

function placeTopTile(
  state: GameStateV2,
  owner: string,
  spaceId: string,
  industry: IndustryTileKind,
  resources: Partial<PlacedIndustryStateV2["resources"]> = {},
): GameStateV2 {
  const tileId = state.players[owner].industryInventory.stacks[industry][0];
  if (!tileId) throw new Error(`No ${industry} tile for ${owner}.`);
  return placeTile(state, owner, spaceId, tileId, resources);
}

function withBuiltLinks(
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

function envelope(
  state: GameStateV2,
  selection: NetworkActionSelection,
  index = 0,
): GameV2CommandEnvelope {
  return {
    schemaVersion: 1,
    commandId: `rail-legal-${selection.linkIds.length}-${index}`,
    gameId: state.gameId,
    expectedRevision: state.revision,
    actorSeat: state.currentSeat,
    command: { type: "NETWORK", selection },
  };
}

function expectEveryPlanAccepted(
  state: GameStateV2,
  options: GameV2RailNetworkLegalOptions,
): void {
  for (const [index, plan] of options.nextPlans.entries()) {
    const result = executeGameV2Command(state, envelope(state, plan.selection, index));
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.ok).toBe(true);
  }
}

function planFor(
  options: GameV2RailNetworkLegalOptions,
  linkIds: readonly string[],
  coalKinds?: readonly ("mine" | "market")[],
) {
  return options.nextPlans.find((plan) =>
    JSON.stringify(plan.selection.linkIds) === JSON.stringify(linkIds) &&
    (coalKinds === undefined ||
      JSON.stringify(plan.selection.coalSources.map((source) => source.kind)) ===
        JSON.stringify(coalKinds))
  );
}

describe("exact bounded Rail Network selector", () => {
  it("supports the first-link-anywhere exception and emits reducer-ready mine plans", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-legal-first-anywhere")),
      5,
    );
    state = placeTile(state, "bob", "nuneaton_2", "coal-2-a", { coal: 1 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const options = getGameV2RailNetworkLegalOptions(
      state,
      "alice",
      cardId,
    );
    expectEveryPlanAccepted(state, options);

    const plan = options.nextPlans.find((candidate) =>
      candidate.selection.linkIds[0] === "link_birmingham_nuneaton" &&
      candidate.selection.coalSources[0].kind === "mine"
    );
    expect(plan).toMatchObject({
      linkCount: 1,
      links: [{
        linkId: "link_birmingham_nuneaton",
        order: 1,
        endpoints: [
          { locationId: "birmingham", locationLabel: "Birmingham" },
          { locationId: "nuneaton", locationLabel: "Nuneaton" },
        ],
      }],
      coalSources: [{
        kind: "mine",
        industryId: "nuneaton_2",
        owner: "bob",
        locationLabel: "Nuneaton",
        coalRemaining: 0,
        depleted: true,
      }],
      costs: { links: 5, resources: 0, total: 5 },
      playerResult: {
        money: 0,
        moneyChange: -5,
        linkTokensUsed: 1,
      },
      marketResult: { coalPurchased: 0 },
      flippedIndustryIds: ["nuneaton_2"],
    });
    expect(plan?.incomeAwards).toEqual([
      expect.objectContaining({ buildSpaceId: "nuneaton_2", owner: "bob" }),
    ]);
  });

  it("lets the adapter enforce network reach and nearest-coal priority", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-legal-nearest")),
      5,
    );
    state = placeTile(
      state,
      "alice",
      "birmingham_1",
      "manufacturer-2-a",
    );
    state = placeTile(state, "bob", "nuneaton_2", "coal-2-a", { coal: 1 });
    state = placeTile(state, "bob", "coventry_2", "coal-2-b", { coal: 1 });
    state = withBuiltLinks(state, "bob", ["link_coventry_nuneaton"]);
    requireValid(state);
    const options = getGameV2RailNetworkLegalOptions(
      state,
      "alice",
      state.cards.hands.alice[0],
    );
    const targetPlans = options.nextPlans.filter((plan) =>
      plan.selection.linkIds[0] === "link_birmingham_nuneaton"
    );

    expect(targetPlans).toHaveLength(1);
    expect(targetPlans[0].selection.coalSources).toEqual([
      { kind: "mine", industryId: "nuneaton_2" },
    ]);
    expect(
      options.nextPlans.some((plan) =>
        plan.selection.linkIds[0] === "link_belper_derby"
      ),
    ).toBe(false);
  });

  it("extends a market prefix with exact sequential pricing and own beer", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-legal-market-sequence")),
      18,
    );
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const initial = getGameV2RailNetworkLegalOptions(state, "alice", cardId);
    expectEveryPlanAccepted(state, initial);
    const first = planFor(
      initial,
      ["link_derby_nottingham"],
      ["market"],
    );
    if (!first) throw new Error("Expected Derby-to-Nottingham market plan.");
    expect(first.coalSources).toEqual([
      { kind: "market", linkId: "link_derby_nottingham", unitPrice: 1 },
    ]);

    const extension = getGameV2RailNetworkLegalOptions(
      state,
      "alice",
      cardId,
      first.selection,
    );
    expect(extension.currentPlan).toEqual(first);
    expectEveryPlanAccepted(state, extension);
    const second = planFor(
      extension,
      ["link_derby_nottingham", "link_belper_derby"],
      ["market", "market"],
    );
    expect(second).toMatchObject({
      linkCount: 2,
      coalSources: [
        { kind: "market", unitPrice: 1 },
        { kind: "market", unitPrice: 2 },
      ],
      beerSource: {
        industryId: "derby_1",
        owner: "alice",
        locationLabel: "Derby",
        beerRemaining: 1,
        depleted: false,
      },
      costs: { links: 15, resources: 3, total: 18 },
      playerResult: { money: 0, moneyChange: -18, linkTokensUsed: 2 },
      marketResult: { coalBefore: 13, coalAfter: 11, coalPurchased: 2 },
    });
    if (!second) throw new Error("Expected sequential market extension.");
    expect(
      executeGameV2Command(state, envelope(state, second.selection)),
    ).toMatchObject({ ok: true });
  });

  it("projects repeated-mine depletion, Brewery depletion, and flip awards", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-legal-provider-depletion")),
      15,
    );
    state = placeTile(state, "alice", "nuneaton_1", "brewery-2-a", { beer: 1 });
    state = placeTile(state, "bob", "nuneaton_2", "coal-2-a", { coal: 2 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const initial = getGameV2RailNetworkLegalOptions(state, "alice", cardId);
    const first = initial.nextPlans.find((plan) =>
      plan.selection.linkIds[0] === "link_birmingham_nuneaton" &&
      plan.selection.coalSources[0].kind === "mine"
    );
    if (!first) throw new Error("Expected first Nuneaton mine plan.");
    const extension = getGameV2RailNetworkLegalOptions(
      state,
      "alice",
      cardId,
      first.selection,
    );
    const second = extension.nextPlans.find((plan) =>
      JSON.stringify(plan.selection.linkIds) === JSON.stringify([
        "link_birmingham_nuneaton",
        "link_coventry_nuneaton",
      ]) &&
      plan.selection.coalSources.every((source) =>
        source.kind === "mine" && source.industryId === "nuneaton_2"
      ) &&
      plan.selection.beerSourceId === "nuneaton_1"
    );

    expect(second).toMatchObject({
      coalSources: [
        { kind: "mine", coalRemaining: 1, depleted: false },
        { kind: "mine", coalRemaining: 0, depleted: true },
      ],
      beerSource: {
        industryId: "nuneaton_1",
        beerRemaining: 0,
        depleted: true,
      },
      flippedIndustryIds: ["nuneaton_2", "nuneaton_1"],
      costs: { links: 15, resources: 0, total: 15 },
    });
    expect(second?.incomeAwards).toEqual([
      expect.objectContaining({ buildSpaceId: "nuneaton_1", owner: "alice" }),
      expect.objectContaining({ buildSpaceId: "nuneaton_2", owner: "bob" }),
    ]);
  });

  it("fails closed for era, phase, budget, tokens, card, and actor blockers", () => {
    const canal = createGameV2(["alice", "bob"], "rail-legal-blockers");
    const cardId = canal.cards.hands.alice[0];
    expect(getGameV2RailNetworkLegalOptions(canal, "alice", cardId)).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_RAIL_ERA" },
    });

    const rail = asRail(canal);
    expect(
      getGameV2RailNetworkLegalOptions(
        { ...rail, schemaVersion: 999 } as unknown as GameStateV2,
        "alice",
        cardId,
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_GAME_STATE" },
    });
    expect(getGameV2RailNetworkLegalOptions(rail, null, cardId)).toMatchObject({
      availability: "disabled",
      reason: { code: "ACTOR_REQUIRED" },
    });
    expect(
      getGameV2RailNetworkLegalOptions(rail, "ghost", cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "UNKNOWN_ACTOR" },
    });
    expect(getGameV2RailNetworkLegalOptions(rail, "alice", null)).toMatchObject({
      availability: "disabled",
      reason: { code: "CARD_REQUIRED" },
    });
    expect(
      getGameV2RailNetworkLegalOptions(
        pendingFreeDevelop(rail),
        "alice",
        cardId,
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_ACTION_PHASE" },
    });
    expect(
      getGameV2RailNetworkLegalOptions(
        { ...rail, actionsUsed: rail.actionLimit },
        "alice",
        cardId,
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "ACTION_LIMIT_REACHED" },
    });
    expect(
      getGameV2RailNetworkLegalOptions(withMoney(rail, 4), "alice", cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INSUFFICIENT_MONEY" },
    });
    expect(getGameV2RailNetworkLegalOptions(rail, "bob", cardId)).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_CURRENT_ACTOR" },
    });
    expect(
      getGameV2RailNetworkLegalOptions(
        rail,
        "alice",
        rail.cards.hands.bob[0],
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "CARD_NOT_IN_HAND" },
    });

    const tokenCount = rail.players.alice.linkTokensRemaining;
    const noTokens = withBuiltLinks(
      rail,
      "alice",
      RAIL_LINKS.slice(0, tokenCount).map((link) => link.id),
    );
    requireValid(noTokens);
    expect(
      getGameV2RailNetworkLegalOptions(noTokens, "alice", cardId),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INSUFFICIENT_LINK_TOKENS" },
    });

    let noCoalOrMarket = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-legal-no-plan")),
      30,
    );
    noCoalOrMarket = placeTile(
      noCoalOrMarket,
      "alice",
      "cannock_1",
      "manufacturer-2-a",
    );
    requireValid(noCoalOrMarket);
    expect(
      getGameV2RailNetworkLegalOptions(
        noCoalOrMarket,
        "alice",
        noCoalOrMarket.cards.hands.alice[0],
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "NO_LEGAL_RAIL_NETWORK" },
    });
  });

  it("rejects malformed prefixes without mutation and dedupes material states", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-legal-pure")),
      18,
    );
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const snapshot = structuredClone(state);
    const first = getGameV2RailNetworkLegalOptions(state, "alice", cardId);
    const repeated = getGameV2RailNetworkLegalOptions(state, "alice", cardId);
    expect(first).toEqual(repeated);
    expect(state).toEqual(snapshot);

    expect(
      getGameV2RailNetworkLegalOptions(
        state,
        "alice",
        cardId,
        { linkIds: null } as unknown as NetworkActionSelection,
      ),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "INVALID_NETWORK_PREFIX" },
    });
    const prefix = planFor(
      first,
      ["link_derby_nottingham"],
      ["market"],
    )?.selection;
    if (!prefix) throw new Error("Expected valid immutable prefix.");
    const prefixSnapshot = structuredClone(prefix);
    const extension = getGameV2RailNetworkLegalOptions(
      state,
      "alice",
      cardId,
      prefix,
    );
    expect(prefix).toEqual(prefixSnapshot);
    expect(state).toEqual(snapshot);

    for (const options of [first, extension]) {
      const materialStates = options.nextPlans.map((plan) => {
        const result = executeNetworkForGameV2(state, plan.selection);
        if (!result.ok) throw new Error(JSON.stringify(result.error));
        return JSON.stringify(result.state);
      });
      expect(new Set(materialStates).size).toBe(materialStates.length);
    }
  });

  it("keeps dense physical first and extension layers bounded", () => {
    let state = withMoney(
      asRail(createGameV2(
        ["alice", "bob", "carol", "dave"],
        "rail-legal-dense",
      )),
      100,
    );
    for (const [spaceId, owner] of [
      ["cannock_1", "bob"],
      ["cannock_2", "carol"],
      ["tamworth_1", "dave"],
      ["tamworth_2", "bob"],
      ["coventry_2", "carol"],
      ["redditch_1", "dave"],
      ["nuneaton_2", "bob"],
      ["dudley_1", "carol"],
    ] as const) {
      state = placeTopTile(state, owner, spaceId, "coal", { coal: 1 });
    }
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    state = placeTile(state, "alice", "stafford_1", "brewery-2-b", { beer: 2 });
    state = placeTile(
      state,
      "alice",
      "burton_on_trent_2",
      "brewery-3-a",
      { beer: 2 },
    );
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const started = performance.now();
    const initial = getGameV2RailNetworkLegalOptions(state, "alice", cardId);
    const prefix = planFor(
      initial,
      ["link_derby_nottingham"],
      ["market"],
    );
    if (!prefix) throw new Error("Expected dense market prefix.");
    const extension = getGameV2RailNetworkLegalOptions(
      state,
      "alice",
      cardId,
      prefix.selection,
    );
    const elapsed = performance.now() - started;

    expect(initial.availability).toBe("exact");
    expect(extension.availability).toBe("exact");
    expect(initial.nextPlans.length).toBeLessThanOrEqual(
      RAIL_LINKS.length * 9,
    );
    expect(extension.nextPlans.length).toBeLessThanOrEqual(
      (RAIL_LINKS.length - 1) * 9 * 3,
    );
    expect(elapsed).toBeLessThan(2_000);
  });
});

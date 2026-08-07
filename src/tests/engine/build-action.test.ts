import { describe, expect, it } from "vitest";
import {
  executeBuildAction,
  type BuildActionSelection,
  type BuildActionState,
  type BuiltIndustryState,
} from "@/engine/actions-v2/build";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "@/engine/cards-v2/types";
import { createResourceMarketState } from "@/engine/economy/markets";
import { createIndustryInventory } from "@/engine/player-v2/industry-inventory";
import type { IndustryInventory } from "@/engine/player-v2/types";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_STACKS,
  type IndustryTileId,
  type IndustryTileKind,
} from "@/engine/rules/generated/industry-tiles-v2";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

const LOCATION_CANN0CK = card("location-cannock");
const LOCATION_BIRMINGHAM = card("location-birmingham");
const LOCATION_DUDLEY = card("location-dudley");
const LOCATION_STAFFORD = card("location-stafford");
const INDUSTRY_MANUFACTURER = card(
  "industry-manufactured-goods-cotton-mill",
);
const INDUSTRY_COAL = card("industry-coal-mine");

function card(templateId: string): PlayableCardId {
  const match = CARD_CATALOG.find((candidate) => candidate.templateId === templateId);
  if (!match) throw new Error(`Missing test card template: ${templateId}`);
  return match.id;
}

function inventoryAt(
  industry: IndustryTileKind,
  tileId: IndustryTileId,
): IndustryInventory {
  const inventory = createIndustryInventory();
  const stack = INDUSTRY_TILE_STACKS[industry];
  const index = stack.findIndex((tile) => tile.id === tileId);
  if (index < 0) throw new Error(`Tile is not in ${industry} stack: ${tileId}`);
  return {
    ...inventory,
    stacks: {
      ...inventory.stacks,
      [industry]: stack.slice(index).map((tile) => tile.id),
    },
  };
}

function placement(
  owner: string,
  buildSpaceId: string,
  locationId: string,
  tileId: IndustryTileId,
  resources: Partial<BuiltIndustryState["resources"]> = {},
  flipped = false,
): BuiltIndustryState {
  const tile = INDUSTRY_TILE_BY_ID[tileId];
  return {
    owner,
    buildSpaceId,
    locationId,
    tileId,
    faceId: tile.faceId,
    industry: tile.industry,
    level: tile.level,
    resources: {
      coal: resources.coal ?? 0,
      iron: resources.iron ?? 0,
      beer: resources.beer ?? 0,
    },
    flipped,
  };
}

function withCard(
  state: BuildActionState,
  cardId: PlayableCardId,
): BuildActionState {
  const oldHand = state.cards.hands.alice ?? [];
  const hand = [cardId, ...oldHand.filter((id) => id !== cardId)].slice(0, 8);
  const wildSupplies = { ...state.cards.wildSupplies };
  if (cardId === WILD_LOCATION_CARD_ID) wildSupplies.location = 3;
  if (cardId === WILD_INDUSTRY_CARD_ID) wildSupplies.industry = 3;
  return {
    ...state,
    cards: {
      ...state.cards,
      hands: { ...state.cards.hands, alice: hand },
      wildSupplies,
    },
  };
}

function buildState(
  era: BuildActionState["era"] = "canal",
  money = 30,
  playerCount: BuildActionState["playerCount"] = 2,
): BuildActionState {
  const setup = createCanalSetup(["alice", "bob"], "build-action-cards");
  return withCard(
    {
      era,
      playerCount,
      seat: "alice",
      player: { money, inventory: createIndustryInventory() },
      builtLinks: {},
      placements: {},
      market: createResourceMarketState(),
      cards: {
        hands: setup.hands,
        draw: setup.draw,
        discard: setup.discard,
        wildSupplies: setup.wildSupplies,
      },
    },
    LOCATION_CANN0CK,
  );
}

function build(
  buildSpaceId: string,
  industry: IndustryTileKind,
  cardId: PlayableCardId,
  coalSources: BuildActionSelection["coalSources"] = [],
  ironSources: BuildActionSelection["ironSources"] = [],
): BuildActionSelection {
  return { buildSpaceId, industry, cardId, coalSources, ironSources };
}

function requireSuccess(
  result: ReturnType<typeof executeBuildAction>,
): Extract<ReturnType<typeof executeBuildAction>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Build placement, cards, and eras", () => {
  it("allows an Industry card anywhere when the player has no board presence", () => {
    const initial = withCard(buildState("canal", 5), INDUSTRY_COAL);
    const result = requireSuccess(
      executeBuildAction(
        initial,
        build("cannock_2", "coal", INDUSTRY_COAL),
      ),
    );

    expect(result.state.placements.cannock_2).toMatchObject({
      owner: "alice",
      tileId: "coal-1-a",
    });
  });

  it("builds the next Canal face in an exact space using a location card", () => {
    const initial = buildState("canal", 5);
    const result = requireSuccess(
      executeBuildAction(
        initial,
        build("cannock_2", "coal", LOCATION_CANN0CK),
      ),
    );

    expect(result.state.player.money).toBe(0);
    expect(result.state.player.inventory.stacks.coal[0]).toBe("coal-2-a");
    expect(result.state.placements.cannock_2).toMatchObject({
      owner: "alice",
      tileId: "coal-1-a",
      faceId: "coal-1",
      industry: "coal",
      level: 1,
      resources: { coal: 2, iron: 0, beer: 0 },
      flipped: false,
    });
    expect(result.state.cards.hands.alice).not.toContain(LOCATION_CANN0CK);
    expect(result.state.cards.discard.at(-1)).toBe(LOCATION_CANN0CK);
    expect(result.effect).toMatchObject({
      actionsConsumed: 1,
      discardedCardId: LOCATION_CANN0CK,
      printedBuildCost: 5,
      resourceMarketCost: 0,
      moneySpent: 5,
      productionRevenue: 0,
    });
    expect(initial.player.inventory.stacks.coal[0]).toBe("coal-1-a");
    expect(initial.placements).toEqual({});
    expect(initial.cards.hands.alice).toContain(LOCATION_CANN0CK);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("uses an Industry card only inside the actor's network", () => {
    const base = withCard(buildState("canal", 8, 3), INDUSTRY_MANUFACTURER);
    const connected: BuildActionState = {
      ...base,
      builtLinks: { link_birmingham_dudley: "alice" },
      placements: {
        dudley_1: placement("bob", "dudley_1", "dudley", "coal-1-a", {
          coal: 1,
        }),
      },
    };
    const action = build(
      "birmingham_1",
      "manufacturer",
      INDUSTRY_MANUFACTURER,
      [{ kind: "mine", buildSpaceId: "dudley_1" }],
    );
    const result = requireSuccess(executeBuildAction(connected, action));
    expect(result.state.placements.birmingham_1.tileId).toBe("manufacturer-1-a");
    expect(result.state.placements.dudley_1).toMatchObject({
      resources: { coal: 0 },
      flipped: true,
    });
    expect(result.effect.flippedProviderSpaceIds).toEqual(["dudley_1"]);

    const disconnected = {
      ...connected,
      builtLinks: {},
      placements: {
        ...connected.placements,
        cannock_1: placement(
          "alice",
          "cannock_1",
          "cannock",
          "manufacturer-1-a",
        ),
      },
    };
    const rejected = executeBuildAction(disconnected, action);
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "BUILD_NOT_IN_PLAYER_NETWORK" },
    });
    expect(rejected.state).toBe(disconnected);
  });

  it("validates card grant, player-count inclusion, build-space support, and farms", () => {
    const base = buildState();
    const belperCard = card("location-belper");
    const cases: Array<[BuildActionState, BuildActionSelection, string]> = [
      [
        withCard(base, LOCATION_BIRMINGHAM),
        build("cannock_2", "coal", LOCATION_BIRMINGHAM),
        "CARD_DOES_NOT_ALLOW_BUILD",
      ],
      [
        withCard(base, belperCard),
        build("belper_2", "coal", belperCard),
        "CARD_NOT_AVAILABLE_AT_PLAYER_COUNT",
      ],
      [
        base,
        build("birmingham_1", "coal", LOCATION_BIRMINGHAM),
        "INDUSTRY_NOT_SUPPORTED",
      ],
      [
        withCard(base, WILD_LOCATION_CARD_ID),
        build(
          "farm_brewery_cannock_1",
          "brewery",
          WILD_LOCATION_CARD_ID,
          [],
          [{ kind: "market" }],
        ),
        "LOCATION_REQUIRES_INDUSTRY_CARD",
      ],
    ];

    for (const [state, action, code] of cases) {
      const result = executeBuildAction(state, action);
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(result.state).toBe(state);
    }
  });

  it("enforces Canal one-per-player-per-location and explicit era levels", () => {
    const canal = buildState();
    const occupiedLocation: BuildActionState = {
      ...canal,
      placements: {
        cannock_1: placement(
          "alice",
          "cannock_1",
          "cannock",
          "manufacturer-1-a",
        ),
      },
    };
    expect(
      executeBuildAction(
        occupiedLocation,
        build("cannock_2", "coal", LOCATION_CANN0CK),
      ),
    ).toMatchObject({ ok: false, error: { code: "CANAL_LOCATION_LIMIT" } });

    const canalLevelTwo: BuildActionState = {
      ...withCard(canal, LOCATION_BIRMINGHAM),
      player: {
        ...canal.player,
        inventory: inventoryAt("manufacturer", "manufacturer-2-a"),
      },
    };
    expect(
      executeBuildAction(
        canalLevelTwo,
        build("birmingham_1", "manufacturer", LOCATION_BIRMINGHAM),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INDUSTRY_TILE_NOT_BUILDABLE_IN_ERA" },
    });

    const railLevelOne = withCard(buildState("rail"), LOCATION_BIRMINGHAM);
    expect(
      executeBuildAction(
        railLevelOne,
        build("birmingham_1", "manufacturer", LOCATION_BIRMINGHAM),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INDUSTRY_TILE_NOT_BUILDABLE_IN_ERA" },
    });

    const railBase = withCard(buildState("rail", 7), LOCATION_BIRMINGHAM);
    const railMultiple: BuildActionState = {
      ...railBase,
      player: {
        ...railBase.player,
        inventory: inventoryAt("iron", "iron-2-a"),
      },
      builtLinks: { link_birmingham_dudley: "bob" },
      placements: {
        birmingham_1: placement(
          "alice",
          "birmingham_1",
          "birmingham",
          "manufacturer-2-a",
        ),
        dudley_1: placement("bob", "dudley_1", "dudley", "coal-2-a", {
          coal: 1,
        }),
      },
    };
    const railResult = requireSuccess(
      executeBuildAction(
        railMultiple,
        build(
          "birmingham_3",
          "iron",
          LOCATION_BIRMINGHAM,
          [{ kind: "mine", buildSpaceId: "dudley_1" }],
        ),
      ),
    );
    expect(railResult.state.placements.birmingham_1.owner).toBe("alice");
    expect(railResult.state.placements.birmingham_3.owner).toBe("alice");
  });

  it("accepts Wild Location and Wild Industry cards with their distinct network rules", () => {
    const wildLocation = withCard(buildState("canal", 5), WILD_LOCATION_CARD_ID);
    const locationResult = requireSuccess(
      executeBuildAction(
        wildLocation,
        build("cannock_2", "coal", WILD_LOCATION_CARD_ID),
      ),
    );
    expect(locationResult.state.cards.wildSupplies.location).toBe(4);

    const base = withCard(buildState("canal", 5), WILD_INDUSTRY_CARD_ID);
    const wildIndustry: BuildActionState = {
      ...base,
      builtLinks: { link_cannock_walsall: "alice" },
    };
    const industryResult = requireSuccess(
      executeBuildAction(
        wildIndustry,
        build("cannock_2", "coal", WILD_INDUSTRY_CARD_ID),
      ),
    );
    expect(industryResult.state.cards.wildSupplies.industry).toBe(4);

    const firstIndustryBuild = executeBuildAction(
      base,
      build("cannock_2", "coal", WILD_INDUSTRY_CARD_ID),
    );
    expect(firstIndustryBuild.ok).toBe(true);

    const disconnected: BuildActionState = {
      ...base,
      placements: {
        dudley_1: placement(
          "alice",
          "dudley_1",
          "dudley",
          "coal-1-a",
          { coal: 1 },
        ),
      },
    };
    const rejected = executeBuildAction(
      disconnected,
      build("cannock_2", "coal", WILD_INDUSTRY_CARD_ID),
    );
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "BUILD_NOT_IN_PLAYER_NETWORK" },
    });
  });
});

describe("Build resources and production", () => {
  it("takes nearest connected coal before a farther mine or market", () => {
    const base = withCard(buildState("canal", 8, 3), INDUSTRY_MANUFACTURER);
    const initial: BuildActionState = {
      ...base,
      builtLinks: {
        link_birmingham_dudley: "alice",
        link_dudley_wolverhampton: "bob",
        link_coalbrookdale_wolverhampton: "bob",
        link_birmingham_oxford: "bob",
      },
      placements: {
        dudley_1: placement("bob", "dudley_1", "dudley", "coal-1-a", {
          coal: 1,
        }),
        coalbrookdale_3: placement(
          "bob",
          "coalbrookdale_3",
          "coalbrookdale",
          "coal-2-a",
          { coal: 1 },
        ),
      },
    };
    const target = (coalSources: BuildActionSelection["coalSources"]) =>
      build(
        "birmingham_1",
        "manufacturer",
        INDUSTRY_MANUFACTURER,
        coalSources,
      );

    for (const coalSources of [
      [{ kind: "mine", buildSpaceId: "coalbrookdale_3" }] as const,
      [{ kind: "market" }] as const,
    ]) {
      expect(executeBuildAction(initial, target(coalSources))).toMatchObject({
        ok: false,
        error: { code: "COAL_SOURCE_PRIORITY" },
      });
    }
    const result = requireSuccess(
      executeBuildAction(
        initial,
        target([{ kind: "mine", buildSpaceId: "dudley_1" }]),
      ),
    );
    expect(result.effect.resourceSources[0]).toMatchObject({
      resource: "coal",
      kind: "mine",
      buildSpaceId: "dudley_1",
    });
  });

  it("requires coal-market connectivity and charges exact market prices", () => {
    const base = withCard(buildState("canal", 9, 3), INDUSTRY_MANUFACTURER);
    const action = build(
      "birmingham_1",
      "manufacturer",
      INDUSTRY_MANUFACTURER,
      [{ kind: "market" }],
    );
    expect(executeBuildAction(base, action)).toMatchObject({
      ok: false,
      error: { code: "COAL_MARKET_NOT_CONNECTED" },
    });

    const connected: BuildActionState = {
      ...base,
      builtLinks: { link_birmingham_oxford: "alice" },
    };
    const result = requireSuccess(executeBuildAction(connected, action));
    expect(result.effect).toMatchObject({
      printedBuildCost: 8,
      resourceMarketCost: 1,
      moneySpent: 9,
    });
    expect(result.state.market.coal).toBe(12);

    const locationCardState = withCard(buildState("canal", 20), LOCATION_BIRMINGHAM);
    const noMarketNetwork = executeBuildAction(
      locationCardState,
      build(
        "birmingham_1",
        "manufacturer",
        LOCATION_BIRMINGHAM,
        [{ kind: "market" }],
      ),
    );
    expect(noMarketNetwork).toMatchObject({
      ok: false,
      error: { code: "COAL_MARKET_NOT_CONNECTED" },
    });
  });

  it("takes any board iron before market iron, then prices market fallback", () => {
    const base = withCard(buildState("canal", 10), LOCATION_STAFFORD);
    const withWorks: BuildActionState = {
      ...base,
      placements: {
        coalbrookdale_2: placement(
          "bob",
          "coalbrookdale_2",
          "coalbrookdale",
          "iron-1-a",
          { iron: 1 },
        ),
      },
    };
    const marketAction = build(
      "stafford_1",
      "brewery",
      LOCATION_STAFFORD,
      [],
      [{ kind: "market" }],
    );
    expect(executeBuildAction(withWorks, marketAction)).toMatchObject({
      ok: false,
      error: { code: "IRON_SOURCE_PRIORITY" },
    });

    const worksResult = requireSuccess(
      executeBuildAction(
        { ...withWorks, player: { ...withWorks.player, money: 5 } },
        build(
          "stafford_1",
          "brewery",
          LOCATION_STAFFORD,
          [],
          [{ kind: "works", buildSpaceId: "coalbrookdale_2" }],
        ),
      ),
    );
    expect(worksResult.state.placements.coalbrookdale_2.flipped).toBe(true);
    expect(worksResult.state.placements.stafford_1.resources.beer).toBe(1);

    const marketResult = requireSuccess(executeBuildAction(base, marketAction));
    expect(marketResult.effect).toMatchObject({
      printedBuildCost: 5,
      resourceMarketCost: 2,
      moneySpent: 7,
    });
    expect(marketResult.state.player.money).toBe(3);
  });

  it("sells connected coal production immediately without netting turn spend", () => {
    const base = withCard(buildState("canal", 5), LOCATION_DUDLEY);
    const initial: BuildActionState = {
      ...base,
      builtLinks: {
        link_dudley_wolverhampton: "bob",
        link_coalbrookdale_wolverhampton: "bob",
        link_coalbrookdale_shrewsbury: "bob",
      },
    };
    const result = requireSuccess(
      executeBuildAction(
        initial,
        build("dudley_1", "coal", LOCATION_DUDLEY),
      ),
    );

    expect(result.state.market.coal).toBe(14);
    expect(result.state.placements.dudley_1.resources.coal).toBe(1);
    expect(result.state.player.money).toBe(1);
    expect(result.effect).toMatchObject({
      moneySpent: 5,
      productionRevenue: 1,
      moneyChange: -4,
      productionSold: { coal: 1, iron: 0 },
    });
  });

  it("sells iron production globally and leaves market overflow on the tile", () => {
    const base = withCard(buildState("canal", 5), LOCATION_BIRMINGHAM);
    const initial: BuildActionState = {
      ...base,
      builtLinks: { link_birmingham_dudley: "bob" },
      placements: {
        dudley_1: placement("bob", "dudley_1", "dudley", "coal-1-a", {
          coal: 1,
        }),
      },
    };
    const result = requireSuccess(
      executeBuildAction(
        initial,
        build(
          "birmingham_3",
          "iron",
          LOCATION_BIRMINGHAM,
          [{ kind: "mine", buildSpaceId: "dudley_1" }],
        ),
      ),
    );

    expect(result.state.market.iron).toBe(10);
    expect(result.state.placements.birmingham_3).toMatchObject({
      resources: { iron: 2 },
      flipped: false,
    });
    expect(result.state.player.money).toBe(2);
    expect(result.effect).toMatchObject({
      moneySpent: 5,
      productionRevenue: 2,
      moneyChange: -3,
      productionSold: { coal: 0, iron: 2 },
    });
  });
});

describe("Build overbuilding and atomicity", () => {
  it("overbuilds an owned matching tile only with a higher face", () => {
    const base = withCard(buildState("rail", 8), INDUSTRY_COAL);
    const initial: BuildActionState = {
      ...base,
      player: {
        ...base.player,
        inventory: inventoryAt("coal", "coal-3-a"),
      },
      placements: {
        cannock_2: placement(
          "alice",
          "cannock_2",
          "cannock",
          "coal-2-a",
          {},
          true,
        ),
        birmingham_3: placement(
          "bob",
          "birmingham_3",
          "birmingham",
          "iron-2-a",
          { iron: 1 },
        ),
      },
    };
    const result = requireSuccess(
      executeBuildAction(
        initial,
        build(
          "cannock_2",
          "coal",
          INDUSTRY_COAL,
          [],
          [{ kind: "works", buildSpaceId: "birmingham_3" }],
        ),
      ),
    );
    expect(result.state.placements.cannock_2.tileId).toBe("coal-3-a");
    expect(result.effect.overbuilt?.tileId).toBe("coal-2-a");

    const sameLevel: BuildActionState = {
      ...initial,
      player: {
        ...initial.player,
        inventory: inventoryAt("coal", "coal-2-a"),
      },
    };
    expect(
      executeBuildAction(
        sameLevel,
        build("cannock_2", "coal", INDUSTRY_COAL),
      ),
    ).toMatchObject({ ok: false, error: { code: "ILLEGAL_OVERBUILD" } });

    const wrongKind: BuildActionState = {
      ...initial,
      placements: {
        ...initial.placements,
        cannock_1: placement(
          "alice",
          "cannock_1",
          "cannock",
          "manufacturer-2-a",
          {},
          true,
        ),
      },
    };
    expect(
      executeBuildAction(
        wrongKind,
        build("cannock_1", "coal", INDUSTRY_COAL),
      ),
    ).toMatchObject({ ok: false, error: { code: "ILLEGAL_OVERBUILD" } });
  });

  it("overbuilds opponent coal only when board and market coal are empty", () => {
    const base = withCard(buildState("rail", 8), INDUSTRY_COAL);
    const initial: BuildActionState = {
      ...base,
      player: {
        ...base.player,
        inventory: inventoryAt("coal", "coal-3-a"),
      },
      market: { ...base.market, coal: 0 },
      placements: {
        cannock_1: placement(
          "alice",
          "cannock_1",
          "cannock",
          "manufacturer-2-a",
          {},
          true,
        ),
        cannock_2: placement(
          "bob",
          "cannock_2",
          "cannock",
          "coal-2-a",
          {},
          true,
        ),
        birmingham_3: placement(
          "bob",
          "birmingham_3",
          "birmingham",
          "iron-2-a",
          { iron: 1 },
        ),
      },
    };
    const action = build(
      "cannock_2",
      "coal",
      INDUSTRY_COAL,
      [],
      [{ kind: "works", buildSpaceId: "birmingham_3" }],
    );
    expect(requireSuccess(executeBuildAction(initial, action)).effect.overbuilt)
      .toMatchObject({ owner: "bob", industry: "coal" });

    const marketHasCoal = {
      ...initial,
      market: { ...initial.market, coal: 1 },
    };
    const rejected = executeBuildAction(marketHasCoal, action);
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "ILLEGAL_OVERBUILD" },
    });
    expect(rejected.state).toBe(marketHasCoal);

    const opponentWrongKind: BuildActionState = {
      ...initial,
      builtLinks: { link_cannock_walsall: "alice" },
      placements: {
        cannock_1: placement(
          "bob",
          "cannock_1",
          "cannock",
          "manufacturer-2-a",
          {},
          true,
        ),
        birmingham_3: initial.placements.birmingham_3,
      },
    };
    expect(
      executeBuildAction(
        opponentWrongKind,
        build(
          "cannock_1",
          "coal",
          INDUSTRY_COAL,
          [],
          [{ kind: "works", buildSpaceId: "birmingham_3" }],
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: "ILLEGAL_OVERBUILD" } });
  });

  it("rejects missing cards and late affordability failures without mutation", () => {
    const base = withCard(buildState("canal", 7, 3), INDUSTRY_MANUFACTURER);
    const initial: BuildActionState = {
      ...base,
      builtLinks: { link_birmingham_dudley: "alice" },
      placements: {
        dudley_1: placement("bob", "dudley_1", "dudley", "coal-1-a", {
          coal: 1,
        }),
      },
    };
    const validExceptMoney = build(
      "birmingham_1",
      "manufacturer",
      INDUSTRY_MANUFACTURER,
      [{ kind: "mine", buildSpaceId: "dudley_1" }],
    );
    const snapshot = structuredClone(initial);
    const broke = executeBuildAction(initial, validExceptMoney);
    expect(broke).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_MONEY" },
    });
    expect(broke.state).toBe(initial);
    expect(initial).toEqual(snapshot);

    const enough = { ...initial, player: { ...initial.player, money: 8 } };
    const missing = executeBuildAction(enough, {
      ...validExceptMoney,
      cardId: WILD_LOCATION_CARD_ID,
    });
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missing.state).toBe(enough);
    expect(enough.placements.dudley_1.resources.coal).toBe(1);
    expect(JSON.parse(JSON.stringify(broke))).toEqual(broke);

    const unknownSeat: BuildActionState = {
      ...withCard(buildState("canal", 5), LOCATION_CANN0CK),
      seat: "carol",
    };
    const unknown = executeBuildAction(
      unknownSeat,
      build("cannock_2", "coal", LOCATION_CANN0CK),
    );
    expect(unknown).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(unknown.state).toBe(unknownSeat);
  });

  it("returns typed failures for malformed state and action payloads", () => {
    const initial = buildState();
    const invalidState = {
      ...initial,
      builtLinks: { not_a_link: "alice" },
    };
    expect(
      executeBuildAction(
        invalidState,
        build("cannock_2", "coal", LOCATION_CANN0CK),
      ),
    ).toMatchObject({
      ok: false,
      state: invalidState,
      error: { code: "INVALID_BUILD_STATE" },
    });

    for (const malformed of [
      null,
      {
        buildSpaceId: "cannock_2",
        industry: "coal",
        cardId: LOCATION_CANN0CK,
        coalSources: null,
        ironSources: [],
      },
      {
        buildSpaceId: "cannock_2",
        industry: "not-an-industry",
        cardId: LOCATION_CANN0CK,
        coalSources: [],
        ironSources: [],
      },
    ]) {
      const result = executeBuildAction(
        initial,
        malformed as unknown as BuildActionSelection,
      );
      expect(result).toMatchObject({
        ok: false,
        state: initial,
        error: { code: "INVALID_BUILD_SELECTION" },
      });
    }
  });
});

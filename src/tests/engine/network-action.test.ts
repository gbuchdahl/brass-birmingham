import { describe, expect, it } from "vitest";
import {
  executeNetworkAction,
  planNetworkAction,
  type NetworkActionSelection,
  type NetworkActionState,
  type NetworkIndustryState,
} from "@/engine/actions-v2/network";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "@/engine/cards-v2/types";
import { createResourceMarketState } from "@/engine/economy/markets";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

const CARD_SETUP = createCanalSetup(
  ["alice", "bob"],
  "network-action-cards",
);
const REGULAR_ACTION_CARD_ID = CARD_SETUP.hands.alice[0];

function industry(
  owner: string,
  locationId: string,
  kind: NetworkIndustryState["kind"] = "manufacturer",
  coal = 0,
  beer = 0,
): NetworkIndustryState {
  return {
    owner,
    locationId,
    kind,
    resources: { coal, beer },
    flipped: false,
  };
}

function networkState(
  era: NetworkActionState["era"] = "canal",
  money = 30,
): NetworkActionState {
  const cards = createCanalSetup(
    ["alice", "bob"],
    "network-action-cards",
  );
  return {
    era,
    seat: "alice",
    player: { money },
    builtLinks: {},
    industries: {
      alice_birmingham: industry("alice", "birmingham"),
    },
    market: createResourceMarketState(),
    cards: {
      hands: cards.hands,
      draw: cards.draw,
      discard: cards.discard,
      wildSupplies: cards.wildSupplies,
    },
  };
}

function selection(
  linkIds: readonly string[],
  coalSources: NetworkActionSelection["coalSources"] = [],
  beerSourceId: string | null = null,
  cardId: PlayableCardId = REGULAR_ACTION_CARD_ID,
): NetworkActionSelection {
  return { linkIds, coalSources, beerSourceId, cardId };
}

function requireSuccess(
  result: ReturnType<typeof executeNetworkAction>,
): Extract<ReturnType<typeof executeNetworkAction>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Canal Network action", () => {
  it("allows the first link anywhere when the player has no board presence", () => {
    const base = networkState("canal", 3);
    const initial: NetworkActionState = {
      ...base,
      industries: {
        bob_dudley: industry("bob", "dudley"),
      },
    };

    const result = requireSuccess(
      executeNetworkAction(
        initial,
        selection(["link_birmingham_coventry"]),
      ),
    );

    expect(result.state.builtLinks.link_birmingham_coventry).toBe("alice");
  });

  it("builds exactly one canal for £3 at the money boundary", () => {
    const initial = networkState("canal", 3);
    const action = selection(["link_birmingham_coventry"]);
    const planned = planNetworkAction(initial, action);
    const executed = requireSuccess(executeNetworkAction(initial, action));

    expect(planned).toMatchObject({
      ok: true,
      state: initial,
      plan: { linkCost: 3, resourceCost: 0, moneySpent: 3 },
    });
    if (!planned.ok) throw new Error(planned.error.message);
    expect(planned.state).toBe(initial);
    expect(initial.cards.hands.alice).toContain(REGULAR_ACTION_CARD_ID);
    expect(planned.plan).toMatchObject({
      discardedCardId: REGULAR_ACTION_CARD_ID,
      actionsConsumed: 1,
    });
    expect(executed.state.player.money).toBe(0);
    expect(executed.state.builtLinks).toEqual({
      link_birmingham_coventry: "alice",
    });
    expect(executed.state.cards.hands.alice).not.toContain(
      REGULAR_ACTION_CARD_ID,
    );
    expect(executed.state.cards.discard.at(-1)).toBe(
      REGULAR_ACTION_CARD_ID,
    );
    expect(executed.effect).toMatchObject({
      era: "canal",
      discardedCardId: REGULAR_ACTION_CARD_ID,
      actionsConsumed: 1,
      coalSources: [],
      beerSource: null,
      linkCost: 3,
      resourceCost: 0,
      moneySpent: 3,
    });
  });

  it.each([
    [WILD_LOCATION_CARD_ID, "location"],
    [WILD_INDUSTRY_CARD_ID, "industry"],
  ] as const)("returns %s to its shared supply", (wild, supply) => {
    const base = networkState("canal", 3);
    const initial: NetworkActionState = {
      ...base,
      cards: {
        ...base.cards,
        hands: {
          ...base.cards.hands,
          alice: [...base.cards.hands.alice, wild],
        },
        wildSupplies: { ...base.cards.wildSupplies, [supply]: 3 },
      },
    };

    const result = requireSuccess(
      executeNetworkAction(
        initial,
        selection(["link_birmingham_coventry"], [], null, wild),
      ),
    );

    expect(result.state.cards.hands.alice).not.toContain(wild);
    expect(result.state.cards.wildSupplies[supply]).toBe(4);
    expect(result.state.cards.discard).toBe(initial.cards.discard);
    expect(result.effect.discardedCardId).toBe(wild);
  });

  it("validates a chosen card last and rejects card errors atomically", () => {
    const initial = networkState("canal", 3);
    const missingCard = WILD_LOCATION_CARD_ID;
    const snapshot = structuredClone(initial);
    const missing = executeNetworkAction(
      initial,
      selection(["link_birmingham_coventry"], [], null, missingCard),
    );

    expect(missing).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missing.state).toBe(initial);
    expect(initial).toEqual(snapshot);

    const missingPlan = planNetworkAction(
      initial,
      selection(["link_birmingham_coventry"], [], null, missingCard),
    );
    expect(missingPlan).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missingPlan.state).toBe(initial);
    expect(initial).toEqual(snapshot);

    const broke = { ...initial, player: { money: 2 } };
    expect(
      executeNetworkAction(
        broke,
        selection(["link_birmingham_coventry"], [], null, missingCard),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_MONEY" },
    });

    const unknownSeat: NetworkActionState = {
      ...initial,
      seat: "carol",
      industries: {
        carol_birmingham: industry("carol", "birmingham"),
      },
    };
    const unknown = executeNetworkAction(
      unknownSeat,
      selection(["link_birmingham_coventry"]),
    );
    expect(unknown).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(unknown.state).toBe(unknownSeat);
  });

  it("rejects unaffordable, multi-link, and resource-bearing canal plans atomically", () => {
    const broke = networkState("canal", 2);
    const valid = selection(["link_birmingham_coventry"]);
    expect(executeNetworkAction(broke, valid)).toMatchObject({
      ok: false,
      state: broke,
      error: { code: "INSUFFICIENT_MONEY" },
    });

    const initial = networkState("canal");
    const invalidPlans = [
      selection([
        "link_birmingham_coventry",
        "link_birmingham_dudley",
      ]),
      selection(["link_birmingham_coventry"], [{ kind: "market" }]),
      selection(["link_birmingham_coventry"], [], "alice_birmingham"),
    ];
    for (const action of invalidPlans) {
      const result = executeNetworkAction(initial, action);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(initial);
    }
  });
});

describe("Rail Network action", () => {
  it("builds one rail for £5 and consumes exactly one connected coal", () => {
    const base = networkState("rail", 5);
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        bob_coal: industry("bob", "nuneaton", "coal_mine", 1),
      },
    };
    const result = requireSuccess(
      executeNetworkAction(
        initial,
        selection(
          ["link_birmingham_nuneaton"],
          [{ kind: "mine", industryId: "bob_coal" }],
        ),
      ),
    );

    expect(result.state.player.money).toBe(0);
    expect(result.state.industries.bob_coal).toMatchObject({
      resources: { coal: 0 },
      flipped: true,
    });
    expect(result.effect).toMatchObject({
      linkCost: 5,
      resourceCost: 0,
      moneySpent: 5,
      coalSources: [
        {
          kind: "mine",
          industryId: "bob_coal",
          locationId: "nuneaton",
          depleted: true,
        },
      ],
      flippedIndustryIds: ["bob_coal"],
    });
  });

  it("buys connected market coal and includes its exact price in spending", () => {
    const initial = networkState("rail", 6);
    const action = selection(
      ["link_birmingham_oxford"],
      [{ kind: "market" }],
    );
    const result = requireSuccess(executeNetworkAction(initial, action));

    expect(result.state.player.money).toBe(0);
    expect(result.state.market.coal).toBe(initial.market.coal - 1);
    expect(result.effect).toMatchObject({
      linkCost: 5,
      resourceCost: 1,
      moneySpent: 6,
      coalSources: [{ kind: "market", unitPrice: 1 }],
    });

    const short = { ...initial, player: { money: 5 } };
    const rejected = executeNetworkAction(short, action);
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_MONEY" },
    });
    expect(rejected.state).toBe(short);
    expect(short.market.coal).toBe(initial.market.coal);
  });

  it("builds two sequentially adjacent rails for £15, two coal, and own beer", () => {
    const base = networkState("rail", 15);
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        connected_coal: industry("bob", "nuneaton", "coal_mine", 2),
        alice_brewery: industry("alice", "stafford", "brewery", 0, 1),
      },
    };
    const result = requireSuccess(
      executeNetworkAction(
        initial,
        selection(
          ["link_birmingham_nuneaton", "link_coventry_nuneaton"],
          [
            { kind: "mine", industryId: "connected_coal" },
            { kind: "mine", industryId: "connected_coal" },
          ],
          "alice_brewery",
        ),
      ),
    );

    expect(result.state.player.money).toBe(0);
    expect(result.state.builtLinks).toMatchObject({
      link_birmingham_nuneaton: "alice",
      link_coventry_nuneaton: "alice",
    });
    expect(result.state.industries.connected_coal.resources.coal).toBe(0);
    expect(result.state.industries.alice_brewery.resources.beer).toBe(0);
    expect(result.effect).toMatchObject({
      linkCost: 15,
      resourceCost: 0,
      moneySpent: 15,
      beerSource: {
        industryId: "alice_brewery",
        depleted: true,
      },
      flippedIndustryIds: ["connected_coal", "alice_brewery"],
    });
  });

  it("prices two sequential market coal purchases and spends £18 total", () => {
    const base = networkState("rail", 18);
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        alice_brewery: industry("alice", "stafford", "brewery", 0, 2),
      },
    };
    const result = requireSuccess(
      executeNetworkAction(
        initial,
        selection(
          ["link_birmingham_oxford", "link_redditch_oxford"],
          [{ kind: "market" }, { kind: "market" }],
          "alice_brewery",
        ),
      ),
    );

    expect(result.state.player.money).toBe(0);
    expect(result.state.market.coal).toBe(11);
    expect(result.effect.coalSources).toEqual([
      { kind: "market", unitPrice: 1 },
      { kind: "market", unitPrice: 2 },
    ]);
    expect(result.effect).toMatchObject({
      linkCost: 15,
      resourceCost: 3,
      moneySpent: 18,
    });
    expect(result.state.industries.alice_brewery).toMatchObject({
      resources: { beer: 1 },
      flipped: false,
    });
  });

  it("requires exactly one coal choice per rail and beer only for two rails", () => {
    const initial = networkState("rail");
    const invalid = [
      selection(["link_birmingham_nuneaton"]),
      selection(
        ["link_birmingham_nuneaton"],
        [{ kind: "market" }, { kind: "market" }],
      ),
      selection(
        ["link_birmingham_nuneaton", "link_coventry_nuneaton"],
        [{ kind: "market" }, { kind: "market" }],
      ),
      selection(
        ["link_birmingham_nuneaton"],
        [{ kind: "market" }],
        "unused_brewery",
      ),
    ];

    for (const action of invalid) {
      const result = executeNetworkAction(initial, action);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(initial);
    }
  });

  it("rejects unavailable, disconnected, non-nearest, and premature market coal", () => {
    const base = networkState("rail");
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        near_coal: industry("bob", "nuneaton", "coal_mine", 1),
        far_coal: industry("bob", "coventry", "coal_mine", 1),
        disconnected_coal: industry("bob", "belper", "coal_mine", 1),
        empty_coal: industry("bob", "birmingham", "coal_mine", 0),
      },
      builtLinks: { link_coventry_nuneaton: "bob" },
    };
    const link = ["link_birmingham_nuneaton"];
    const cases = [
      [
        { kind: "mine", industryId: "missing" } as const,
        "COAL_SOURCE_UNAVAILABLE",
      ],
      [
        { kind: "mine", industryId: "empty_coal" } as const,
        "COAL_SOURCE_UNAVAILABLE",
      ],
      [
        { kind: "mine", industryId: "disconnected_coal" } as const,
        "COAL_SOURCE_NOT_CONNECTED",
      ],
      [
        { kind: "mine", industryId: "far_coal" } as const,
        "COAL_SOURCE_PRIORITY",
      ],
      [{ kind: "market" } as const, "COAL_SOURCE_PRIORITY"],
    ] as const;

    for (const [coalSource, code] of cases) {
      const result = executeNetworkAction(
        initial,
        selection(link, [coalSource]),
      );
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(result.state).toBe(initial);
    }
  });

  it("requires market connectivity when no connected coal mine exists", () => {
    const initial = networkState("rail");
    const result = executeNetworkAction(
      initial,
      selection(["link_birmingham_nuneaton"], [{ kind: "market" }]),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "COAL_MARKET_NOT_CONNECTED" },
    });
    expect(result.state).toBe(initial);
  });

  it("requires the two-link beer to be available and owned by the actor", () => {
    const base = networkState("rail");
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        coal: industry("bob", "nuneaton", "coal_mine", 2),
        bob_brewery: industry("bob", "stafford", "brewery", 0, 1),
        empty_brewery: industry("alice", "stafford", "brewery"),
      },
    };
    const links = ["link_birmingham_nuneaton", "link_coventry_nuneaton"];
    const coal = [
      { kind: "mine", industryId: "coal" } as const,
      { kind: "mine", industryId: "coal" } as const,
    ];

    expect(
      executeNetworkAction(initial, selection(links, coal, "bob_brewery")),
    ).toMatchObject({ ok: false, error: { code: "BEER_NOT_OWNED" } });
    expect(
      executeNetworkAction(initial, selection(links, coal, "empty_brewery")),
    ).toMatchObject({
      ok: false,
      error: { code: "BEER_SOURCE_UNAVAILABLE" },
    });
  });
});

describe("Network topology validation", () => {
  it("rejects unknown, wrong-era, duplicate, and occupied physical links", () => {
    const canal = networkState("canal");
    const occupied = {
      ...canal,
      builtLinks: { link_birmingham_coventry: "bob" },
    };
    const cases: Array<
      [NetworkActionState, NetworkActionSelection, string]
    > = [
      [canal, selection(["not_a_link"]), "UNKNOWN_LINK"],
      [
        canal,
        selection(["link_birmingham_nuneaton"]),
        "LINK_NOT_AVAILABLE_IN_ERA",
      ],
      [
        networkState("rail"),
        selection(
          ["link_birmingham_nuneaton", "link_birmingham_nuneaton"],
          [{ kind: "market" }, { kind: "market" }],
          "unused",
        ),
        "DUPLICATE_LINK",
      ],
      [
        occupied,
        selection(["link_birmingham_coventry"]),
        "LINK_ALREADY_BUILT",
      ],
      [
        networkState("rail"),
        selection(
          ["link_burton_on_trent_walsall"],
          [{ kind: "market" }],
        ),
        "LINK_NOT_AVAILABLE_IN_ERA",
      ],
    ];

    for (const [state, action, code] of cases) {
      expect(executeNetworkAction(state, action)).toMatchObject({
        ok: false,
        state,
        error: { code },
      });
    }
  });

  it("requires each link to extend the actor's industries or owned links", () => {
    const disconnected = networkState("canal");
    expect(
      executeNetworkAction(
        disconnected,
        selection(["link_belper_derby"]),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "LINK_NOT_IN_PLAYER_NETWORK" },
    });

    const opponentOnly: NetworkActionState = {
      ...disconnected,
      industries: {
        alice_stafford: industry("alice", "stafford"),
      },
      builtLinks: { link_birmingham_coventry: "bob" },
    };
    expect(
      executeNetworkAction(
        opponentOnly,
        selection(["link_birmingham_dudley"]),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "LINK_NOT_IN_PLAYER_NETWORK" },
    });

    const ownedLink: NetworkActionState = {
      ...opponentOnly,
      builtLinks: { link_birmingham_coventry: "alice" },
    };
    expect(
      executeNetworkAction(
        ownedLink,
        selection(["link_birmingham_dudley"]),
      ).ok,
    ).toBe(true);
  });

  it("rejects a disconnected second rail even when the first is legal", () => {
    const base = networkState("rail");
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        coal: industry("bob", "nuneaton", "coal_mine", 2),
        brewery: industry("alice", "stafford", "brewery", 0, 1),
      },
    };
    const result = executeNetworkAction(
      initial,
      selection(
        ["link_birmingham_nuneaton", "link_belper_leek"],
        [
          { kind: "mine", industryId: "coal" },
          { kind: "mine", industryId: "coal" },
        ],
        "brewery",
      ),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "LINK_NOT_IN_PLAYER_NETWORK" },
    });
    expect(result.state).toBe(initial);
  });

  it("is immutable, atomic on late failure, and JSON-safe", () => {
    const base = networkState("rail", 14);
    const initial: NetworkActionState = {
      ...base,
      industries: {
        ...base.industries,
        coal: industry("bob", "nuneaton", "coal_mine", 2),
        brewery: industry("alice", "stafford", "brewery", 0, 1),
      },
    };
    const snapshot = structuredClone(initial);
    const action = selection(
      ["link_birmingham_nuneaton", "link_coventry_nuneaton"],
      [
        { kind: "mine", industryId: "coal" },
        { kind: "mine", industryId: "coal" },
      ],
      "brewery",
    );

    const rejected = executeNetworkAction(initial, action);
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_MONEY" },
    });
    expect(rejected.state).toBe(initial);
    expect(initial).toEqual(snapshot);

    const accepted = requireSuccess(
      executeNetworkAction({ ...initial, player: { money: 15 } }, action),
    );
    expect(JSON.parse(JSON.stringify(accepted))).toEqual(accepted);
  });
});

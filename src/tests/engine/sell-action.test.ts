import { describe, expect, it } from "vitest";
import {
  sellAction,
  type SellActionSelection,
  type SellActionState,
  type SellIndustryState,
  type SellMerchantSpaceState,
  type SellTileSelection,
} from "@/engine/actions-v2/sell";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "@/engine/cards-v2/types";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import {
  MERCHANT_TILE_CATALOG,
  type RulesMerchantTileId,
} from "@/engine/rules/generated/merchant-tiles";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

function industry(
  owner: string,
  locationId: string,
  faceId: SellIndustryState["faceId"],
  product: 0 | 1 = 1,
  flipped = product === 0,
): SellIndustryState {
  return { owner, locationId, faceId, product, beer: 0, flipped };
}

function brewery(
  owner: string,
  locationId: string,
  beer: number,
): SellIndustryState {
  return {
    owner,
    locationId,
    faceId: "brewery-2",
    product: 0,
    beer,
    flipped: beer === 0,
  };
}

function merchant(
  locationId: string,
  tileId: RulesMerchantTileId,
  beer: 0 | 1,
): SellMerchantSpaceState {
  const location = BOARD_V2.locations[
    locationId as keyof typeof BOARD_V2.locations
  ];
  if (location.kind !== "merchant") throw new Error("Expected Merchant location");
  const tile = MERCHANT_TILE_CATALOG.find((candidate) => candidate.id === tileId);
  if (!tile) throw new Error("Expected Merchant tile");
  return {
    locationId,
    merchantSpaceId: location.merchantSpaces[0],
    active: true,
    tileId,
    demandIndustries: [...tile.demandIndustries],
    beer,
  };
}

function inactiveMerchant(locationId = "merchant_oxford"): SellMerchantSpaceState {
  const location = BOARD_V2.locations[
    locationId as keyof typeof BOARD_V2.locations
  ];
  if (location.kind !== "merchant") throw new Error("Expected Merchant location");
  return {
    locationId,
    merchantSpaceId: location.merchantSpaces[0],
    active: false,
    tileId: null,
    demandIndustries: [],
    beer: 0,
  };
}

function sellState(seed = "sell-action"): SellActionState {
  const setup = createCanalSetup(["alice", "bob"], seed);
  return {
    seat: "alice",
    player: { money: 17, victoryPoints: 0, incomeMarkerSpace: 10 },
    cards: {
      hands: setup.hands,
      draw: setup.draw,
      discard: setup.discard,
      wildSupplies: setup.wildSupplies,
    },
    builtLinks: { link_birmingham_oxford: "bob" },
    industries: {
      cotton: industry("alice", "birmingham", "cotton-1"),
      own_brewery: brewery("alice", "stafford", 1),
    },
    merchantSpaces: [
      merchant("merchant_oxford", "merchant_universal_2p", 1),
    ],
  };
}

function sale(
  industryId: string,
  merchantSpaceId: string,
  beerSource: SellTileSelection["beerSource"] = { kind: "merchant" },
): SellTileSelection {
  return { industryId, merchantSpaceId, beerSource };
}

function selection(
  state: SellActionState,
  sales: readonly SellTileSelection[],
  cardId: PlayableCardId = state.cards.hands[state.seat][0],
): SellActionSelection {
  return { cardId, sales };
}

function requireSuccess(
  result: ReturnType<typeof sellAction>,
): Extract<ReturnType<typeof sellAction>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("atomic Sell action", () => {
  it("sells one product, consumes Merchant beer, flips, advances income, and discards one card", () => {
    const initial = sellState("sell-single");
    const merchantSpaceId = initial.merchantSpaces[0].merchantSpaceId;
    const cardId = initial.cards.hands.alice[2];
    const result = requireSuccess(
      sellAction(
        initial,
        selection(initial, [sale("cotton", merchantSpaceId)], cardId),
      ),
    );

    expect(result.state.industries.cotton).toMatchObject({
      product: 0,
      flipped: true,
    });
    expect(result.state.merchantSpaces[0].beer).toBe(0);
    expect(result.state.player.incomeMarkerSpace).toBe(17);
    expect(result.state.cards.hands.alice).not.toContain(cardId);
    expect(result.state.cards.discard.at(-1)).toBe(cardId);
    expect(result.effect).toMatchObject({
      type: "SOLD",
      seat: "alice",
      discardedCardId: cardId,
      actionsConsumed: 1,
      moneySpent: 0,
      soldIndustryIds: ["cotton"],
      rewards: {
        industryIncomeSpacesPrinted: 5,
        incomeSpacesAdvanced: 7,
        money: 0,
        victoryPoints: 0,
        freeDevelops: 0,
      },
      sales: [
        {
          industryId: "cotton",
          industryKind: "cotton_mill",
          income: {
            printedSpaces: 5,
            fromMarkerSpace: 10,
            toMarkerSpace: 15,
            spacesAdvanced: 5,
          },
          beer: {
            kind: "merchant",
            bonus: {
              kind: "income_spaces",
              amount: 2,
              fromMarkerSpace: 15,
              toMarkerSpace: 17,
              spacesAdvanced: 2,
            },
          },
        },
      ],
    });
  });

  it("sells multiple demand types through a universal Merchant in caller order", () => {
    const base = sellState("sell-multiple-universal");
    const merchantSpaceId = base.merchantSpaces[0].merchantSpaceId;
    const initial: SellActionState = {
      ...base,
      builtLinks: {
        link_birmingham_oxford: "bob",
        link_birmingham_coventry: "alice",
        link_birmingham_tamworth: "bob",
      },
      industries: {
        cotton: industry("alice", "birmingham", "cotton-1"),
        goods: industry("alice", "birmingham", "manufacturer-2"),
        pottery: industry("alice", "coventry", "pottery-1"),
        connected_brewery: brewery("bob", "tamworth", 2),
      },
    };
    const result = requireSuccess(
      sellAction(
        initial,
        selection(initial, [
          sale("cotton", merchantSpaceId),
          sale("goods", merchantSpaceId, {
            kind: "brewery",
            industryId: "connected_brewery",
          }),
          sale("pottery", merchantSpaceId, {
            kind: "brewery",
            industryId: "connected_brewery",
          }),
        ]),
      ),
    );

    expect(result.effect.sales.map((entry) => entry.industryKind)).toEqual([
      "cotton_mill",
      "manufacturer",
      "pottery",
    ]);
    expect(result.effect.sales.map((entry) => entry.beer.kind)).toEqual([
      "merchant",
      "brewery",
      "brewery",
    ]);
    expect(result.state.industries.connected_brewery).toMatchObject({
      beer: 0,
      flipped: true,
    });
    expect(result.effect.rewards).toMatchObject({
      incomeSpacesAdvanced: 12,
      money: 0,
      victoryPoints: 0,
    });
    expect(result.effect.soldIndustryIds).toEqual(["cotton", "goods", "pottery"]);
  });

  it.each([
    ["cotton_mill", "cotton-1", "merchant_cotton_mill_2p", "birmingham", "link_birmingham_oxford"],
    ["manufacturer", "manufacturer-1", "merchant_manufacturer_2p", "birmingham", "link_birmingham_oxford"],
    ["pottery", "pottery-1", "merchant_pottery_3p", "redditch", "link_redditch_oxford"],
  ] as const)(
    "accepts exact %s demand",
    (kind, faceId, tileId, locationId, linkId) => {
      const base = sellState(`sell-demand-${kind}`);
      const exactMerchant = merchant("merchant_oxford", tileId, 1);
      const initial: SellActionState = {
        ...base,
        builtLinks: { [linkId]: "bob" },
        industries: {
          product: industry("alice", locationId, faceId),
        },
        merchantSpaces: [exactMerchant],
      };
      const result = requireSuccess(
        sellAction(
          initial,
          selection(initial, [
            sale("product", exactMerchant.merchantSpaceId),
          ]),
        ),
      );

      expect(result.effect.sales[0].industryKind).toBe(kind);
    },
  );
});

describe("Sell beer eligibility and priority", () => {
  it("requires available beer on the chosen Merchant before any Brewery", () => {
    const initial = sellState("sell-merchant-priority");
    const result = sellAction(
      initial,
      selection(initial, [
        sale("cotton", initial.merchantSpaces[0].merchantSpaceId, {
          kind: "brewery",
          industryId: "own_brewery",
        }),
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "MERCHANT_BEER_REQUIRED", selectionIndex: 0 },
    });
    expect(result.state).toBe(initial);
  });

  it("uses connected opponent Brewery beer when the Merchant is empty", () => {
    const base = sellState("sell-opponent-connected-beer");
    const initial: SellActionState = {
      ...base,
      builtLinks: {
        link_birmingham_oxford: "alice",
        link_birmingham_tamworth: "bob",
      },
      industries: {
        cotton: base.industries.cotton,
        opponent_brewery: brewery("bob", "tamworth", 1),
      },
      merchantSpaces: [{ ...base.merchantSpaces[0], beer: 0 }],
    };
    const result = requireSuccess(
      sellAction(
        initial,
        selection(initial, [
          sale("cotton", initial.merchantSpaces[0].merchantSpaceId, {
            kind: "brewery",
            industryId: "opponent_brewery",
          }),
        ]),
      ),
    );

    expect(result.state.industries.opponent_brewery).toMatchObject({
      beer: 0,
      flipped: true,
    });
    expect(result.effect.sales[0].beer).toEqual({
      kind: "brewery",
      industryId: "opponent_brewery",
      owner: "bob",
      locationId: "tamworth",
      beerRemaining: 0,
      depleted: true,
    });
    expect(result.state.player.incomeMarkerSpace).toBe(15);
    expect(result.effect.rewards).toMatchObject({
      incomeSpacesAdvanced: 5,
      money: 0,
      victoryPoints: 0,
      freeDevelops: 0,
    });
  });

  it("rejects disconnected opponent beer but permits own disconnected beer", () => {
    const base = sellState("sell-disconnected-beer");
    const emptyMerchant = { ...base.merchantSpaces[0], beer: 0 as const };
    const opponent: SellActionState = {
      ...base,
      industries: {
        cotton: base.industries.cotton,
        far_brewery: brewery("bob", "stafford", 1),
      },
      merchantSpaces: [emptyMerchant],
    };
    const opponentResult = sellAction(
      opponent,
      selection(opponent, [
        sale("cotton", emptyMerchant.merchantSpaceId, {
          kind: "brewery",
          industryId: "far_brewery",
        }),
      ]),
    );
    expect(opponentResult).toMatchObject({
      ok: false,
      error: { code: "BREWERY_NOT_CONNECTED" },
    });
    expect(opponentResult.state).toBe(opponent);

    const own: SellActionState = {
      ...opponent,
      industries: {
        ...opponent.industries,
        far_brewery: brewery("alice", "stafford", 1),
      },
    };
    const ownResult = requireSuccess(
      sellAction(
        own,
        selection(own, [
          sale("cotton", emptyMerchant.merchantSpaceId, {
            kind: "brewery",
            industryId: "far_brewery",
          }),
        ]),
      ),
    );
    expect(ownResult.state.industries.far_brewery.beer).toBe(0);
  });

  it("rejects Merchant selection when its beer is gone", () => {
    const base = sellState("sell-empty-merchant");
    const initial: SellActionState = {
      ...base,
      merchantSpaces: [{ ...base.merchantSpaces[0], beer: 0 }],
    };
    const result = sellAction(
      initial,
      selection(initial, [
        sale("cotton", initial.merchantSpaces[0].merchantSpaceId),
      ]),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "MERCHANT_BEER_UNAVAILABLE" },
    });
  });

  it("validates ordered shared beer consumption without double-use", () => {
    const base = sellState("sell-shared-beer-atomic");
    const initial: SellActionState = {
      ...base,
      industries: {
        cotton: base.industries.cotton,
        goods: industry("alice", "birmingham", "manufacturer-1"),
        only_brewery: brewery("alice", "stafford", 1),
      },
      merchantSpaces: [{ ...base.merchantSpaces[0], beer: 0 }],
    };
    const snapshot = structuredClone(initial);
    const result = sellAction(
      initial,
      selection(initial, [
        sale("cotton", initial.merchantSpaces[0].merchantSpaceId, {
          kind: "brewery",
          industryId: "only_brewery",
        }),
        sale("goods", initial.merchantSpaces[0].merchantSpaceId, {
          kind: "brewery",
          industryId: "only_brewery",
        }),
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "BREWERY_UNAVAILABLE", selectionIndex: 1 },
    });
    expect(result.state).toBe(initial);
    expect(initial).toEqual(snapshot);
  });
});

describe("Merchant beer bonuses", () => {
  it.each([
    ["merchant_warrington", "stoke_on_trent", "link_stoke_on_trent_warrington", "money", 5],
    ["merchant_nottingham", "derby", "link_derby_nottingham", "victory_points", 3],
    ["merchant_shrewsbury", "coalbrookdale", "link_coalbrookdale_shrewsbury", "victory_points", 4],
    ["merchant_gloucester", "worcester", "link_gloucester_worcester", "free_develop", 1],
    ["merchant_oxford", "birmingham", "link_birmingham_oxford", "income_spaces", 2],
  ] as const)(
    "applies the printed %s bonus at %s",
    (merchantLocationId, productLocationId, linkId, bonusKind, amount) => {
      const base = sellState(`sell-bonus-${bonusKind}-${merchantLocationId}`);
      const bonusMerchant = merchant(
        merchantLocationId,
        "merchant_universal_2p",
        1,
      );
      const initial: SellActionState = {
        ...base,
        builtLinks: { [linkId]: "bob" },
        industries: {
          goods: industry("alice", productLocationId, "manufacturer-1"),
        },
        merchantSpaces: [bonusMerchant],
      };
      const result = requireSuccess(
        sellAction(
          initial,
          selection(initial, [sale("goods", bonusMerchant.merchantSpaceId)]),
        ),
      );

      expect(result.effect.sales[0].beer).toMatchObject({
        kind: "merchant",
        locationId: merchantLocationId,
        bonus: { kind: bonusKind, amount },
      });
      expect(result.state.player.money).toBe(17 + (bonusKind === "money" ? amount : 0));
      expect(result.state.player.victoryPoints).toBe(
        bonusKind === "victory_points" ? amount : 0,
      );
      expect(result.effect.rewards.freeDevelops).toBe(
        bonusKind === "free_develop" ? amount : 0,
      );
      expect(result.state.player.incomeMarkerSpace).toBe(
        15 + (bonusKind === "income_spaces" ? amount : 0),
      );
    },
  );

  it("caps Industry and Merchant income at the final progress-track space", () => {
    const base = sellState("sell-income-cap");
    const initial: SellActionState = {
      ...base,
      player: { ...base.player, incomeMarkerSpace: 98 },
    };
    const result = requireSuccess(
      sellAction(
        initial,
        selection(initial, [
          sale("cotton", initial.merchantSpaces[0].merchantSpaceId),
        ]),
      ),
    );

    expect(result.state.player.incomeMarkerSpace).toBe(100);
    expect(result.effect.rewards).toMatchObject({
      industryIncomeSpacesPrinted: 5,
      incomeSpacesAdvanced: 2,
    });
    expect(result.effect.sales[0]).toMatchObject({
      income: {
        fromMarkerSpace: 98,
        toMarkerSpace: 100,
        spacesAdvanced: 2,
      },
      beer: {
        bonus: {
          kind: "income_spaces",
          amount: 2,
          fromMarkerSpace: 100,
          toMarkerSpace: 100,
          spacesAdvanced: 0,
        },
      },
    });
  });
});

describe("Sell validation, cards, and atomicity", () => {
  it.each([
    ["cotton_mill", "merchant_manufacturer_2p"],
    ["manufacturer", "merchant_pottery_3p"],
    ["pottery", "merchant_cotton_mill_2p"],
  ] as const)("rejects %s at a mismatched Merchant", (kind, tileId) => {
    const faceId = {
      cotton_mill: "cotton-1",
      manufacturer: "manufacturer-1",
      pottery: "pottery-1",
    }[kind] as SellIndustryState["faceId"];
    const base = sellState(`sell-mismatch-${kind}`);
    const mismatched = merchant("merchant_oxford", tileId, 1);
    const initial: SellActionState = {
      ...base,
      industries: { product: industry("alice", "birmingham", faceId) },
      merchantSpaces: [mismatched],
    };
    const result = sellAction(
      initial,
      selection(initial, [sale("product", mismatched.merchantSpaceId)]),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "MERCHANT_DEMAND_MISMATCH" },
    });
    expect(result.state).toBe(initial);
  });

  it("rejects blank, inactive, and disconnected Merchants", () => {
    const base = sellState("sell-merchant-errors");
    const blank = merchant("merchant_oxford", "merchant_blank_2p_01", 0);
    const blankState: SellActionState = { ...base, merchantSpaces: [blank] };
    expect(
      sellAction(
        blankState,
        selection(blankState, [sale("cotton", blank.merchantSpaceId)]),
      ),
    ).toMatchObject({ ok: false, error: { code: "MERCHANT_DEMAND_MISMATCH" } });

    const inactive = inactiveMerchant();
    const inactiveState: SellActionState = {
      ...base,
      merchantSpaces: [inactive],
    };
    expect(
      sellAction(
        inactiveState,
        selection(inactiveState, [sale("cotton", inactive.merchantSpaceId)]),
      ),
    ).toMatchObject({ ok: false, error: { code: "MERCHANT_INACTIVE" } });

    const disconnected: SellActionState = { ...base, builtLinks: {} };
    expect(
      sellAction(
        disconnected,
        selection(disconnected, [
          sale("cotton", disconnected.merchantSpaces[0].merchantSpaceId),
        ]),
      ),
    ).toMatchObject({ ok: false, error: { code: "MERCHANT_NOT_CONNECTED" } });
  });

  it("rejects empty, duplicate, unknown, opponent, flipped, and nonsellable selections", () => {
    const base = sellState("sell-tile-errors");
    expect(sellAction(base, selection(base, []))).toMatchObject({
      ok: false,
      error: { code: "INVALID_SALE_COUNT" },
    });
    const merchantSpaceId = base.merchantSpaces[0].merchantSpaceId;
    expect(
      sellAction(
        base,
        selection(base, [sale("cotton", merchantSpaceId), sale("cotton", merchantSpaceId)]),
      ),
    ).toMatchObject({ ok: false, error: { code: "DUPLICATE_INDUSTRY" } });
    expect(
      sellAction(base, selection(base, [sale("missing", merchantSpaceId)])),
    ).toMatchObject({ ok: false, error: { code: "UNKNOWN_INDUSTRY" } });

    const opponent: SellActionState = {
      ...base,
      industries: {
        ...base.industries,
        cotton: industry("bob", "birmingham", "cotton-1"),
      },
    };
    expect(
      sellAction(opponent, selection(opponent, [sale("cotton", merchantSpaceId)])),
    ).toMatchObject({ ok: false, error: { code: "INDUSTRY_NOT_OWNED" } });

    const flipped: SellActionState = {
      ...base,
      industries: { ...base.industries, cotton: industry("alice", "birmingham", "cotton-1", 0) },
    };
    expect(
      sellAction(flipped, selection(flipped, [sale("cotton", merchantSpaceId)])),
    ).toMatchObject({ ok: false, error: { code: "INDUSTRY_ALREADY_FLIPPED" } });
    expect(
      sellAction(base, selection(base, [sale("own_brewery", merchantSpaceId)])),
    ).toMatchObject({ ok: false, error: { code: "INDUSTRY_NOT_SELLABLE" } });
  });

  it.each([
    [WILD_LOCATION_CARD_ID, "location"],
    [WILD_INDUSTRY_CARD_ID, "industry"],
  ] as const)("returns chosen %s to its supply", (wild, supply) => {
    const base = sellState(`sell-wild-${supply}`);
    const initial: SellActionState = {
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
      sellAction(
        initial,
        selection(
          initial,
          [sale("cotton", initial.merchantSpaces[0].merchantSpaceId)],
          wild,
        ),
      ),
    );
    expect(result.state.cards.hands.alice).not.toContain(wild);
    expect(result.state.cards.wildSupplies[supply]).toBe(4);
    expect(result.state.cards.discard).toBe(initial.cards.discard);
  });

  it("rejects missing cards and unknown seats after planning without mutation", () => {
    const initial = sellState("sell-card-failures");
    const chosenSale = sale("cotton", initial.merchantSpaces[0].merchantSpaceId);
    const snapshot = structuredClone(initial);
    const missing = sellAction(
      initial,
      selection(initial, [chosenSale], WILD_LOCATION_CARD_ID),
    );
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missing.state).toBe(initial);
    expect(initial).toEqual(snapshot);

    const unknownSeat: SellActionState = {
      ...initial,
      seat: "carol",
      industries: {
        ...initial.industries,
        cotton: { ...initial.industries.cotton, owner: "carol" },
      },
    };
    const unknown = sellAction(
      unknownSeat,
      selection(initial, [chosenSale]),
    );
    expect(unknown).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(unknown.state).toBe(unknownSeat);
  });

  it("rejects malformed dynamic state and reward overflow atomically", () => {
    const base = sellState("sell-invalid-state");
    const invalidStates: SellActionState[] = [
      { ...base, player: { ...base.player, incomeMarkerSpace: 101 } },
      { ...base, builtLinks: { not_a_link: "alice" } },
      {
        ...base,
        industries: {
          ...base.industries,
          own_brewery: { ...base.industries.own_brewery, beer: -1 },
        },
      },
      {
        ...base,
        merchantSpaces: [
          { ...base.merchantSpaces[0], demandIndustries: ["pottery"] },
        ],
      },
    ];
    for (const invalid of invalidStates) {
      const result = sellAction(
        invalid,
        selection(invalid, [
          sale("cotton", invalid.merchantSpaces[0].merchantSpaceId),
        ]),
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_SELL_STATE" },
      });
      expect(result.state).toBe(invalid);
    }

    const moneyMerchant = merchant(
      "merchant_warrington",
      "merchant_universal_2p",
      1,
    );
    const overflow: SellActionState = {
      ...base,
      player: { ...base.player, money: Number.MAX_SAFE_INTEGER },
      builtLinks: { link_stoke_on_trent_warrington: "alice" },
      industries: { goods: industry("alice", "stoke_on_trent", "manufacturer-1") },
      merchantSpaces: [moneyMerchant],
    };
    const result = sellAction(
      overflow,
      selection(overflow, [sale("goods", moneyMerchant.merchantSpaceId)]),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "REWARD_OVERFLOW" },
    });
    expect(result.state).toBe(overflow);
  });

  it("never mutates frozen input and returns JSON-only state and effects", () => {
    const initial = sellState("sell-json-immutable");
    const snapshot = structuredClone(initial);
    Object.freeze(initial.player);
    Object.freeze(initial.cards.hands.alice);
    Object.freeze(initial.cards.hands);
    Object.freeze(initial.cards);
    Object.freeze(initial.builtLinks);
    for (const value of Object.values(initial.industries)) Object.freeze(value);
    Object.freeze(initial.industries);
    for (const value of initial.merchantSpaces) {
      Object.freeze(value.demandIndustries);
      Object.freeze(value);
    }
    Object.freeze(initial.merchantSpaces);
    Object.freeze(initial);

    const result = requireSuccess(
      sellAction(
        initial,
        selection(initial, [
          sale("cotton", initial.merchantSpaces[0].merchantSpaceId),
        ]),
      ),
    );
    expect(initial).toEqual(snapshot);
    expect(result.state).not.toBe(initial);
    expect(result.state.industries).not.toBe(initial.industries);
    expect(result.state.merchantSpaces).not.toBe(initial.merchantSpaces);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

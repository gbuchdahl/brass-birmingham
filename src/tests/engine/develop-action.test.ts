import { describe, expect, it } from "vitest";
import {
  developAction,
  type DevelopActionSelection,
  type DevelopActionState,
} from "@/engine/actions-v2/develop";
import {
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "@/engine/cards-v2/types";
import { createResourceMarketState } from "@/engine/economy/markets";
import {
  createIndustryInventory,
  getLowestIndustryTileId,
  removeBuiltIndustryTile,
} from "@/engine/player-v2";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

function developState(
  seed = "develop-action",
  money = 20,
): DevelopActionState {
  const setup = createCanalSetup(["alice", "bob"], seed);
  return {
    seat: "alice",
    player: { money, inventory: createIndustryInventory() },
    cards: {
      hands: setup.hands,
      draw: setup.draw,
      discard: setup.discard,
      wildSupplies: setup.wildSupplies,
    },
    market: createResourceMarketState(),
    ironIndustries: {},
  };
}

function selection(
  state: DevelopActionState,
  tileIds: readonly string[],
  accessibleIronIndustryIds: readonly string[] = [],
  purchaseMarketShortfall = true,
): DevelopActionSelection {
  return {
    cardId: state.cards.hands[state.seat][0],
    tileIds,
    accessibleIronIndustryIds,
    purchaseMarketShortfall,
  };
}

function requireSuccess(
  result: ReturnType<typeof developAction>,
): Extract<ReturnType<typeof developAction>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Develop action", () => {
  it("develops one tile with free owned board iron", () => {
    const initial: DevelopActionState = {
      ...developState("develop-one-owned"),
      ironIndustries: {
        "iron-dudley": { owner: "alice", cubes: 2, flipped: false },
      },
    };
    const cardId = initial.cards.hands.alice[0];
    const result = requireSuccess(
      developAction(
        initial,
        selection(initial, ["manufacturer-1-a"], ["iron-dudley"], false),
      ),
    );

    expect(result.state.player).toMatchObject({ money: 20 });
    expect(getLowestIndustryTileId(result.state.player.inventory, "manufacturer"))
      .toBe("manufacturer-2-a");
    expect(result.state.ironIndustries["iron-dudley"]).toEqual({
      owner: "alice",
      cubes: 1,
      flipped: false,
    });
    expect(result.state.market).toEqual(initial.market);
    expect(result.effect).toEqual({
      type: "DEVELOPED",
      seat: "alice",
      discardedCardId: cardId,
      removedTileIds: ["manufacturer-1-a"],
      actionsConsumed: 1,
      moneySpent: 0,
      iron: {
        requiredUnits: 1,
        boardSources: [{
          industryId: "iron-dudley",
          owner: "alice",
          unitsConsumed: 1,
          cubesRemaining: 1,
          depleted: false,
        }],
        market: { unitsPurchased: 0, unitPrices: [], totalCost: 0 },
      },
    });
  });

  it("develops two tiles using ordered free iron from either owner", () => {
    const initial: DevelopActionState = {
      ...developState("develop-two-board"),
      ironIndustries: {
        "iron-a": { owner: "alice", cubes: 1, flipped: false },
        "iron-b": { owner: "bob", cubes: 3, flipped: false },
      },
    };
    const result = requireSuccess(
      developAction(
        initial,
        selection(
          initial,
          ["manufacturer-1-a", "cotton-1-a"],
          ["iron-b", "iron-a"],
          false,
        ),
      ),
    );

    expect(result.effect.removedTileIds).toEqual([
      "manufacturer-1-a",
      "cotton-1-a",
    ]);
    expect(result.effect.iron.boardSources).toEqual([{
      industryId: "iron-b",
      owner: "bob",
      unitsConsumed: 2,
      cubesRemaining: 1,
      depleted: false,
    }]);
    expect(result.state.ironIndustries["iron-a"])
      .toBe(initial.ironIndustries["iron-a"]);
    expect(result.state.player.money).toBe(initial.player.money);
  });

  it("exhausts accessible board iron before buying the market shortfall", () => {
    const initial: DevelopActionState = {
      ...developState("develop-board-then-market"),
      ironIndustries: {
        "iron-a": { owner: "bob", cubes: 1, flipped: false },
      },
      market: { coal: 13, iron: 4 },
    };
    const result = requireSuccess(
      developAction(
        initial,
        selection(
          initial,
          ["manufacturer-1-a", "cotton-1-a"],
          ["iron-a"],
        ),
      ),
    );

    expect(result.state.ironIndustries["iron-a"].flipped).toBe(true);
    expect(result.state.market.iron).toBe(3);
    expect(result.state.player.money).toBe(16);
    expect(result.effect.moneySpent).toBe(4);
    expect(result.effect.iron).toMatchObject({
      requiredUnits: 2,
      boardSources: [{
        industryId: "iron-a",
        unitsConsumed: 1,
        cubesRemaining: 0,
        depleted: true,
      }],
      market: { unitsPurchased: 1, unitPrices: [4], totalCost: 4 },
    });
  });

  it("buys two market cubes at printed prices and records full turn-order spend", () => {
    const initial = developState("develop-market-only");
    const result = requireSuccess(
      developAction(
        initial,
        selection(initial, ["manufacturer-1-a", "cotton-1-a"]),
      ),
    );

    expect(result.effect.iron.market).toEqual({
      unitsPurchased: 2,
      unitPrices: [2, 2],
      totalCost: 4,
    });
    expect(result.effect.moneySpent).toBe(4);
    expect(result.state.player.money).toBe(16);
    expect(result.state.market.iron).toBe(6);
  });

  it("rejects insufficient money after planning without consuming anything", () => {
    const initial = developState("develop-money-shortfall", 3);
    const snapshot = structuredClone(initial);
    const chosen = selection(initial, ["manufacturer-1-a", "cotton-1-a"]);
    const result = developAction(initial, chosen);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_MONEY" },
    });
    expect(result.state).toBe(initial);
    expect(initial).toEqual(snapshot);
    expect(initial.cards.hands.alice).toContain(chosen.cardId);
  });

  it("requires explicit permission to purchase an iron shortfall", () => {
    const initial = developState("develop-no-market");
    const result = developAction(
      initial,
      selection(initial, ["manufacturer-1-a"], [], false),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_IRON" },
    });
    expect(result.state).toBe(initial);
  });

  it("cannot buy market iron while unselected board iron remains", () => {
    const base = developState("develop-board-priority");
    const initial: DevelopActionState = {
      ...base,
      ironIndustries: {
        available: { owner: "bob", cubes: 2, flipped: false },
      },
    };
    const result = developAction(
      initial,
      selection(initial, ["manufacturer-1-a"], [], true),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_IRON_SELECTION",
        industryId: "available",
      },
    });
    expect(result.state).toBe(initial);
    expect(initial.market.iron).toBe(8);
  });

  it("preserves pottery protections and sequential duplicate-copy ordering", () => {
    const initial = developState("develop-pottery-protected");
    const pottery = developAction(
      initial,
      selection(initial, ["pottery-1-a"]),
    );
    expect(pottery).toMatchObject({
      ok: false,
      error: {
        code: "TILE_NOT_DEVELOPABLE",
        tileId: "pottery-1-a",
        selectionIndex: 0,
      },
    });
    expect(pottery.state).toBe(initial);

    const removedFirst = removeBuiltIndustryTile(
      initial.player.inventory,
      "manufacturer-1-a",
      "canal",
    );
    if (!removedFirst.ok) throw new Error(removedFirst.error.message);
    const afterFirst: DevelopActionState = {
      ...initial,
      player: { ...initial.player, inventory: removedFirst.inventory },
    };
    const copies = requireSuccess(
      developAction(
        afterFirst,
        selection(afterFirst, ["manufacturer-2-a", "manufacturer-2-b"]),
      ),
    );
    expect(copies.effect.removedTileIds).toEqual([
      "manufacturer-2-a",
      "manufacturer-2-b",
    ]);
    expect(getLowestIndustryTileId(copies.state.player.inventory, "manufacturer"))
      .toBe("manufacturer-3-a");
  });

  it("uses regular and Wild action-card semantics", () => {
    const regular = developState("develop-regular-card");
    const regularCard = regular.cards.hands.alice[2];
    const regularResult = requireSuccess(
      developAction(regular, {
        ...selection(regular, ["manufacturer-1-a"]),
        cardId: regularCard,
      }),
    );
    expect(regularResult.state.cards.discard.at(-1)).toBe(regularCard);
    expect(regularResult.state.cards.hands.alice).not.toContain(regularCard);

    const baseWild = developState("develop-wild-card");
    const wild: DevelopActionState = {
      ...baseWild,
      cards: {
        ...baseWild.cards,
        hands: {
          ...baseWild.cards.hands,
          alice: [...baseWild.cards.hands.alice, WILD_LOCATION_CARD_ID],
        },
        wildSupplies: { ...baseWild.cards.wildSupplies, location: 3 },
      },
    };
    const wildResult = requireSuccess(
      developAction(wild, {
        ...selection(wild, ["manufacturer-1-a"]),
        cardId: WILD_LOCATION_CARD_ID,
      }),
    );
    expect(wildResult.state.cards.hands.alice)
      .not.toContain(WILD_LOCATION_CARD_ID);
    expect(wildResult.state.cards.wildSupplies.location).toBe(4);
    expect(wildResult.state.cards.discard).toBe(wild.cards.discard);
  });

  it("rejects missing cards and unknown seats atomically", () => {
    const initial = developState("develop-card-errors");
    const missing = developAction(initial, {
      ...selection(initial, ["manufacturer-1-a"]),
      cardId: WILD_LOCATION_CARD_ID,
    });
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missing.state).toBe(initial);

    const unknownSeat: DevelopActionState = { ...initial, seat: "carol" };
    const unknown = developAction(
      unknownSeat,
      selection(initial, ["manufacturer-1-a"]),
    );
    expect(unknown).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(unknown.state).toBe(unknownSeat);
  });

  it("rejects invalid tile and iron selections atomically", () => {
    const initial: DevelopActionState = {
      ...developState("develop-invalid-selection"),
      ironIndustries: {
        available: { owner: "alice", cubes: 2, flipped: false },
        depleted: { owner: "bob", cubes: 0, flipped: true },
      },
    };
    const cases: Array<[DevelopActionSelection, string]> = [
      [selection(initial, [], ["available"]), "INVALID_DEVELOP_COUNT"],
      [selection(initial, ["manufacturer-2-a"], ["available"]), "TILE_NOT_ON_TOP"],
      [selection(initial, ["manufacturer-1-a"], ["missing"]), "IRON_SOURCE_UNAVAILABLE"],
      [selection(initial, ["manufacturer-1-a"], ["depleted"]), "IRON_SOURCE_UNAVAILABLE"],
      [selection(initial, ["manufacturer-1-a"], ["available", "available"]), "INVALID_IRON_SELECTION"],
    ];

    for (const [chosen, code] of cases) {
      const snapshot = structuredClone(initial);
      const result = developAction(initial, chosen);
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(result.state).toBe(initial);
      expect(initial).toEqual(snapshot);
    }
  });

  it("returns typed failures for malformed command payloads", () => {
    const initial = developState("develop-malformed-command");
    const malformed = [
      null,
      { ...selection(initial, ["manufacturer-1-a"]), tileIds: null },
    ];

    for (const chosen of malformed) {
      const result = developAction(
        initial,
        chosen as unknown as DevelopActionSelection,
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_DEVELOP_SELECTION" },
      });
      expect(result.state).toBe(initial);
    }
  });

  it("rejects malformed money, markets, and iron industries atomically", () => {
    const initial = developState("develop-invalid-state");
    const invalidStates: DevelopActionState[] = [
      { ...initial, player: { ...initial.player, money: -1 } },
      { ...initial, market: { ...initial.market, iron: 11 } },
      {
        ...initial,
        ironIndustries: {
          bad: { owner: "alice", cubes: 0, flipped: false },
        },
      },
    ];

    for (const invalid of invalidStates) {
      const result = developAction(
        invalid,
        selection(initial, ["manufacturer-1-a"]),
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_DEVELOP_STATE" },
      });
      expect(result.state).toBe(invalid);
    }
  });

  it("is immutable and produces a JSON-only serializable result", () => {
    const initial: DevelopActionState = {
      ...developState("develop-json"),
      ironIndustries: {
        iron: { owner: "alice", cubes: 1, flipped: false },
      },
    };
    const snapshot = structuredClone(initial);
    const cardId: PlayableCardId = initial.cards.hands.alice[0];
    const result = requireSuccess(
      developAction(initial, {
        cardId,
        tileIds: ["manufacturer-1-a", "cotton-1-a"],
        accessibleIronIndustryIds: ["iron"],
        purchaseMarketShortfall: true,
      }),
    );

    expect(initial).toEqual(snapshot);
    expect(result.state).not.toBe(initial);
    expect(result.state.player).not.toBe(initial.player);
    expect(result.state.cards).not.toBe(initial.cards);
    expect(result.state.market).not.toBe(initial.market);
    expect(result.state.ironIndustries).not.toBe(initial.ironIndustries);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

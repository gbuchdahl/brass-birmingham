import { describe, expect, it } from "vitest";
import {
  createResourceMarketState,
  purchaseFromResourceMarket,
  sellToResourceMarket,
  type ResourceMarketKind,
  type ResourceMarketState,
} from "@/engine/economy/markets";
import { MARKET_DATA } from "@/engine/rules/generated/ruleset";

describe("resource markets", () => {
  it("creates the exact initial coal and iron fill", () => {
    const market = createResourceMarketState();

    expect(market).toEqual({ coal: 13, iron: 8 });
    expect(market.coal).toBe(MARKET_DATA.coal.initialUnits);
    expect(market.iron).toBe(MARKET_DATA.iron.initialUnits);
  });

  it.each([
    {
      kind: "coal" as const,
      initialUnits: 13,
      printedPrices: [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
      fallbackPrice: 8,
    },
    {
      kind: "iron" as const,
      initialUnits: 8,
      printedPrices: [2, 2, 3, 3, 4, 4, 5, 5],
      fallbackPrice: 6,
    },
  ])(
    "depletes the initial $kind market cheapest-first before fallback purchases",
    ({ kind, initialUnits, printedPrices, fallbackPrice }) => {
      const initial = createResourceMarketState();
      const result = purchaseFromResourceMarket(
        initial,
        kind,
        initialUnits + 2,
      );

      expect(result.unitPrices).toEqual([
        ...printedPrices,
        fallbackPrice,
        fallbackPrice,
      ]);
      expect(result.totalCost).toBe(
        [...printedPrices, fallbackPrice, fallbackPrice].reduce(
          (total, price) => total + price,
          0,
        ),
      );
      expect(result).toMatchObject({
        requestedUnits: initialUnits + 2,
        unitsMoved: initialUnits + 2,
        unitsRemaining: 0,
        marketUnitsAfter: 0,
      });
      expect(result.market).toEqual({
        ...initial,
        [kind]: 0,
      });
    },
  );

  it.each([
    {
      kind: "coal" as const,
      capacity: 14,
      purchasePrices: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7],
      fallbackPrice: 8,
    },
    {
      kind: "iron" as const,
      capacity: 10,
      purchasePrices: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
      fallbackPrice: 6,
    },
  ])(
    "prices every occupied $kind slot cheapest-first from a full market",
    ({ kind, capacity, purchasePrices, fallbackPrice }) => {
      const full = { ...createResourceMarketState(), [kind]: capacity };
      const result = purchaseFromResourceMarket(full, kind, capacity + 1);

      expect(result.unitPrices).toEqual([...purchasePrices, fallbackPrice]);
      expect(result.marketUnitsAfter).toBe(0);
      expect(result.unitsMoved).toBe(capacity + 1);
      expect(result.unitsRemaining).toBe(0);
    },
  );

  it.each([
    { kind: "coal" as const, fallbackPrice: 8 },
    { kind: "iron" as const, fallbackPrice: 6 },
  ])(
    "supports unlimited $kind fallback purchases from an empty market",
    ({ kind, fallbackPrice }) => {
      const empty = { ...createResourceMarketState(), [kind]: 0 };
      const result = purchaseFromResourceMarket(empty, kind, 4);

      expect(result.unitPrices).toEqual(Array(4).fill(fallbackPrice));
      expect(result.totalCost).toBe(4 * fallbackPrice);
      expect(result.market).toEqual(empty);
      expect(result.market).not.toBe(empty);
    },
  );

  it.each([
    {
      kind: "coal" as const,
      capacity: 14,
      fillPrices: [7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1],
    },
    {
      kind: "iron" as const,
      capacity: 10,
      fillPrices: [5, 5, 4, 4, 3, 3, 2, 2, 1, 1],
    },
  ])(
    "refills an empty $kind market most-expensive-space-first",
    ({ kind, capacity, fillPrices }) => {
      const empty = { ...createResourceMarketState(), [kind]: 0 };
      const result = sellToResourceMarket(empty, kind, capacity);

      expect(result.unitPrices).toEqual(fillPrices);
      expect(result.totalRevenue).toBe(
        fillPrices.reduce((total, price) => total + price, 0),
      );
      expect(result).toMatchObject({
        requestedUnits: capacity,
        unitsMoved: capacity,
        unitsRemaining: 0,
        marketUnitsAfter: capacity,
      });
      expect(result.market).toEqual({
        ...empty,
        [kind]: capacity,
      });
    },
  );

  it.each([
    { kind: "coal" as const, units: 12, prices: [1, 1] },
    { kind: "iron" as const, units: 8, prices: [1, 1] },
  ])(
    "partially accepts $kind and reports cubes left at the industry",
    ({ kind, units, prices }) => {
      const partial = { ...createResourceMarketState(), [kind]: units };
      const capacity = MARKET_DATA[kind].fillOrderPrices.length;
      const result = sellToResourceMarket(partial, kind, 5);

      expect(result.unitPrices).toEqual(prices);
      expect(result.totalRevenue).toBe(2);
      expect(result.unitsMoved).toBe(2);
      expect(result.unitsRemaining).toBe(3);
      expect(result.marketUnitsAfter).toBe(capacity);
    },
  );

  it.each(["coal", "iron"] as const)(
    "does not accept $kind when its market is full",
    (kind) => {
      const capacity = MARKET_DATA[kind].fillOrderPrices.length;
      const full = { ...createResourceMarketState(), [kind]: capacity };
      const result = sellToResourceMarket(full, kind, 3);

      expect(result).toMatchObject({
        unitsMoved: 0,
        unitsRemaining: 3,
        marketUnitsAfter: capacity,
        unitPrices: [],
        totalRevenue: 0,
      });
      expect(result.market).toEqual(full);
      expect(result.market).not.toBe(full);
    },
  );

  it("returns fresh JSON-only values without mutating its input", () => {
    const initial = Object.freeze(createResourceMarketState());
    const before = JSON.stringify(initial);

    const purchase = purchaseFromResourceMarket(initial, "coal", 2);
    const sale = sellToResourceMarket(initial, "iron", 2);

    expect(JSON.stringify(initial)).toBe(before);
    expect(purchase.market).not.toBe(initial);
    expect(sale.market).not.toBe(initial);
    expect(JSON.parse(JSON.stringify(purchase))).toEqual(purchase);
    expect(JSON.parse(JSON.stringify(sale))).toEqual(sale);
  });

  it("preserves market conservation across purchase and refill sequences", () => {
    const initial = createResourceMarketState();
    const purchase = purchaseFromResourceMarket(initial, "coal", 5);
    const refill = sellToResourceMarket(purchase.market, "coal", 3);

    expect(initial.coal - purchase.market.coal).toBe(5);
    expect(refill.market.coal - purchase.market.coal).toBe(refill.unitsMoved);
    expect(refill.market.coal).toBe(initial.coal - 2);
    expect(initial.iron).toBe(purchase.market.iron);
    expect(initial.iron).toBe(refill.market.iron);
  });

  it.each(["coal", "iron"] as const)(
    "treats zero-unit $kind transactions as validated no-ops",
    (kind) => {
      const initial = createResourceMarketState();

      expect(purchaseFromResourceMarket(initial, kind, 0)).toMatchObject({
        market: initial,
        unitsMoved: 0,
        unitsRemaining: 0,
        unitPrices: [],
        totalCost: 0,
      });
      expect(sellToResourceMarket(initial, kind, 0)).toMatchObject({
        market: initial,
        unitsMoved: 0,
        unitsRemaining: 0,
        unitPrices: [],
        totalRevenue: 0,
      });
    },
  );

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid transaction quantity %s", (quantity) => {
    const initial = createResourceMarketState();

    expect(() =>
      purchaseFromResourceMarket(initial, "coal", quantity),
    ).toThrow();
    expect(() => sellToResourceMarket(initial, "iron", quantity)).toThrow();
  });

  it.each([
    null,
    [],
    {},
    { coal: -1, iron: 8 },
    { coal: 15, iron: 8 },
    { coal: 13, iron: 10.5 },
    { coal: 13, iron: 11 },
  ])("rejects invalid market state %j", (state) => {
    expect(() =>
      purchaseFromResourceMarket(
        state as ResourceMarketState,
        "coal",
        1,
      ),
    ).toThrow();
    expect(() =>
      sellToResourceMarket(state as ResourceMarketState, "iron", 1),
    ).toThrow();
  });

  it("rejects unknown resource kinds at runtime", () => {
    const initial = createResourceMarketState();
    const invalid = "beer" as ResourceMarketKind;

    expect(() => purchaseFromResourceMarket(initial, invalid, 1)).toThrow(
      TypeError,
    );
    expect(() => sellToResourceMarket(initial, invalid, 1)).toThrow(TypeError);
  });
});

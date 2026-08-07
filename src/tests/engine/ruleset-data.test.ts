import { describe, expect, it } from "vitest";
import {
  COAL_MARKET_FALLBACK_PRICE,
  INITIAL_COAL_MARKET_UNITS,
  INITIAL_IRON_MARKET_UNITS,
  IRON_MARKET_FALLBACK_PRICE,
  MAX_COAL_MARKET_UNITS,
  MAX_IRON_MARKET_UNITS,
  coalMarketPrice,
  ironMarketPrice,
} from "@/engine/rules/config";
import {
  MARKET_DATA,
  RULESET_META,
  SETUP_DATA,
} from "@/engine/rules/generated/ruleset";

describe("versioned rules data", () => {
  it("has resolved provenance for every generated source", () => {
    expect(RULESET_META).toMatchObject({
      schemaVersion: 1,
      id: "brass-birmingham",
      version: "2018-standard-v1",
    });
    for (const source of MARKET_DATA.provenance.sources) {
      expect(RULESET_META.sources[source]).toBeDefined();
    }
    for (const source of SETUP_DATA.provenance.sources) {
      expect(RULESET_META.sources[source]).toBeDefined();
    }
  });

  it("records the exact shared component and setup counts", () => {
    expect(SETUP_DATA.shared).toEqual({
      handSize: 8,
      initialDiscardPerPlayer: 1,
      startingMoney: 17,
      startingIncomeSpace: 10,
      linksPerPlayer: 14,
      industryTilesPerPlayer: 45,
      wildLocationCards: 4,
      wildIndustryCards: 4,
    });
    expect(SETUP_DATA.playerCounts[2].merchantLocations).toEqual([
      "gloucester",
      "oxford",
      "shrewsbury",
    ]);
    expect(SETUP_DATA.playerCounts[3].merchantLocations).toContain("warrington");
    expect(SETUP_DATA.playerCounts[4].merchantLocations).toContain("nottingham");
  });

  it.each([2, 3, 4] as const)(
    "balances the %i-player deck across both eras",
    (playerCount) => {
      const setup = SETUP_DATA.playerCounts[playerCount];
      expect(setup.regularCards).toBe(
        playerCount * setup.roundsPerEra * 2,
      );
      expect(setup.regularCards).toBe(
        playerCount * (1 + (setup.roundsPerEra - 1) * 2) + playerCount,
      );
      expect(
        setup.regularCards -
          playerCount *
            (SETUP_DATA.shared.handSize +
              SETUP_DATA.shared.initialDiscardPerPlayer),
      ).toBe({ 2: 22, 3: 27, 4: 28 }[playerCount]);
    },
  );

  it("records action budgets and active merchant slots", () => {
    expect(SETUP_DATA.eras).toEqual({
      canal: { firstRoundActions: 1, laterRoundActions: 2 },
      rail: { firstRoundActions: 2, laterRoundActions: 2 },
    });
    expect([
      SETUP_DATA.playerCounts[2].activeMerchantSlots,
      SETUP_DATA.playerCounts[3].activeMerchantSlots,
      SETUP_DATA.playerCounts[4].activeMerchantSlots,
    ]).toEqual([5, 7, 9]);
  });
});

describe("printed resource markets", () => {
  it("uses the exact coal spaces and fallback price", () => {
    expect(MAX_COAL_MARKET_UNITS).toBe(14);
    expect(INITIAL_COAL_MARKET_UNITS).toBe(13);
    expect(COAL_MARKET_FALLBACK_PRICE).toBe(8);
    expect(coalMarketPrice(14)).toBe(1);
    expect(coalMarketPrice(13)).toBe(1);
    expect(coalMarketPrice(12)).toBe(2);
    expect(coalMarketPrice(1)).toBe(7);
    expect(coalMarketPrice(0)).toBe(8);
  });

  it("uses the exact iron spaces and fallback price", () => {
    expect(MAX_IRON_MARKET_UNITS).toBe(10);
    expect(INITIAL_IRON_MARKET_UNITS).toBe(8);
    expect(IRON_MARKET_FALLBACK_PRICE).toBe(6);
    expect(ironMarketPrice(10)).toBe(1);
    expect(ironMarketPrice(8)).toBe(2);
    expect(ironMarketPrice(1)).toBe(5);
    expect(ironMarketPrice(0)).toBe(6);
  });
});

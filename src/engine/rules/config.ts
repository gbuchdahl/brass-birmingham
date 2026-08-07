import type { IndustryLevelSpec } from "../types";
import { INDUSTRY_LEVEL_DATA } from "./generated/industry-values";
import { MARKET_DATA, SETUP_DATA } from "./generated/ruleset";

export const HAND_SIZE_BY_PLAYER_COUNT: Record<number, number> = {
  2: SETUP_DATA.shared.handSize,
  3: SETUP_DATA.shared.handSize,
  4: SETUP_DATA.shared.handSize,
};

export const STARTING_MONEY = SETUP_DATA.shared.startingMoney;

export const COAL_MARKET_FALLBACK_PRICE = MARKET_DATA.coal.fallbackPrice;
export const IRON_MARKET_FALLBACK_PRICE = MARKET_DATA.iron.fallbackPrice;
export const INITIAL_COAL_MARKET_UNITS = MARKET_DATA.coal.initialUnits;
export const INITIAL_IRON_MARKET_UNITS = MARKET_DATA.iron.initialUnits;
export const MAX_COAL_MARKET_UNITS = MARKET_DATA.coal.fillOrderPrices.length;
export const MAX_IRON_MARKET_UNITS = MARKET_DATA.iron.fillOrderPrices.length;

// Legacy prototype table; the complete generated industry catalog will replace it.
export const INDUSTRY_LEVEL_TABLE = INDUSTRY_LEVEL_DATA as Record<
  "coal" | "iron",
  Record<number, IndustryLevelSpec & { sourceNote: string }>
>;

function marketPrice(
  unitsLeft: number,
  fillOrderPrices: readonly number[],
  fallbackPrice: number,
): number {
  if (unitsLeft <= 0) {
    return fallbackPrice;
  }
  const occupiedUnits = Math.max(
    1,
    Math.min(Math.floor(unitsLeft), fillOrderPrices.length),
  );
  return fillOrderPrices[occupiedUnits - 1];
}

export function coalMarketPrice(unitsLeft: number): number {
  return marketPrice(
    unitsLeft,
    MARKET_DATA.coal.fillOrderPrices,
    COAL_MARKET_FALLBACK_PRICE,
  );
}

export function ironMarketPrice(unitsLeft: number): number {
  return marketPrice(
    unitsLeft,
    MARKET_DATA.iron.fillOrderPrices,
    IRON_MARKET_FALLBACK_PRICE,
  );
}

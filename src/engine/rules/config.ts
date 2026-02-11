export const HAND_SIZE_BY_PLAYER_COUNT: Record<number, number> = {
  2: 8,
  3: 8,
  4: 8,
};

export const STARTING_MONEY = 17;

export const COAL_MARKET_FALLBACK_PRICE = 8;
export const IRON_MARKET_FALLBACK_PRICE = 6;
export const INITIAL_COAL_MARKET_UNITS = 13;
export const INITIAL_IRON_MARKET_UNITS = 8;
export const MAX_COAL_MARKET_UNITS = 14;
export const MAX_IRON_MARKET_UNITS = 9;

// TODO(brass-rules): Placeholder/bullshit values. Replace with exact board/rulebook data.
export const INDUSTRY_PLACEHOLDER_TABLE = {
  coal: {
    1: {
      buildCost: 6,
      cubesProduced: 2,
      incomeOnFlip: 2,
    },
  },
  iron: {
    1: {
      buildCost: 5,
      cubesProduced: 1,
      incomeOnFlip: 1,
    },
  },
} as const;

function dynamicMarketPrice(
  unitsLeft: number,
  initialUnits: number,
  fallbackPrice: number,
): number {
  if (unitsLeft <= 0) {
    return fallbackPrice;
  }
  const normalized = Math.max(0, Math.min(1, unitsLeft / initialUnits));
  const value = 1 + (1 - normalized) * (fallbackPrice - 1);
  return Math.max(1, Math.min(fallbackPrice, Math.floor(value)));
}

export function coalMarketPrice(unitsLeft: number): number {
  return dynamicMarketPrice(
    unitsLeft,
    INITIAL_COAL_MARKET_UNITS,
    COAL_MARKET_FALLBACK_PRICE,
  );
}

export function ironMarketPrice(unitsLeft: number): number {
  return dynamicMarketPrice(
    unitsLeft,
    INITIAL_IRON_MARKET_UNITS,
    IRON_MARKET_FALLBACK_PRICE,
  );
}

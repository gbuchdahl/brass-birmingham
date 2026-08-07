import { MARKET_DATA } from "../rules/generated/ruleset";

export type ResourceMarketKind = keyof typeof MARKET_DATA & ("coal" | "iron");

export interface ResourceMarketState {
  coal: number;
  iron: number;
}

interface ResourceMarketMovement {
  market: ResourceMarketState;
  kind: ResourceMarketKind;
  requestedUnits: number;
  unitsMoved: number;
  /** Requested units that could not be moved. Purchases are never unfulfilled. */
  unitsRemaining: number;
  marketUnitsAfter: number;
  unitPrices: number[];
}

export interface ResourceMarketPurchase extends ResourceMarketMovement {
  totalCost: number;
}

export interface ResourceMarketSale extends ResourceMarketMovement {
  totalRevenue: number;
}

const RESOURCE_MARKET_KINDS = ["coal", "iron"] as const;

function isResourceMarketKind(value: unknown): value is ResourceMarketKind {
  return RESOURCE_MARKET_KINDS.some((kind) => kind === value);
}

function requireResourceMarketKind(value: unknown): ResourceMarketKind {
  if (!isResourceMarketKind(value)) {
    throw new TypeError(`Unknown resource market kind: ${String(value)}`);
  }
  return value;
}

function capacity(kind: ResourceMarketKind): number {
  return MARKET_DATA[kind].fillOrderPrices.length;
}

function requireUnits(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  if ((value as number) < 0) {
    throw new RangeError(`${label} must not be negative`);
  }
  return value as number;
}

function requireMarketState(value: unknown): ResourceMarketState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Resource market state must be an object");
  }

  const candidate = value as Partial<ResourceMarketState>;
  for (const kind of RESOURCE_MARKET_KINDS) {
    const units = requireUnits(candidate[kind], `${kind} market units`);
    if (units > capacity(kind)) {
      throw new RangeError(
        `${kind} market units must not exceed capacity ${capacity(kind)}`,
      );
    }
  }

  return candidate as ResourceMarketState;
}

function withUnits(
  market: ResourceMarketState,
  kind: ResourceMarketKind,
  units: number,
): ResourceMarketState {
  return { ...market, [kind]: units };
}

export function createResourceMarketState(): ResourceMarketState {
  return {
    coal: MARKET_DATA.coal.initialUnits,
    iron: MARKET_DATA.iron.initialUnits,
  };
}

/**
 * Purchases the requested number of cubes, consuming the cheapest occupied
 * printed spaces first. Once the printed market is empty, the external market
 * supplies any remaining cubes at the fallback price.
 */
export function purchaseFromResourceMarket(
  state: ResourceMarketState,
  resource: ResourceMarketKind,
  quantity: number,
): ResourceMarketPurchase {
  const market = requireMarketState(state);
  const kind = requireResourceMarketKind(resource);
  const requestedUnits = requireUnits(quantity, "Purchase quantity");
  const rules = MARKET_DATA[kind];
  const unitPrices: number[] = [];
  let marketUnits = market[kind];

  for (let unit = 0; unit < requestedUnits; unit += 1) {
    if (marketUnits === 0) {
      unitPrices.push(rules.fallbackPrice);
    } else {
      unitPrices.push(rules.fillOrderPrices[marketUnits - 1]);
      marketUnits -= 1;
    }
  }

  return {
    market: withUnits(market, kind, marketUnits),
    kind,
    requestedUnits,
    unitsMoved: requestedUnits,
    unitsRemaining: 0,
    marketUnitsAfter: marketUnits,
    unitPrices,
    totalCost: unitPrices.reduce((total, price) => total + price, 0),
  };
}

/**
 * Sells newly produced cubes into the most expensive available printed spaces.
 * Cubes that do not fit remain with the producing industry and earn nothing.
 */
export function sellToResourceMarket(
  state: ResourceMarketState,
  resource: ResourceMarketKind,
  quantity: number,
): ResourceMarketSale {
  const market = requireMarketState(state);
  const kind = requireResourceMarketKind(resource);
  const requestedUnits = requireUnits(quantity, "Sale quantity");
  const rules = MARKET_DATA[kind];
  const unitPrices: number[] = [];
  let marketUnits = market[kind];

  while (unitPrices.length < requestedUnits && marketUnits < capacity(kind)) {
    unitPrices.push(rules.fillOrderPrices[marketUnits]);
    marketUnits += 1;
  }

  const unitsMoved = unitPrices.length;
  return {
    market: withUnits(market, kind, marketUnits),
    kind,
    requestedUnits,
    unitsMoved,
    unitsRemaining: requestedUnits - unitsMoved,
    marketUnitsAfter: marketUnits,
    unitPrices,
    totalRevenue: unitPrices.reduce((total, price) => total + price, 0),
  };
}

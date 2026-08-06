import { discardActionCard } from "../cards-v2/zones";
import type { CardZones, PlayableCardId } from "../cards-v2/types";
import { advanceIncomeSpaces, incomeLevelAt } from "../economy/income";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  INDUSTRY_TILE_FACE_BY_ID,
  type IndustryTileFaceId,
} from "../rules/generated/industry-tiles-v2";
import {
  MERCHANT_TILE_CATALOG,
  type RulesMerchantDemandIndustry,
  type RulesMerchantTileId,
} from "../rules/generated/merchant-tiles";

type BoardLink = (typeof BOARD_V2.links)[number];
type MerchantLocation = Extract<
  (typeof BOARD_V2.locations)[keyof typeof BOARD_V2.locations],
  { kind: "merchant" }
>;

export type SellableIndustryKind = RulesMerchantDemandIndustry;

export type SellIndustryState = {
  readonly owner: string;
  readonly locationId: string;
  readonly faceId: IndustryTileFaceId;
  /** One product is present until a sellable Industry flips. */
  readonly product: 0 | 1;
  /** Only Brewery entries may hold beer. */
  readonly beer: number;
  readonly flipped: boolean;
};

export type SellMerchantSpaceState = {
  readonly locationId: string;
  readonly merchantSpaceId: string;
  readonly active: boolean;
  readonly tileId: RulesMerchantTileId | null;
  readonly demandIndustries: readonly RulesMerchantDemandIndustry[];
  readonly beer: 0 | 1;
};

export type SellActionState = {
  readonly seat: string;
  readonly player: {
    readonly money: number;
    readonly victoryPoints: number;
    readonly incomeMarkerSpace: number;
  };
  readonly cards: CardZones;
  /** Physical link ID to owner; ownership does not restrict Sell connectivity. */
  readonly builtLinks: Readonly<Record<string, string>>;
  /** Sell-relevant board projection: sellable Industries and Breweries. */
  readonly industries: Readonly<Record<string, SellIndustryState>>;
  readonly merchantSpaces: readonly SellMerchantSpaceState[];
};

export type SellBeerSelection =
  | { readonly kind: "merchant" }
  | { readonly kind: "brewery"; readonly industryId: string };

export type SellTileSelection = {
  readonly industryId: string;
  readonly merchantSpaceId: string;
  readonly beerSource: SellBeerSelection;
};

export type SellActionSelection = {
  readonly cardId: PlayableCardId;
  /** Order is authoritative when multiple sales compete for the same beer. */
  readonly sales: readonly SellTileSelection[];
};

export type SellActionErrorCode =
  | "INVALID_SELL_STATE"
  | "INVALID_SALE_COUNT"
  | "INVALID_SALE_SELECTION"
  | "DUPLICATE_INDUSTRY"
  | "UNKNOWN_INDUSTRY"
  | "INDUSTRY_NOT_OWNED"
  | "INDUSTRY_NOT_SELLABLE"
  | "INDUSTRY_ALREADY_FLIPPED"
  | "PRODUCT_UNAVAILABLE"
  | "UNKNOWN_MERCHANT"
  | "MERCHANT_INACTIVE"
  | "MERCHANT_DEMAND_MISMATCH"
  | "MERCHANT_NOT_CONNECTED"
  | "MERCHANT_BEER_REQUIRED"
  | "MERCHANT_BEER_UNAVAILABLE"
  | "INVALID_BEER_SELECTION"
  | "BREWERY_UNAVAILABLE"
  | "BREWERY_NOT_CONNECTED"
  | "REWARD_OVERFLOW"
  | "UNKNOWN_SEAT"
  | "CARD_NOT_IN_HAND";

export type SellActionError = {
  readonly code: SellActionErrorCode;
  readonly message: string;
  readonly selectionIndex?: number;
  readonly industryId?: string;
  readonly merchantSpaceId?: string;
};

export type SellMerchantBonusEffect =
  | { readonly kind: "money"; readonly amount: number }
  | { readonly kind: "victory_points"; readonly amount: number }
  | {
      readonly kind: "income_spaces";
      readonly amount: number;
      readonly fromMarkerSpace: number;
      readonly toMarkerSpace: number;
      readonly spacesAdvanced: number;
    }
  | { readonly kind: "free_develop"; readonly amount: number };

export type SellBeerEffect =
  | {
      readonly kind: "merchant";
      readonly merchantSpaceId: string;
      readonly locationId: string;
      readonly bonus: SellMerchantBonusEffect;
    }
  | {
      readonly kind: "brewery";
      readonly industryId: string;
      readonly owner: string;
      readonly locationId: string;
      readonly beerRemaining: number;
      readonly depleted: boolean;
    };

export type SellTileEffect = {
  readonly selectionIndex: number;
  readonly industryId: string;
  readonly faceId: IndustryTileFaceId;
  readonly industryKind: SellableIndustryKind;
  readonly merchantSpaceId: string;
  readonly merchantLocationId: string;
  readonly beer: SellBeerEffect;
  readonly income: {
    readonly printedSpaces: number;
    readonly fromMarkerSpace: number;
    readonly toMarkerSpace: number;
    readonly spacesAdvanced: number;
  };
};

export type SellActionEffect = {
  readonly type: "SOLD";
  readonly seat: string;
  readonly discardedCardId: PlayableCardId;
  readonly actionsConsumed: 1;
  /** Selling and receiving Merchant money never count as purchase spending. */
  readonly moneySpent: 0;
  readonly soldIndustryIds: readonly string[];
  readonly sales: readonly SellTileEffect[];
  readonly rewards: {
    readonly industryIncomeSpacesPrinted: number;
    readonly incomeSpacesAdvanced: number;
    readonly money: number;
    readonly victoryPoints: number;
    /** Gloucester's printed bonus for later reducer follow-up resolution. */
    readonly freeDevelops: number;
  };
};

type SellActionFailure = {
  readonly ok: false;
  readonly state: SellActionState;
  readonly error: SellActionError;
};

export type SellActionResult =
  | {
      readonly ok: true;
      readonly state: SellActionState;
      readonly effect: SellActionEffect;
    }
  | SellActionFailure;

const LINK_BY_ID = new Map<string, BoardLink>(
  BOARD_V2.links.map((link) => [link.id, link]),
);
const LOCATION_IDS = new Set<string>(Object.keys(BOARD_V2.locations));
const MERCHANT_TILE_BY_ID = new Map(
  MERCHANT_TILE_CATALOG.map((tile) => [tile.id, tile]),
);
const SELLABLE_FACE_KIND: Readonly<Record<string, SellableIndustryKind>> = {
  cotton: "cotton_mill",
  manufacturer: "manufacturer",
  pottery: "pottery",
};

function reject(
  state: SellActionState,
  code: SellActionErrorCode,
  message: string,
  details: Omit<SellActionError, "code" | "message"> = {},
): SellActionFailure {
  return { ok: false, state, error: { code, message, ...details } };
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function merchantLocation(locationId: string): MerchantLocation | null {
  const location = BOARD_V2.locations[
    locationId as keyof typeof BOARD_V2.locations
  ];
  return location?.kind === "merchant" ? location : null;
}

function sellableKind(faceId: IndustryTileFaceId): SellableIndustryKind | null {
  const face = INDUSTRY_TILE_FACE_BY_ID[faceId];
  return SELLABLE_FACE_KIND[face.industry] ?? null;
}

function validateState(state: SellActionState): SellActionFailure | null {
  if (typeof state !== "object" || state === null) {
    return reject(state, "INVALID_SELL_STATE", "Sell state must be an object.");
  }
  if (typeof state.seat !== "string" || state.seat.trim().length === 0) {
    return reject(
      state,
      "INVALID_SELL_STATE",
      "Acting seat must be a non-empty string.",
    );
  }
  if (
    !isNonNegativeSafeInteger(state.player?.money) ||
    !isNonNegativeSafeInteger(state.player?.victoryPoints)
  ) {
    return reject(
      state,
      "INVALID_SELL_STATE",
      "Player money and victory points must be non-negative safe integers.",
    );
  }
  try {
    incomeLevelAt(state.player.incomeMarkerSpace);
  } catch (error) {
    return reject(state, "INVALID_SELL_STATE", messageFrom(error));
  }

  if (
    typeof state.builtLinks !== "object" ||
    state.builtLinks === null ||
    Array.isArray(state.builtLinks)
  ) {
    return reject(state, "INVALID_SELL_STATE", "Built links must be an object.");
  }
  for (const [linkId, owner] of Object.entries(state.builtLinks)) {
    if (
      !LINK_BY_ID.has(linkId) ||
      typeof owner !== "string" ||
      owner.trim().length === 0
    ) {
      return reject(
        state,
        "INVALID_SELL_STATE",
        `Invalid built link state: ${linkId}.`,
      );
    }
  }

  if (
    typeof state.industries !== "object" ||
    state.industries === null ||
    Array.isArray(state.industries)
  ) {
    return reject(state, "INVALID_SELL_STATE", "Industries must be an object.");
  }
  for (const [industryId, industry] of Object.entries(state.industries)) {
    const face = INDUSTRY_TILE_FACE_BY_ID[
      industry?.faceId as IndustryTileFaceId
    ];
    const kind = face ? sellableKind(face.faceId) : null;
    const isBrewery = face?.industry === "brewery";
    if (
      industryId.length === 0 ||
      !industry ||
      typeof industry.owner !== "string" ||
      industry.owner.trim().length === 0 ||
      !LOCATION_IDS.has(industry.locationId) ||
      merchantLocation(industry.locationId) !== null ||
      !face ||
      (!kind && !isBrewery) ||
      (industry.product !== 0 && industry.product !== 1) ||
      !isNonNegativeSafeInteger(industry.beer) ||
      typeof industry.flipped !== "boolean" ||
      (kind !== null &&
        (industry.beer !== 0 ||
          industry.flipped !== (industry.product === 0))) ||
      (isBrewery &&
        (industry.product !== 0 ||
          industry.flipped !== (industry.beer === 0)))
    ) {
      return reject(
        state,
        "INVALID_SELL_STATE",
        `Invalid sell-relevant Industry state: ${industryId}.`,
        { industryId },
      );
    }
  }

  if (!Array.isArray(state.merchantSpaces)) {
    return reject(
      state,
      "INVALID_SELL_STATE",
      "Merchant spaces must be an array.",
    );
  }
  const merchantSpaceIds = new Set<string>();
  const placedTileIds = new Set<string>();
  for (const merchant of state.merchantSpaces) {
    const location = merchantLocation(merchant?.locationId);
    const tile =
      merchant?.tileId === null || merchant?.tileId === undefined
        ? null
        : (MERCHANT_TILE_BY_ID.get(merchant.tileId) ?? null);
    const boardSpaceIsValid =
      location !== null &&
      (location.merchantSpaces as readonly string[]).includes(
        merchant?.merchantSpaceId,
      );
    const demandsMatch =
      tile !== null &&
      JSON.stringify(merchant.demandIndustries) ===
        JSON.stringify(tile.demandIndustries);
    const validActive =
      merchant?.active === true &&
      tile !== null &&
      demandsMatch &&
      (merchant.beer === 0 ||
        (merchant.beer === 1 && merchant.demandIndustries.length > 0));
    const validInactive =
      merchant?.active === false &&
      merchant.tileId === null &&
      Array.isArray(merchant.demandIndustries) &&
      merchant.demandIndustries.length === 0 &&
      merchant.beer === 0;
    if (
      !merchant ||
      typeof merchant.merchantSpaceId !== "string" ||
      merchant.merchantSpaceId.length === 0 ||
      merchantSpaceIds.has(merchant.merchantSpaceId) ||
      !boardSpaceIsValid ||
      (!validActive && !validInactive) ||
      (tile !== null && placedTileIds.has(tile.id))
    ) {
      return reject(
        state,
        "INVALID_SELL_STATE",
        `Invalid Merchant state: ${merchant?.merchantSpaceId ?? "unknown"}.`,
        { merchantSpaceId: merchant?.merchantSpaceId },
      );
    }
    merchantSpaceIds.add(merchant.merchantSpaceId);
    if (tile !== null) placedTileIds.add(tile.id);
  }
  return null;
}

function buildAdjacency(
  builtLinkIds: readonly string[],
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const connect = (left: string, right: string): void => {
    const neighbours = adjacency.get(left) ?? new Set<string>();
    neighbours.add(right);
    adjacency.set(left, neighbours);
  };
  for (const linkId of builtLinkIds) {
    const locations = LINK_BY_ID.get(linkId)?.adjacentLocations ?? [];
    for (let left = 0; left < locations.length; left += 1) {
      for (let right = left + 1; right < locations.length; right += 1) {
        connect(locations[left], locations[right]);
        connect(locations[right], locations[left]);
      }
    }
  }
  return adjacency;
}

function connected(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const visited = new Set([from]);
  const queue = [from];
  for (let index = 0; index < queue.length; index += 1) {
    for (const neighbour of adjacency.get(queue[index]) ?? []) {
      if (neighbour === to) return true;
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return false;
}

function merchantBonus(
  merchant: SellMerchantSpaceState,
  markerSpace: number,
): {
  effect: SellMerchantBonusEffect;
  money: number;
  victoryPoints: number;
  incomeMarkerSpace: number;
  incomeSpacesAdvanced: number;
  freeDevelops: number;
} {
  const location = merchantLocation(merchant.locationId);
  if (!location) throw new Error(`Unknown Merchant location ${merchant.locationId}`);
  const bonus = location.merchantBonus;
  if (bonus.kind === "income_spaces") {
    const toMarkerSpace = advanceIncomeSpaces(markerSpace, bonus.amount);
    return {
      effect: {
        kind: bonus.kind,
        amount: bonus.amount,
        fromMarkerSpace: markerSpace,
        toMarkerSpace,
        spacesAdvanced: toMarkerSpace - markerSpace,
      },
      money: 0,
      victoryPoints: 0,
      incomeMarkerSpace: toMarkerSpace,
      incomeSpacesAdvanced: toMarkerSpace - markerSpace,
      freeDevelops: 0,
    };
  }
  return {
    effect: { kind: bonus.kind, amount: bonus.amount },
    money: bonus.kind === "money" ? bonus.amount : 0,
    victoryPoints: bonus.kind === "victory_points" ? bonus.amount : 0,
    incomeMarkerSpace: markerSpace,
    incomeSpacesAdvanced: 0,
    freeDevelops: bonus.kind === "free_develop" ? bonus.amount : 0,
  };
}

/** Executes one complete, ordered, atomic Sell action. */
export function sellAction(
  state: SellActionState,
  selection: SellActionSelection,
): SellActionResult {
  const invalidState = validateState(state);
  if (invalidState) return invalidState;
  if (!Array.isArray(selection?.sales) || selection.sales.length === 0) {
    return reject(
      state,
      "INVALID_SALE_COUNT",
      "A Sell action must sell at least one Industry.",
    );
  }

  const selectedIds = new Set<string>();
  for (const sale of selection.sales) {
    if (
      !sale ||
      typeof sale.industryId !== "string" ||
      sale.industryId.length === 0 ||
      typeof sale.merchantSpaceId !== "string" ||
      sale.merchantSpaceId.length === 0 ||
      !sale.beerSource ||
      (sale.beerSource.kind !== "merchant" &&
        sale.beerSource.kind !== "brewery")
    ) {
      return reject(
        state,
        "INVALID_SALE_SELECTION",
        "Every sale requires an Industry, Merchant, and beer source.",
      );
    }
    if (selectedIds.has(sale.industryId)) {
      return reject(
        state,
        "DUPLICATE_INDUSTRY",
        `Industry is selected more than once: ${sale.industryId}.`,
        { industryId: sale.industryId },
      );
    }
    selectedIds.add(sale.industryId);
  }

  const adjacency = buildAdjacency(Object.keys(state.builtLinks));
  let industries: Readonly<Record<string, SellIndustryState>> = state.industries;
  let merchantSpaces = state.merchantSpaces.map((merchant) => ({
    ...merchant,
    demandIndustries: [...merchant.demandIndustries],
  }));
  let money = state.player.money;
  let victoryPoints = state.player.victoryPoints;
  let incomeMarkerSpace = state.player.incomeMarkerSpace;
  let moneyReward = 0;
  let victoryPointReward = 0;
  let freeDevelops = 0;
  let industryIncomeSpacesPrinted = 0;
  let incomeSpacesAdvanced = 0;
  const effects: SellTileEffect[] = [];

  for (const [selectionIndex, sale] of selection.sales.entries()) {
    const industry = industries[sale.industryId];
    if (!industry) {
      return reject(
        state,
        "UNKNOWN_INDUSTRY",
        `Unknown Industry: ${sale.industryId}.`,
        { selectionIndex, industryId: sale.industryId },
      );
    }
    if (industry.owner !== state.seat) {
      return reject(
        state,
        "INDUSTRY_NOT_OWNED",
        `Industry is not owned by ${state.seat}: ${sale.industryId}.`,
        { selectionIndex, industryId: sale.industryId },
      );
    }
    const kind = sellableKind(industry.faceId);
    if (!kind) {
      return reject(
        state,
        "INDUSTRY_NOT_SELLABLE",
        `Industry cannot be sold: ${sale.industryId}.`,
        { selectionIndex, industryId: sale.industryId },
      );
    }
    if (industry.flipped) {
      return reject(
        state,
        "INDUSTRY_ALREADY_FLIPPED",
        `Industry is already flipped: ${sale.industryId}.`,
        { selectionIndex, industryId: sale.industryId },
      );
    }
    if (industry.product !== 1) {
      return reject(
        state,
        "PRODUCT_UNAVAILABLE",
        `Industry has no product: ${sale.industryId}.`,
        { selectionIndex, industryId: sale.industryId },
      );
    }

    const merchantIndex = merchantSpaces.findIndex(
      (merchant) => merchant.merchantSpaceId === sale.merchantSpaceId,
    );
    if (merchantIndex === -1) {
      return reject(
        state,
        "UNKNOWN_MERCHANT",
        `Unknown Merchant space: ${sale.merchantSpaceId}.`,
        { selectionIndex, merchantSpaceId: sale.merchantSpaceId },
      );
    }
    const merchant = merchantSpaces[merchantIndex];
    if (!merchant.active) {
      return reject(
        state,
        "MERCHANT_INACTIVE",
        `Merchant space is inactive: ${sale.merchantSpaceId}.`,
        { selectionIndex, merchantSpaceId: sale.merchantSpaceId },
      );
    }
    if (!merchant.demandIndustries.includes(kind)) {
      return reject(
        state,
        "MERCHANT_DEMAND_MISMATCH",
        `Merchant does not demand ${kind}: ${sale.merchantSpaceId}.`,
        { selectionIndex, industryId: sale.industryId, merchantSpaceId: sale.merchantSpaceId },
      );
    }
    if (!connected(adjacency, industry.locationId, merchant.locationId)) {
      return reject(
        state,
        "MERCHANT_NOT_CONNECTED",
        `Industry is not connected to Merchant: ${sale.industryId}.`,
        { selectionIndex, industryId: sale.industryId, merchantSpaceId: sale.merchantSpaceId },
      );
    }

    let beerEffect: SellBeerEffect | null = null;
    let merchantBeerConsumed = false;
    if (sale.beerSource.kind === "merchant") {
      if (merchant.beer !== 1) {
        return reject(
          state,
          "MERCHANT_BEER_UNAVAILABLE",
          `Merchant beer is unavailable: ${sale.merchantSpaceId}.`,
          { selectionIndex, merchantSpaceId: sale.merchantSpaceId },
        );
      }
      merchantSpaces = merchantSpaces.map((candidate, index) =>
        index === merchantIndex ? { ...candidate, beer: 0 } : candidate,
      );
      merchantBeerConsumed = true;
    } else {
      if (merchant.beer === 1) {
        return reject(
          state,
          "MERCHANT_BEER_REQUIRED",
          `Merchant beer must be consumed first: ${sale.merchantSpaceId}.`,
          { selectionIndex, merchantSpaceId: sale.merchantSpaceId },
        );
      }
      if (typeof sale.beerSource.industryId !== "string") {
        return reject(
          state,
          "INVALID_BEER_SELECTION",
          "A Brewery beer source requires an Industry ID.",
          { selectionIndex },
        );
      }
      const brewery = industries[sale.beerSource.industryId];
      const breweryFace = brewery
        ? INDUSTRY_TILE_FACE_BY_ID[brewery.faceId]
        : null;
      if (
        !brewery ||
        breweryFace?.industry !== "brewery" ||
        brewery.flipped ||
        brewery.beer < 1
      ) {
        return reject(
          state,
          "BREWERY_UNAVAILABLE",
          `Brewery beer is unavailable: ${sale.beerSource.industryId}.`,
          { selectionIndex, industryId: sale.beerSource.industryId },
        );
      }
      if (
        brewery.owner !== state.seat &&
        !connected(adjacency, industry.locationId, brewery.locationId)
      ) {
        return reject(
          state,
          "BREWERY_NOT_CONNECTED",
          `Opponent Brewery is not connected: ${sale.beerSource.industryId}.`,
          { selectionIndex, industryId: sale.beerSource.industryId },
        );
      }
      const beerRemaining = brewery.beer - 1;
      const depleted = beerRemaining === 0;
      industries = {
        ...industries,
        [sale.beerSource.industryId]: {
          ...brewery,
          beer: beerRemaining,
          flipped: depleted,
        },
      };
      beerEffect = {
        kind: "brewery",
        industryId: sale.beerSource.industryId,
        owner: brewery.owner,
        locationId: brewery.locationId,
        beerRemaining,
        depleted,
      };
    }

    const face = INDUSTRY_TILE_FACE_BY_ID[industry.faceId];
    const beforeIndustryIncome = incomeMarkerSpace;
    incomeMarkerSpace = advanceIncomeSpaces(
      incomeMarkerSpace,
      face.incomeSteps,
    );
    const industrySpacesAdvanced = incomeMarkerSpace - beforeIndustryIncome;
    const afterIndustryIncome = incomeMarkerSpace;
    industryIncomeSpacesPrinted += face.incomeSteps;
    incomeSpacesAdvanced += industrySpacesAdvanced;
    industries = {
      ...industries,
      [sale.industryId]: {
        ...industry,
        product: 0,
        flipped: true,
      },
    };
    if (merchantBeerConsumed) {
      const bonus = merchantBonus(merchant, incomeMarkerSpace);
      if (
        !Number.isSafeInteger(money + bonus.money) ||
        !Number.isSafeInteger(victoryPoints + bonus.victoryPoints)
      ) {
        return reject(
          state,
          "REWARD_OVERFLOW",
          "Merchant reward would exceed the safe integer range.",
          { selectionIndex, merchantSpaceId: sale.merchantSpaceId },
        );
      }
      money += bonus.money;
      victoryPoints += bonus.victoryPoints;
      incomeMarkerSpace = bonus.incomeMarkerSpace;
      moneyReward += bonus.money;
      victoryPointReward += bonus.victoryPoints;
      incomeSpacesAdvanced += bonus.incomeSpacesAdvanced;
      freeDevelops += bonus.freeDevelops;
      beerEffect = {
        kind: "merchant",
        merchantSpaceId: merchant.merchantSpaceId,
        locationId: merchant.locationId,
        bonus: bonus.effect,
      };
    }
    if (beerEffect === null) {
      return reject(
        state,
        "INVALID_BEER_SELECTION",
        "Sell planning failed to resolve a beer source.",
        { selectionIndex },
      );
    }
    effects.push({
      selectionIndex,
      industryId: sale.industryId,
      faceId: industry.faceId,
      industryKind: kind,
      merchantSpaceId: merchant.merchantSpaceId,
      merchantLocationId: merchant.locationId,
      beer: beerEffect,
      income: {
        printedSpaces: face.incomeSteps,
        fromMarkerSpace: beforeIndustryIncome,
        toMarkerSpace: afterIndustryIncome,
        spacesAdvanced: industrySpacesAdvanced,
      },
    });
  }

  let cards: CardZones;
  try {
    cards = discardActionCard(state.cards, state.seat, selection.cardId);
  } catch (error) {
    const message = messageFrom(error);
    return reject(
      state,
      message.startsWith("Unknown seat:") ? "UNKNOWN_SEAT" : "CARD_NOT_IN_HAND",
      message,
    );
  }

  return {
    ok: true,
    state: {
      ...state,
      player: { ...state.player, money, victoryPoints, incomeMarkerSpace },
      cards,
      industries,
      merchantSpaces,
    },
    effect: {
      type: "SOLD",
      seat: state.seat,
      discardedCardId: selection.cardId,
      actionsConsumed: 1,
      moneySpent: 0,
      soldIndustryIds: effects.map((effect) => effect.industryId),
      sales: effects,
      rewards: {
        industryIncomeSpacesPrinted,
        incomeSpacesAdvanced,
        money: moneyReward,
        victoryPoints: victoryPointReward,
        freeDevelops,
      },
    },
  };
}

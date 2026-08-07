import { discardActionCard } from "../cards-v2/zones";
import type { CardZones, PlayableCardId } from "../cards-v2/types";
import {
  purchaseFromResourceMarket,
  type ResourceMarketState,
} from "../economy/markets";
import {
  developIndustryTiles,
  type IndustryInventory,
  type IndustryInventoryErrorCode,
} from "../player-v2";
import type { IndustryTileId } from "../rules/generated/industry-tiles-v2";

export type DevelopIronIndustryState = {
  readonly owner: string;
  readonly cubes: number;
  readonly flipped: boolean;
};

export type DevelopActionState = {
  readonly seat: string;
  readonly player: {
    readonly money: number;
    readonly inventory: IndustryInventory;
  };
  readonly cards: CardZones;
  readonly market: ResourceMarketState;
  readonly ironIndustries: Readonly<Record<string, DevelopIronIndustryState>>;
};

export type DevelopActionSelection = {
  readonly cardId: PlayableCardId;
  readonly tileIds: readonly string[];
  /**
   * Chosen board-iron sources in consumption order. Iron is globally
   * available, so the action itself prevents a market purchase while any
   * unselected board iron could satisfy the requirement.
   */
  readonly accessibleIronIndustryIds: readonly string[];
  readonly purchaseMarketShortfall: boolean;
};

export type DevelopActionErrorCode =
  | IndustryInventoryErrorCode
  | "INVALID_DEVELOP_STATE"
  | "INVALID_DEVELOP_SELECTION"
  | "INVALID_IRON_SELECTION"
  | "IRON_SOURCE_UNAVAILABLE"
  | "INSUFFICIENT_IRON"
  | "INSUFFICIENT_MONEY"
  | "UNKNOWN_SEAT"
  | "CARD_NOT_IN_HAND";

export type DevelopActionError = {
  readonly code: DevelopActionErrorCode;
  readonly message: string;
  readonly tileId?: string;
  readonly selectionIndex?: number;
  readonly industryId?: string;
};

export type DevelopBoardIronEffect = {
  readonly industryId: string;
  readonly owner: string;
  readonly unitsConsumed: number;
  readonly cubesRemaining: number;
  readonly depleted: boolean;
};

export type DevelopActionEffect = {
  readonly type: "DEVELOPED";
  readonly seat: string;
  readonly discardedCardId: PlayableCardId;
  readonly removedTileIds: readonly IndustryTileId[];
  readonly actionsConsumed: 1;
  /** Total external-market cost to add to the round spend ledger. */
  readonly moneySpent: number;
  readonly iron: {
    readonly requiredUnits: 1 | 2;
    readonly boardSources: readonly DevelopBoardIronEffect[];
    readonly market: {
      readonly unitsPurchased: number;
      readonly unitPrices: readonly number[];
      readonly totalCost: number;
    };
  };
};

export type DevelopActionResult =
  | {
      readonly ok: true;
      readonly state: DevelopActionState;
      readonly effect: DevelopActionEffect;
    }
  | {
      readonly ok: false;
      readonly state: DevelopActionState;
      readonly error: DevelopActionError;
    };

function reject(
  state: DevelopActionState,
  error: DevelopActionError,
): Extract<DevelopActionResult, { ok: false }> {
  return { ok: false, state, error };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validateState(
  state: DevelopActionState,
): Extract<DevelopActionResult, { ok: false }> | null {
  if (typeof state.seat !== "string" || state.seat.trim().length === 0) {
    return reject(state, {
      code: "INVALID_DEVELOP_STATE",
      message: "Acting seat must be a non-empty string.",
    });
  }
  if (!isNonNegativeSafeInteger(state.player.money)) {
    return reject(state, {
      code: "INVALID_DEVELOP_STATE",
      message: "Player money must be a non-negative safe integer.",
    });
  }

  try {
    purchaseFromResourceMarket(state.market, "iron", 0);
  } catch (error) {
    return reject(state, {
      code: "INVALID_DEVELOP_STATE",
      message: messageFrom(error),
    });
  }

  if (
    typeof state.ironIndustries !== "object" ||
    state.ironIndustries === null ||
    Array.isArray(state.ironIndustries)
  ) {
    return reject(state, {
      code: "INVALID_DEVELOP_STATE",
      message: "Iron industry state must be an object.",
    });
  }

  for (const [industryId, industry] of Object.entries(state.ironIndustries)) {
    if (
      industryId.length === 0 ||
      !industry ||
      typeof industry.owner !== "string" ||
      industry.owner.trim().length === 0 ||
      !isNonNegativeSafeInteger(industry.cubes) ||
      typeof industry.flipped !== "boolean" ||
      industry.flipped !== (industry.cubes === 0)
    ) {
      return reject(state, {
        code: "INVALID_DEVELOP_STATE",
        message: `Invalid iron industry state: ${industryId}.`,
        industryId,
      });
    }
  }
  return null;
}

/**
 * Performs one complete Develop action atomically.
 *
 * Tile order/protections remain authoritative in the player inventory module.
 * The caller supplies the complete, ordered accessible iron-source boundary;
 * this action applies availability, board-before-market, payment, and card use.
 */
export function developAction(
  state: DevelopActionState,
  selection: DevelopActionSelection,
): DevelopActionResult {
  const invalidState = validateState(state);
  if (invalidState) return invalidState;

  if (
    typeof selection !== "object" ||
    selection === null ||
    !Array.isArray(selection.tileIds)
  ) {
    return reject(state, {
      code: "INVALID_DEVELOP_SELECTION",
      message: "Develop requires a tile-selection array.",
    });
  }
  if (
    !Array.isArray(selection.accessibleIronIndustryIds) ||
    typeof selection.purchaseMarketShortfall !== "boolean"
  ) {
    return reject(state, {
      code: "INVALID_IRON_SELECTION",
      message: "Develop requires an iron-source list and market-shortfall choice.",
    });
  }
  if (
    selection.accessibleIronIndustryIds.some(
      (industryId) => typeof industryId !== "string" || industryId.length === 0,
    ) ||
    new Set(selection.accessibleIronIndustryIds).size !==
      selection.accessibleIronIndustryIds.length
  ) {
    return reject(state, {
      code: "INVALID_IRON_SELECTION",
      message: "Accessible iron industry IDs must be non-empty and unique.",
    });
  }

  const inventoryResult = developIndustryTiles(
    state.player.inventory,
    selection.tileIds,
  );
  if (!inventoryResult.ok) {
    return reject(state, { ...inventoryResult.error });
  }

  for (const industryId of selection.accessibleIronIndustryIds) {
    const industry = state.ironIndustries[industryId];
    if (!industry || industry.flipped || industry.cubes === 0) {
      return reject(state, {
        code: "IRON_SOURCE_UNAVAILABLE",
        message: `Iron source is unavailable: ${industryId}.`,
        industryId,
      });
    }
  }

  let remainingUnits: number = inventoryResult.ironUnitsRequired;
  let ironIndustries = state.ironIndustries;
  const boardSources: DevelopBoardIronEffect[] = [];

  for (const industryId of selection.accessibleIronIndustryIds) {
    if (remainingUnits === 0) break;
    const industry = ironIndustries[industryId];
    const unitsConsumed = Math.min(industry.cubes, remainingUnits);
    const cubesRemaining = industry.cubes - unitsConsumed;
    const depleted = cubesRemaining === 0;
    ironIndustries = {
      ...ironIndustries,
      [industryId]: { ...industry, cubes: cubesRemaining, flipped: depleted },
    };
    boardSources.push({
      industryId,
      owner: industry.owner,
      unitsConsumed,
      cubesRemaining,
      depleted,
    });
    remainingUnits -= unitsConsumed;
  }

  const omittedBoardIron =
    remainingUnits > 0
      ? Object.entries(ironIndustries).find(
          ([, industry]) => !industry.flipped && industry.cubes > 0,
        )
      : undefined;
  if (omittedBoardIron) {
    return reject(state, {
      code: "INVALID_IRON_SELECTION",
      message: `Board iron must be consumed before the market: ${omittedBoardIron[0]}.`,
      industryId: omittedBoardIron[0],
    });
  }

  if (remainingUnits > 0 && !selection.purchaseMarketShortfall) {
    return reject(state, {
      code: "INSUFFICIENT_IRON",
      message: `${remainingUnits} additional iron unit(s) are required.`,
    });
  }

  const marketPurchase = purchaseFromResourceMarket(
    state.market,
    "iron",
    remainingUnits,
  );
  if (state.player.money < marketPurchase.totalCost) {
    return reject(state, {
      code: "INSUFFICIENT_MONEY",
      message: `Develop requires £${marketPurchase.totalCost} for market iron.`,
    });
  }

  let cards: CardZones;
  try {
    cards = discardActionCard(state.cards, state.seat, selection.cardId);
  } catch (error) {
    const message = messageFrom(error);
    return reject(state, {
      code: message.startsWith("Unknown seat:")
        ? "UNKNOWN_SEAT"
        : "CARD_NOT_IN_HAND",
      message,
    });
  }

  return {
    ok: true,
    state: {
      ...state,
      player: {
        ...state.player,
        money: state.player.money - marketPurchase.totalCost,
        inventory: inventoryResult.inventory,
      },
      cards,
      market: marketPurchase.market,
      ironIndustries,
    },
    effect: {
      type: "DEVELOPED",
      seat: state.seat,
      discardedCardId: selection.cardId,
      removedTileIds: inventoryResult.removedTileIds,
      actionsConsumed: 1,
      moneySpent: marketPurchase.totalCost,
      iron: {
        requiredUnits: inventoryResult.ironUnitsRequired,
        boardSources,
        market: {
          unitsPurchased: marketPurchase.unitsMoved,
          unitPrices: marketPurchase.unitPrices,
          totalCost: marketPurchase.totalCost,
        },
      },
    },
  };
}

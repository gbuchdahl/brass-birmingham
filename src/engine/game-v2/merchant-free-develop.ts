import { developIndustryTiles } from "../player-v2";
import type { IndustryInventoryErrorCode } from "../player-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
} from "../rules/generated/industry-tiles-v2";
import {
  validateGameStateV2,
  type GameStateV2,
  type PendingMerchantFreeDevelopV2,
} from "./state";

export type MerchantFreeDevelopSelectionV2 = {
  readonly tileIds: readonly string[];
};

export type MerchantFreeDevelopEffectV2 = {
  readonly type: "MERCHANT_FREE_DEVELOP_RESOLVED";
  readonly seat: string;
  readonly removedTileIds: readonly IndustryTileId[];
  readonly source: PendingMerchantFreeDevelopV2["source"];
  readonly merchantSpaceIds: readonly string[];
  /** Bonuses that could not be used because no developable top tile remained. */
  readonly skippedUnavailableBonuses: number;
};

export type MerchantFreeDevelopErrorCodeV2 =
  | IndustryInventoryErrorCode
  | "INVALID_GAME_STATE"
  | "FOLLOW_UP_NOT_PENDING"
  | "INVALID_FREE_DEVELOP_COUNT"
  | "FREE_DEVELOP_SELECTION_REQUIRED";

export type MerchantFreeDevelopErrorV2 = {
  readonly code: MerchantFreeDevelopErrorCodeV2;
  readonly message: string;
  readonly tileId?: string;
  readonly selectionIndex?: number;
};

export type MerchantFreeDevelopResultV2 =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly effect: MerchantFreeDevelopEffectV2;
    }
  | {
      readonly ok: false;
      readonly state: GameStateV2;
      readonly error: MerchantFreeDevelopErrorV2;
    };

function reject(
  state: GameStateV2,
  error: MerchantFreeDevelopErrorV2,
): MerchantFreeDevelopResultV2 {
  return { ok: false, state, error };
}

function hasDevelopableTopTile(
  state: GameStateV2,
  seat: string,
): boolean {
  return Object.values(state.players[seat].industryInventory.stacks).some(
    (stack) => {
      const tileId = stack[0];
      return tileId !== undefined && INDUSTRY_TILE_BY_ID[tileId].developable;
    },
  );
}

/**
 * Resolves Gloucester's Merchant bonus without applying normal Develop costs.
 *
 * This transition deliberately does not advance the action lifecycle. The
 * parent command reducer must record the original Sell only after this pending
 * follow-up succeeds, keeping save/reload and replay behavior atomic.
 */
export function resolveMerchantFreeDevelopV2(
  state: GameStateV2,
  selection: MerchantFreeDevelopSelectionV2,
): MerchantFreeDevelopResultV2 {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    return reject(state, {
      code: "INVALID_GAME_STATE",
      message: `${first.path}: ${first.message}`,
    });
  }
  if (state.progress.phase !== "merchant_free_develop") {
    return reject(state, {
      code: "FOLLOW_UP_NOT_PENDING",
      message: "There is no pending Merchant free Develop to resolve.",
    });
  }
  if (
    typeof selection !== "object" ||
    selection === null ||
    !Array.isArray(selection.tileIds) ||
    selection.tileIds.length > state.progress.pending.count ||
    selection.tileIds.some(
      (tileId) => typeof tileId !== "string" || tileId.length === 0,
    )
  ) {
    return reject(state, {
      code: "INVALID_FREE_DEVELOP_COUNT",
      message: `Merchant free Develop allows at most ${state.progress.pending.count} tile selection(s).`,
    });
  }

  const pending = state.progress.pending;
  const player = state.players[pending.seat];
  const developed = selection.tileIds.length === 0
    ? {
        ok: true as const,
        inventory: player.industryInventory,
        removedTileIds: [] as IndustryTileId[],
      }
    : developIndustryTiles(player.industryInventory, selection.tileIds);
  if (!developed.ok) return reject(state, developed.error);
  const skippedUnavailableBonuses = pending.count - developed.removedTileIds.length;

  const nextState: GameStateV2 = {
    ...state,
    progress: { phase: "action" },
    players: {
      ...state.players,
      [pending.seat]: {
        ...player,
        industryInventory: developed.inventory,
        removedIndustryTileIds: [
          ...player.removedIndustryTileIds,
          ...developed.removedTileIds,
        ],
      },
    },
  };
  if (
    skippedUnavailableBonuses > 0 &&
    hasDevelopableTopTile(nextState, pending.seat)
  ) {
    return reject(state, {
      code: "FREE_DEVELOP_SELECTION_REQUIRED",
      message: "Every available Merchant free Develop must remove an eligible top tile.",
    });
  }
  const nextValidation = validateGameStateV2(nextState);
  if (!nextValidation.ok) {
    const first = nextValidation.errors[0];
    return reject(state, {
      code: "INVALID_GAME_STATE",
      message: `Merchant free Develop produced invalid state at ${first.path}: ${first.message}`,
    });
  }

  return {
    ok: true,
    state: nextState,
    effect: {
      type: "MERCHANT_FREE_DEVELOP_RESOLVED",
      seat: pending.seat,
      removedTileIds: developed.removedTileIds,
      source: pending.source,
      merchantSpaceIds: [...pending.merchantSpaceIds],
      skippedUnavailableBonuses,
    },
  };
}

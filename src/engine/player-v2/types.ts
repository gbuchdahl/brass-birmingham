import type {
  IndustryTileId,
  IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";

export const INDUSTRY_INVENTORY_SCHEMA_VERSION = 1 as const;

export type IndustryEra = "canal" | "rail";

/**
 * The dynamic portion of one player's industry tile mat.
 *
 * Stack index 0 is the lowest remaining tile and therefore the only tile that
 * can currently be built or developed. Keeping only generated physical IDs in
 * state makes the inventory JSON-safe and independent of object identity.
 */
export type IndustryInventory = {
  schemaVersion: typeof INDUSTRY_INVENTORY_SCHEMA_VERSION;
  stacks: Record<IndustryTileKind, IndustryTileId[]>;
};

export type IndustryInventoryErrorCode =
  | "INVALID_DEVELOP_COUNT"
  | "TILE_NOT_AVAILABLE"
  | "TILE_NOT_BUILDABLE_IN_ERA"
  | "TILE_NOT_DEVELOPABLE"
  | "TILE_NOT_ON_TOP"
  | "UNKNOWN_TILE";

export type IndustryInventoryError = {
  code: IndustryInventoryErrorCode;
  message: string;
  tileId?: string;
  selectionIndex?: number;
};

export type RemoveBuiltTileResult =
  | {
      ok: true;
      inventory: IndustryInventory;
      removedTileId: IndustryTileId;
    }
  | {
      ok: false;
      inventory: IndustryInventory;
      error: IndustryInventoryError;
    };

export type DevelopIndustryTilesResult =
  | {
      ok: true;
      inventory: IndustryInventory;
      removedTileIds: IndustryTileId[];
      ironUnitsRequired: 1 | 2;
    }
  | {
      ok: false;
      inventory: IndustryInventory;
      error: IndustryInventoryError;
    };

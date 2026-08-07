import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_STACKS,
  type IndustryTile,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import {
  INDUSTRY_INVENTORY_SCHEMA_VERSION,
  type DevelopIndustryTilesResult,
  type IndustryEra,
  type IndustryInventory,
  type IndustryInventoryError,
  type RemoveBuiltTileResult,
} from "./types";

const TILES_BY_RUNTIME_ID: Readonly<Record<string, IndustryTile>> =
  INDUSTRY_TILE_BY_ID;

function initialStack(kind: IndustryTileKind): IndustryTileId[] {
  return INDUSTRY_TILE_STACKS[kind].map((tile) => tile.id);
}

/** Creates the complete 45-tile player mat in its printed stack order. */
export function createIndustryInventory(): IndustryInventory {
  return {
    schemaVersion: INDUSTRY_INVENTORY_SCHEMA_VERSION,
    stacks: {
      manufacturer: initialStack("manufacturer"),
      cotton: initialStack("cotton"),
      brewery: initialStack("brewery"),
      coal: initialStack("coal"),
      pottery: initialStack("pottery"),
      iron: initialStack("iron"),
    },
  };
}

/** Returns the lowest remaining physical tile ID for an industry. */
export function getLowestIndustryTileId(
  inventory: IndustryInventory,
  industry: IndustryTileKind,
): IndustryTileId | undefined {
  return inventory.stacks[industry][0];
}

function isBuildableInEra(tile: IndustryTile, era: IndustryEra): boolean {
  return (
    tile.build.era === "either" ||
    (era === "canal" && tile.build.era === "canal_only") ||
    (era === "rail" && tile.build.era === "rail_only")
  );
}

/**
 * Returns the current top tile when it can be built in the requested era.
 * An era-ineligible top tile blocks the tiles behind it; this never skips a
 * physical tile in the stack.
 */
export function getNextBuildableIndustryTileId(
  inventory: IndustryInventory,
  industry: IndustryTileKind,
  era: IndustryEra,
): IndustryTileId | undefined {
  const tileId = getLowestIndustryTileId(inventory, industry);
  if (!tileId) return undefined;
  return isBuildableInEra(INDUSTRY_TILE_BY_ID[tileId], era)
    ? tileId
    : undefined;
}

function failure(
  inventory: IndustryInventory,
  error: IndustryInventoryError,
): Extract<RemoveBuiltTileResult, { ok: false }> {
  return { ok: false, inventory, error };
}

type ValidatedTopTile = {
  tile: IndustryTile;
  tileId: IndustryTileId;
  stack: IndustryTileId[];
};

function validateTopTile(
  inventory: IndustryInventory,
  tileId: string,
  selectionIndex?: number,
):
  | { ok: true; value: ValidatedTopTile }
  | { ok: false; error: IndustryInventoryError } {
  const tile = TILES_BY_RUNTIME_ID[tileId];
  if (!tile) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_TILE",
        message: `Unknown industry tile: ${tileId}`,
        tileId,
        selectionIndex,
      },
    };
  }

  const stack = inventory.stacks[tile.industry];
  const position = stack.indexOf(tile.id);
  if (position === -1) {
    return {
      ok: false,
      error: {
        code: "TILE_NOT_AVAILABLE",
        message: `Industry tile is no longer on the player mat: ${tileId}`,
        tileId,
        selectionIndex,
      },
    };
  }
  if (position !== 0) {
    return {
      ok: false,
      error: {
        code: "TILE_NOT_ON_TOP",
        message: `Industry tile is not the lowest remaining ${tile.industry} tile: ${tileId}`,
        tileId,
        selectionIndex,
      },
    };
  }

  return { ok: true, value: { tile, tileId: tile.id, stack } };
}

function removeValidatedTopTile(
  inventory: IndustryInventory,
  validated: ValidatedTopTile,
): IndustryInventory {
  return {
    ...inventory,
    stacks: {
      ...inventory.stacks,
      [validated.tile.industry]: validated.stack.slice(1),
    },
  };
}

/** Removes one selected physical tile after a successful Build action. */
export function removeBuiltIndustryTile(
  inventory: IndustryInventory,
  tileId: string,
  era: IndustryEra,
): RemoveBuiltTileResult {
  const validated = validateTopTile(inventory, tileId);
  if (!validated.ok) return failure(inventory, validated.error);

  if (!isBuildableInEra(validated.value.tile, era)) {
    return failure(inventory, {
      code: "TILE_NOT_BUILDABLE_IN_ERA",
      message: `Industry tile cannot be built in the ${era} era: ${tileId}`,
      tileId,
    });
  }

  return {
    ok: true,
    inventory: removeValidatedTopTile(inventory, validated.value),
    removedTileId: validated.value.tileId,
  };
}

/**
 * Resolves the tile-selection portion of Develop, without paying iron.
 *
 * Selections are evaluated in order, allowing both removals to target the same
 * industry when each physical ID is the current top at that point. Any invalid
 * selection rejects the complete operation and returns the original inventory.
 */
export function developIndustryTiles(
  inventory: IndustryInventory,
  selectedTileIds: readonly string[],
): DevelopIndustryTilesResult {
  if (selectedTileIds.length !== 1 && selectedTileIds.length !== 2) {
    return {
      ok: false,
      inventory,
      error: {
        code: "INVALID_DEVELOP_COUNT",
        message: "Develop requires exactly one or two industry tiles.",
      },
    };
  }

  let workingInventory = inventory;
  const removedTileIds: IndustryTileId[] = [];

  for (const [selectionIndex, tileId] of selectedTileIds.entries()) {
    const validated = validateTopTile(
      workingInventory,
      tileId,
      selectionIndex,
    );
    if (!validated.ok) {
      return { ok: false, inventory, error: validated.error };
    }
    if (!validated.value.tile.developable) {
      return {
        ok: false,
        inventory,
        error: {
          code: "TILE_NOT_DEVELOPABLE",
          message: `Industry tile is protected from Develop: ${tileId}`,
          tileId,
          selectionIndex,
        },
      };
    }

    workingInventory = removeValidatedTopTile(
      workingInventory,
      validated.value,
    );
    removedTileIds.push(validated.value.tileId);
  }

  return {
    ok: true,
    inventory: workingInventory,
    removedTileIds,
    ironUnitsRequired: selectedTileIds.length,
  };
}

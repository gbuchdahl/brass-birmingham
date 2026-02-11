import type { GameState, TileInvariantError, TileState } from "../types";

export type TileInvariantViolation = {
  code: TileInvariantError;
  tileId: string;
  message: string;
};

export function assertTileFlipInvariant(
  tileId: string,
  tile: TileState,
): TileInvariantViolation | null {
  if (tile.resourcesRemaining === 0 && !tile.flipped) {
    return {
      code: "INVALID_TILE_FLIP_STATE",
      tileId,
      message: `Tile ${tileId} has no resources but is not flipped.`,
    };
  }
  if (tile.resourcesRemaining > 0 && tile.flipped) {
    return {
      code: "INVALID_TILE_FLIP_STATE",
      tileId,
      message: `Tile ${tileId} has resources remaining but is flipped.`,
    };
  }
  return null;
}

export function assertAllTileInvariants(
  state: GameState,
): TileInvariantViolation | null {
  for (const [tileId, tile] of Object.entries(state.board.tiles)) {
    const violation = assertTileFlipInvariant(tileId, tile);
    if (violation) {
      return violation;
    }
  }
  return null;
}

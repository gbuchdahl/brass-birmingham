import type { CityId } from "@/engine/board/topology";
import type { GameState, IndustryKind, TileState } from "@/engine/types";

type TileOverrides = Partial<TileState> & {
  city?: CityId;
  industry?: IndustryKind;
};

export function makeTile(id: string, overrides: TileOverrides): TileState {
  const industry = overrides.industry ?? "coal";
  return {
    id,
    city: overrides.city ?? "Nuneaton",
    industry,
    owner: overrides.owner ?? "A",
    level: overrides.level ?? 1,
    resourcesRemaining: overrides.resourcesRemaining ?? 1,
    incomeOnFlip: overrides.incomeOnFlip ?? 1,
    flipped: overrides.flipped ?? false,
  };
}

export function withTiles(
  state: GameState,
  tiles: Record<string, TileState>,
): GameState {
  return {
    ...state,
    board: {
      ...state.board,
      tiles,
    },
  };
}

import { CITY_DEFS } from "../board/topology";
import type { BuildIndustry } from "../actions";
import type { GameState, TileState } from "../types";
import { INDUSTRY_PLACEHOLDER_TABLE } from "./config";
import { moveCoalToMarket, moveIronToMarket } from "./resources";

export type ApplyBuildIndustryResult =
  | {
      ok: true;
      state: GameState;
      tileId: string;
      marketMoved: number;
      resourcesRemaining: number;
      flipped: boolean;
      incomeDelta: number;
      buildCost: number;
    }
  | {
      ok: false;
      code: "ILLEGAL_INDUSTRY_BUILD";
      message: string;
    };

function citySupportsIndustry(
  city: BuildIndustry["city"],
  industry: BuildIndustry["industry"],
): boolean {
  const label = industry === "coal" ? "Coal" : "Iron";
  return CITY_DEFS[city].industries.some((allowed) => allowed === label);
}

function hasUnflippedIndustryTile(
  state: GameState,
  city: BuildIndustry["city"],
  industry: BuildIndustry["industry"],
): boolean {
  return Object.values(state.board.tiles).some(
    (tile) => tile.city === city && tile.industry === industry && !tile.flipped,
  );
}

export function applyBuildIndustry(
  state: GameState,
  action: BuildIndustry,
): ApplyBuildIndustryResult {
  const config = INDUSTRY_PLACEHOLDER_TABLE[action.industry][action.level as 1];
  if (!config) {
    return {
      ok: false,
      code: "ILLEGAL_INDUSTRY_BUILD",
      message: "Unsupported industry level for this placeholder milestone.",
    };
  }
  if (!citySupportsIndustry(action.city, action.industry)) {
    return {
      ok: false,
      code: "ILLEGAL_INDUSTRY_BUILD",
      message: "That industry cannot be built in the selected city.",
    };
  }
  if (hasUnflippedIndustryTile(state, action.city, action.industry)) {
    return {
      ok: false,
      code: "ILLEGAL_INDUSTRY_BUILD",
      message: "An unflipped tile of that industry already exists in the city.",
    };
  }
  if (state.players[action.player].money < config.buildCost) {
    return {
      ok: false,
      code: "ILLEGAL_INDUSTRY_BUILD",
      message: "Not enough money to build this industry tile.",
    };
  }

  const tileId = `tile-${action.industry}-${state.log.length}`;
  const placedTile: TileState = {
    id: tileId,
    city: action.city,
    industry: action.industry,
    owner: action.player,
    level: action.level,
    resourcesRemaining: config.cubesProduced,
    incomeOnFlip: config.incomeOnFlip,
    flipped: config.cubesProduced === 0,
  };

  const afterPlacement: GameState = {
    ...state,
    players: {
      ...state.players,
      [action.player]: {
        ...state.players[action.player],
        money: state.players[action.player].money - config.buildCost,
      },
    },
    board: {
      ...state.board,
      tiles: {
        ...state.board.tiles,
        [tileId]: placedTile,
      },
    },
  };

  const moved =
    action.industry === "coal"
      ? moveCoalToMarket(afterPlacement, tileId)
      : moveIronToMarket(afterPlacement, tileId);
  const tileAfterMove = moved.state.board.tiles[tileId];

  return {
    ok: true,
    state: moved.state,
    tileId,
    marketMoved: moved.moved,
    resourcesRemaining: tileAfterMove.resourcesRemaining,
    flipped: tileAfterMove.flipped,
    incomeDelta: moved.incomeDelta,
    buildCost: config.buildCost,
  };
}

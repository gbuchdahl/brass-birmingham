import { CITY_DEFS } from "../board/topology";
import type { BuildIndustry } from "../actions";
import type { GameState, TileState } from "../types";
import { INDUSTRY_LEVEL_TABLE } from "./config";
import { consumeCardFromHand, validateBuildCard } from "./cards";
import {
  moveCoalToMarket,
  moveIronToMarket,
  resolveCoal,
  resolveIron,
  type CoalSource,
  type IronSource,
} from "./resources";

type BuildFailureCode =
  | "ILLEGAL_INDUSTRY_BUILD"
  | "CARD_NOT_IN_HAND"
  | "INVALID_BUILD_CARD"
  | "CARD_DOES_NOT_ALLOW_BUILD"
  | "BUILD_NOT_CONNECTED_FOR_CARD"
  | "INSUFFICIENT_RESOURCES";

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
      cardId: string;
      cardKind: "Location" | "Industry" | "Wild";
      discardedCardId: string;
      resourceSpend: number;
      resourceSources: {
        coal: { required: number; sources: CoalSource[]; spend: number };
        iron: { required: number; sources: IronSource[]; spend: number };
      };
    }
  | {
      ok: false;
      code: BuildFailureCode;
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
  const levelConfig = INDUSTRY_LEVEL_TABLE[action.industry][action.level];
  if (!levelConfig) {
    return {
      ok: false,
      code: "ILLEGAL_INDUSTRY_BUILD",
      message: "Unsupported industry level for this milestone.",
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

  const cardValidation = validateBuildCard(state, action);
  if (!cardValidation.ok) {
    return cardValidation;
  }

  if (state.players[action.player].money < levelConfig.money) {
    return {
      ok: false,
      code: "ILLEGAL_INDUSTRY_BUILD",
      message: "Not enough money to pay the base build cost.",
    };
  }

  let workingState = state;

  const coalResolution = resolveCoal(workingState, action.player, {
    requiredUnits: levelConfig.coalRequired,
    connectedTo: [action.city],
  });
  if (!coalResolution.ok) {
    return coalResolution;
  }
  workingState = coalResolution.state;

  const ironResolution = resolveIron(workingState, action.player, {
    requiredUnits: levelConfig.ironRequired,
  });
  if (!ironResolution.ok) {
    return ironResolution;
  }
  workingState = ironResolution.state;

  const afterCosts: GameState = {
    ...workingState,
    players: {
      ...workingState.players,
      [action.player]: {
        ...workingState.players[action.player],
        money: workingState.players[action.player].money - levelConfig.money,
      },
    },
  };

  const afterCard = consumeCardFromHand(afterCosts, action.player, action.cardId);

  const tileId = `tile-${action.industry}-${afterCard.log.length}`;
  const placedTile: TileState = {
    id: tileId,
    city: action.city,
    industry: action.industry,
    owner: action.player,
    level: action.level,
    resourcesRemaining: levelConfig.cubesProduced,
    incomeOnFlip: levelConfig.incomeOnFlip,
    flipped: levelConfig.cubesProduced === 0,
  };

  const afterPlacement: GameState = {
    ...afterCard,
    board: {
      ...afterCard.board,
      tiles: {
        ...afterCard.board.tiles,
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
    buildCost: levelConfig.money,
    cardId: action.cardId,
    cardKind: cardValidation.cardKind,
    discardedCardId: action.cardId,
    resourceSpend: coalResolution.spend + ironResolution.spend,
    resourceSources: {
      coal: {
        required: levelConfig.coalRequired,
        sources: coalResolution.sources,
        spend: coalResolution.spend,
      },
      iron: {
        required: levelConfig.ironRequired,
        sources: ironResolution.sources,
        spend: ironResolution.spend,
      },
    },
  };
}

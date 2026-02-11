import { areConnected } from "../board/api";
import type { CityId, NodeId } from "../board/topology";
import type { GameState, PlayerId, TileState } from "../types";
import {
  MAX_COAL_MARKET_UNITS,
  MAX_IRON_MARKET_UNITS,
  coalMarketPrice,
  ironMarketPrice,
} from "./config";

export type CoalSource =
  | { kind: "tile"; tileId: string; city: CityId }
  | { kind: "market"; price: number }
  | { kind: "fallback"; price: number };

export type IronSource =
  | { kind: "tile"; tileId: string; city: CityId }
  | { kind: "market"; price: number }
  | { kind: "fallback"; price: number };

type IncomeAward = {
  tileId: string;
  player: PlayerId;
  amount: number;
};

type ResolveResourceResult<TSource> =
  | {
      ok: true;
      state: GameState;
      sources: TSource[];
      spend: number;
      flippedTiles: string[];
      incomeAwards: IncomeAward[];
    }
  | {
      ok: false;
      code: "INSUFFICIENT_RESOURCES";
      message: string;
    };

export type ResolveCoalResult = ResolveResourceResult<CoalSource>;
export type ResolveIronResult = ResolveResourceResult<IronSource>;

export type MarketMoveResult = {
  state: GameState;
  moved: number;
  flipped: boolean;
  incomeDelta: number;
};

function isUsableCoalTile(tile: TileState): boolean {
  return tile.industry === "coal" && !tile.flipped && tile.resourcesRemaining > 0;
}

function isUsableIronTile(tile: TileState): boolean {
  return tile.industry === "iron" && !tile.flipped && tile.resourcesRemaining > 0;
}

function connectedCoalTiles(
  state: GameState,
  connectivityState: GameState,
  anchors?: NodeId[],
): Array<[string, TileState]> {
  const usable = Object.entries(state.board.tiles).filter(([, tile]) =>
    isUsableCoalTile(tile),
  );

  const connected =
    anchors && anchors.length > 0
      ? usable.filter(([, tile]) => {
          return anchors.some((anchor) =>
            areConnected(connectivityState, anchor, tile.city),
          );
        })
      : usable;

  connected.sort(([idA], [idB]) => idA.localeCompare(idB));
  return connected;
}

function ironTiles(state: GameState): Array<[string, TileState]> {
  const usable = Object.entries(state.board.tiles).filter(([, tile]) =>
    isUsableIronTile(tile),
  );
  usable.sort(([idA], [idB]) => idA.localeCompare(idB));
  return usable;
}

export type ResolveCoalOptions = {
  requiredUnits: number;
  connectivityState?: GameState;
  connectedTo?: NodeId[];
};

export type ResolveIronOptions = {
  requiredUnits: number;
};

function applyTileResourceConsumption(
  state: GameState,
  tileId: string,
  units: number,
): {
  state: GameState;
  flipped: boolean;
  incomeAward?: IncomeAward;
} {
  const tile = state.board.tiles[tileId];
  const resourcesRemaining = Math.max(0, tile.resourcesRemaining - units);
  const flipped = resourcesRemaining === 0;
  const nextTile: TileState = {
    ...tile,
    resourcesRemaining,
    flipped,
  };

  let nextState: GameState = {
    ...state,
    board: {
      ...state.board,
      tiles: {
        ...state.board.tiles,
        [tileId]: nextTile,
      },
    },
  };

  if (
    flipped &&
    tile.owner &&
    !tile.flipped &&
    tile.incomeOnFlip > 0
  ) {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [tile.owner]: {
          ...nextState.players[tile.owner],
          income: nextState.players[tile.owner].income + tile.incomeOnFlip,
        },
      },
    };
    return {
      state: nextState,
      flipped,
      incomeAward: {
        tileId,
        player: tile.owner,
        amount: tile.incomeOnFlip,
      },
    };
  }

  return { state: nextState, flipped };
}

export function resolveCoal(
  state: GameState,
  player: PlayerId,
  options: ResolveCoalOptions,
): ResolveCoalResult {
  if (options.requiredUnits <= 0) {
    return {
      ok: true,
      state,
      sources: [],
      spend: 0,
      flippedTiles: [],
      incomeAwards: [],
    };
  }
  let nextState = state;
  let totalSpend = 0;
  const sources: CoalSource[] = [];
  const flippedTiles: string[] = [];
  const incomeAwards: IncomeAward[] = [];

  for (let i = 0; i < options.requiredUnits; i += 1) {
    const connectivityState = options.connectivityState ?? nextState;
    const coalTiles = connectedCoalTiles(
      nextState,
      connectivityState,
      options.connectedTo,
    );
    if (coalTiles.length > 0) {
      const [tileId, tile] = coalTiles[0];
      const consumed = applyTileResourceConsumption(nextState, tileId, 1);
      nextState = consumed.state;
      if (consumed.flipped) {
        flippedTiles.push(tileId);
      }
      if (consumed.incomeAward) {
        incomeAwards.push(consumed.incomeAward);
      }
      sources.push({ kind: "tile", tileId, city: tile.city });
      continue;
    }

    const hasMarketCoal = nextState.market.coal.units > 0;
    const marketPrice = hasMarketCoal
      ? coalMarketPrice(nextState.market.coal.units)
      : nextState.market.coal.fallbackPrice;

    if (nextState.players[player].money < marketPrice) {
      return {
        ok: false,
        code: "INSUFFICIENT_RESOURCES",
        message: "Not enough money to source coal.",
      };
    }

    if (hasMarketCoal) {
      sources.push({ kind: "market", price: marketPrice });
    } else {
      sources.push({ kind: "fallback", price: marketPrice });
    }
    totalSpend += marketPrice;
    nextState = {
      ...nextState,
      market: {
        ...nextState.market,
        coal: {
          ...nextState.market.coal,
          units: hasMarketCoal ? nextState.market.coal.units - 1 : 0,
        },
      },
      players: {
        ...nextState.players,
        [player]: {
          ...nextState.players[player],
          money: nextState.players[player].money - marketPrice,
        },
      },
    };
  }

  return {
    ok: true,
    state: nextState,
    sources,
    spend: totalSpend,
    flippedTiles,
    incomeAwards,
  };
}

export function resolveIron(
  state: GameState,
  player: PlayerId,
  options: ResolveIronOptions,
): ResolveIronResult {
  if (options.requiredUnits <= 0) {
    return {
      ok: true,
      state,
      sources: [],
      spend: 0,
      flippedTiles: [],
      incomeAwards: [],
    };
  }
  let nextState = state;
  let totalSpend = 0;
  const sources: IronSource[] = [];
  const flippedTiles: string[] = [];
  const incomeAwards: IncomeAward[] = [];

  for (let i = 0; i < options.requiredUnits; i += 1) {
    const available = ironTiles(nextState);
    if (available.length > 0) {
      const [tileId, tile] = available[0];
      const consumed = applyTileResourceConsumption(nextState, tileId, 1);
      nextState = consumed.state;
      if (consumed.flipped) {
        flippedTiles.push(tileId);
      }
      if (consumed.incomeAward) {
        incomeAwards.push(consumed.incomeAward);
      }
      sources.push({ kind: "tile", tileId, city: tile.city });
      continue;
    }

    const hasMarketIron = nextState.market.iron.units > 0;
    const marketPrice = hasMarketIron
      ? ironMarketPrice(nextState.market.iron.units)
      : nextState.market.iron.fallbackPrice;
    if (nextState.players[player].money < marketPrice) {
      return {
        ok: false,
        code: "INSUFFICIENT_RESOURCES",
        message: "Not enough money to source iron.",
      };
    }
    sources.push(
      hasMarketIron
        ? { kind: "market", price: marketPrice }
        : { kind: "fallback", price: marketPrice },
    );
    totalSpend += marketPrice;
    nextState = {
      ...nextState,
      market: {
        ...nextState.market,
        iron: {
          ...nextState.market.iron,
          units: hasMarketIron ? nextState.market.iron.units - 1 : 0,
        },
      },
      players: {
        ...nextState.players,
        [player]: {
          ...nextState.players[player],
          money: nextState.players[player].money - marketPrice,
        },
      },
    };
  }

  return {
    ok: true,
    state: nextState,
    sources,
    spend: totalSpend,
    flippedTiles,
    incomeAwards,
  };
}

function hasCoalMarketAccess(state: GameState, city: CityId): boolean {
  return state.board.topology.ports.some((port) => areConnected(state, city, port));
}

function moveToMarket(
  state: GameState,
  tileId: string,
  maxUnits: number,
  canMove: boolean,
  kind: "coal" | "iron",
): MarketMoveResult {
  if (!canMove) {
    return { state, moved: 0, flipped: false, incomeDelta: 0 };
  }
  const tile = state.board.tiles[tileId];
  const availableCapacity = Math.max(0, maxUnits - state.market[kind].units);
  const moved = Math.min(tile.resourcesRemaining, availableCapacity);
  if (moved <= 0) {
    return { state, moved: 0, flipped: false, incomeDelta: 0 };
  }

  const consumed = applyTileResourceConsumption(state, tileId, moved);
  const incomeDelta = consumed.incomeAward?.amount ?? 0;
  const nextState = {
    ...consumed.state,
    market: {
      ...consumed.state.market,
      [kind]: {
        ...consumed.state.market[kind],
        units: consumed.state.market[kind].units + moved,
      },
    },
  };

  return {
    state: nextState,
    moved,
    flipped: consumed.flipped,
    incomeDelta,
  };
}

export function moveCoalToMarket(state: GameState, tileId: string): MarketMoveResult {
  const tile = state.board.tiles[tileId];
  return moveToMarket(
    state,
    tileId,
    MAX_COAL_MARKET_UNITS,
    hasCoalMarketAccess(state, tile.city),
    "coal",
  );
}

export function moveIronToMarket(state: GameState, tileId: string): MarketMoveResult {
  return moveToMarket(state, tileId, MAX_IRON_MARKET_UNITS, true, "iron");
}

import type { CardId, DeckState } from "./cards";
import type { CityId, Topology } from "./board/topology";

export type PlayerId = string;

export type EraKind = "canal" | "rail";
export type ResourceKind = "coal" | "iron";
export type IndustryKind = ResourceKind;
export type TileInvariantError = "INVALID_TILE_FLIP_STATE";
export type BuildCostSpec = {
  money: number;
  coalRequired: number;
  ironRequired: number;
};
export type ProductionSpec = {
  cubesProduced: number;
  incomeOnFlip: number;
};
export type IndustryLevelSpec = BuildCostSpec & ProductionSpec;

export type GameEvent = {
  idx: number;
  type: string;
  data?: unknown;
};

export type PlayerState = {
  id: PlayerId;
  money: number;
  income: number;
  hand: CardId[];
  vp: number;
};

export type LinkState = {
  builtBy?: PlayerId;
};

export type BoardState = {
  topology: Topology;
  linkStates: LinkState[];
  tiles: Record<string, TileState>;
};

export type TileState = {
  id: string;
  city: CityId;
  industry: IndustryKind;
  owner?: PlayerId;
  level: number;
  resourcesRemaining: number;
  incomeOnFlip: number;
  flipped: boolean;
};

export type MarketTrackState = {
  units: number;
  fallbackPrice: number;
};

export type MarketState = {
  coal: MarketTrackState;
  iron: MarketTrackState;
};

export type GameState = {
  id: string;
  seed: string;
  phase: EraKind;
  round: number;
  turn: number;
  actionsTakenThisTurn: number;
  seatOrder: PlayerId[];
  currentPlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  log: GameEvent[];
  deck: DeckState;
  market: MarketState;
  board: BoardState;
};

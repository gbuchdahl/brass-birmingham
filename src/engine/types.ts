import type { CardId, DeckState } from "./cards";
import type { Topology } from "./board/topology";

export type PlayerId = string;

export type EraKind = "canal" | "rail";

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
};

export type GameState = {
  id: string;
  seed: string;
  phase: EraKind;
  round: number;
  turn: number;
  seatOrder: PlayerId[];
  currentPlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  log: GameEvent[];
  deck: DeckState;
  board: BoardState;
};

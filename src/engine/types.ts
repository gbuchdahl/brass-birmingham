// Minimal types just for M1 (we'll expand later)

export type PlayerId = string;

export type Phase = "Canal"; // we'll add Setup/Rail/End later

export type GameEvent = {
  idx: number;
  type: string;
  data?: unknown;
};

export type PlayerState = {
  id: PlayerId;
  money: number;
  income: number;
  hand: string[]; // placeholder
  vp: number;
};

export type GameState = {
  id: string;
  seed: string;
  phase: Phase;
  round: number;
  turn: number; // absolute turn count
  seatOrder: PlayerId[]; // fixed order for now (M1)
  currentPlayer: PlayerId; // whose turn it is
  players: Record<PlayerId, PlayerState>;
  log: GameEvent[];
};

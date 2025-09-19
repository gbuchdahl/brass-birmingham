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

// --- Cards (minimal model) ---

export type CardId = string;

export type CardKind = "Location" | "Industry" | "Wild";

export type Card = {
  id: CardId;
  kind: CardKind;
  // For Location cards, tie to a CityId; for Industry cards, store a string for now.
  payload?: { city?: string; industry?: string };
};

export type DeckState = {
  draw: CardId[];
  discard: CardId[];
  removed: CardId[];
  byId: Record<CardId, Card>;
};

import type { PlayerId } from "./types";

// We'll add more actions later; for M1 we only need END_TURN.
export type EndTurn = { type: "END_TURN"; player: PlayerId };

export type Action = EndTurn;

import type { Action } from "./actions";
import type { GameState, PlayerId } from "./types";

export type LegalMove = Action;

export function getLegalMoves(_state: GameState, _player: PlayerId): LegalMove[] {
  return [];
}

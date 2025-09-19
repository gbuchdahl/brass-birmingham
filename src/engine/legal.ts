import type { Action } from "./actions";
import type { GameState } from "./state";

export type LegalMove = Action;

export function getLegalMoves(_state: GameState, _player: string): LegalMove[] {
  return [];
}

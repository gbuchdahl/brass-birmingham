import type { Action } from "./actions";
import type { GameState } from "./state";

export function reduce(state: GameState, action: Action): GameState {
  void action;
  return state;
}

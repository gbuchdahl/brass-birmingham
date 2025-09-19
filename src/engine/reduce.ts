import type { Action } from "./actions";
import type { GameState } from "./types";

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "END_TURN": {
      // This should also not be legal if the player hasn't made two actions, but we will cover that later.
      if (action.player !== state.currentPlayer) {
        // Ignore illegal end-turns for now; later we'll return a validation error.
        return state;
      }
      const order = state.seatOrder;
      const i = order.indexOf(state.currentPlayer);
      const next = order[(i + 1) % order.length];

      return {
        ...state,
        turn: state.turn + 1,
        currentPlayer: next,
        log: [
          ...state.log,
          {
            idx: state.log.length,
            type: "END_TURN",
            data: { from: action.player, to: next },
          },
        ],
      };
    }

    default:
      // Exhaustiveness guard (TS will flag if Action grows and we forget a case)
      const _never: never = action;
      return state;
  }
}

import type { Action } from "./actions";
import type { GameState } from "./types";
import { buildLink, isLegalLink } from "./board/api";

export type ReduceErrorCode =
  | "NOT_CURRENT_PLAYER"
  | "ILLEGAL_LINK_FOR_PHASE"
  | "UNKNOWN_ACTION";

export type ReduceError = {
  code: ReduceErrorCode;
  message: string;
};

export type ReduceResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: ReduceError };

function ok(state: GameState): ReduceResult {
  return { ok: true, state };
}

function withInvalidActionLog(
  state: GameState,
  action: Action,
  error: ReduceError,
): GameState {
  const nextEvent = {
    idx: state.log.length,
    type: "INVALID_ACTION",
    data: {
      code: error.code,
      message: error.message,
      player: action.player,
      action,
      context: {
        currentPlayer: state.currentPlayer,
        phase: state.phase,
      },
    },
  };

  return {
    ...state,
    log: [...state.log, nextEvent],
  };
}

function invalid(
  state: GameState,
  action: Action,
  code: ReduceErrorCode,
  message: string,
): ReduceResult {
  const error = { code, message };
  return {
    ok: false,
    state: withInvalidActionLog(state, action, error),
    error,
  };
}

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case "END_TURN": {
      // This should also not be legal if the player hasn't made two actions, but we will cover that later.
      if (action.player !== state.currentPlayer) {
        return invalid(
          state,
          action,
          "NOT_CURRENT_PLAYER",
          "Only the current player can end the turn.",
        );
      }
      const order = state.seatOrder;
      const i = order.indexOf(state.currentPlayer);
      const next = order[(i + 1) % order.length];

      return ok({
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
      });
    }
    case "BUILD_LINK": {
      if (action.player !== state.currentPlayer) {
        return invalid(
          state,
          action,
          "NOT_CURRENT_PLAYER",
          "Only the current player can build a link.",
        );
      }

      const era = state.phase;
      if (!isLegalLink(state, action.from, action.to, era)) {
        return invalid(
          state,
          action,
          "ILLEGAL_LINK_FOR_PHASE",
          "That link is not buildable in the current phase.",
        );
      }

      const nextState = buildLink(state, action.player, action.from, action.to, era);
      return ok({
        ...nextState,
        log: [
          ...nextState.log,
          {
            idx: nextState.log.length,
            type: "BUILD_LINK",
            data: { player: action.player, from: action.from, to: action.to, era },
          },
        ],
      });
    }

    default:
      // Exhaustiveness guard (TS will flag if Action grows and we forget a case)
      const _never: never = action;
      return invalid(state, action, "UNKNOWN_ACTION", `Unknown action: ${_never}`);
  }
}

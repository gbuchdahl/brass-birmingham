import type { Action } from "./actions";
import type { GameState, PlayerId } from "./types";
import { buildLink, isLegalPlayerLinkBuild } from "./board/api";
import { applyBuildIndustry } from "./rules/build";
import { assertAllTileInvariants } from "./rules/invariants";
import { resolveCoal } from "./rules/resources";

export type ReduceErrorCode =
  | "NOT_CURRENT_PLAYER"
  | "ACTIONS_REMAINING"
  | "TURN_ACTION_LIMIT_REACHED"
  | "ILLEGAL_LINK_FOR_PHASE"
  | "INSUFFICIENT_RESOURCES"
  | "CARD_NOT_IN_HAND"
  | "INVALID_BUILD_CARD"
  | "CARD_DOES_NOT_ALLOW_BUILD"
  | "BUILD_NOT_CONNECTED_FOR_CARD"
  | "INVALID_TILE_FLIP_STATE"
  | "ILLEGAL_INDUSTRY_BUILD"
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

function requiredActionsThisTurn(state: GameState): number {
  return state.round === 1 ? 1 : 2;
}

function incrementActionsTaken(state: GameState): GameState {
  return {
    ...state,
    actionsTakenThisTurn: state.actionsTakenThisTurn + 1,
  };
}

function advanceTurn(state: GameState, player: PlayerId, auto: boolean): GameState {
  const order = state.seatOrder;
  const i = order.indexOf(state.currentPlayer);
  const wrapped = i === order.length - 1;
  const next = order[(i + 1) % order.length];
  return {
    ...state,
    turn: state.turn + 1,
    round: wrapped ? state.round + 1 : state.round,
    actionsTakenThisTurn: 0,
    currentPlayer: next,
    log: [
      ...state.log,
      {
        idx: state.log.length,
        type: auto ? "AUTO_END_TURN" : "END_TURN",
        data: { from: player, to: next, round: state.round, actionsTaken: state.actionsTakenThisTurn },
      },
    ],
  };
}

function finalizeAction(state: GameState, player: PlayerId): GameState {
  const withActions = incrementActionsTaken(state);
  if (withActions.actionsTakenThisTurn >= requiredActionsThisTurn(withActions)) {
    return advanceTurn(withActions, player, true);
  }
  return withActions;
}

export function reduce(state: GameState, action: Action): ReduceResult {
  const entryInvariant = assertAllTileInvariants(state);
  if (entryInvariant) {
    return invalid(state, action, entryInvariant.code, entryInvariant.message);
  }

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
      if (state.actionsTakenThisTurn < requiredActionsThisTurn(state)) {
        return invalid(
          state,
          action,
          "ACTIONS_REMAINING",
          "This turn still has required actions remaining.",
        );
      }

      return ok(advanceTurn(state, action.player, false));
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

      if (state.actionsTakenThisTurn >= requiredActionsThisTurn(state)) {
        return invalid(
          state,
          action,
          "TURN_ACTION_LIMIT_REACHED",
          "This turn has already used all available actions.",
        );
      }

      const era = state.phase;
      if (!isLegalPlayerLinkBuild(state, action.player, action.from, action.to, era)) {
        return invalid(
          state,
          action,
          "ILLEGAL_LINK_FOR_PHASE",
          "That link is not buildable from your network in the current phase.",
        );
      }

      let baseState = state;
      let coalSource: "tile" | "market" | "fallback" | undefined;
      let coalSpend = 0;
      let flippedTiles: string[] = [];
      let incomeAwards: Array<{ tileId: string; player: PlayerId; amount: number }> =
        [];
      if (era === "rail") {
        const connectivityState = buildLink(
          state,
          action.player,
          action.from,
          action.to,
          "rail",
        );
        const coal = resolveCoal(state, action.player, {
          requiredUnits: 1,
          connectedTo: [action.from, action.to],
          connectivityState,
        });
        if (!coal.ok) {
          return invalid(state, action, "INSUFFICIENT_RESOURCES", coal.message);
        }
        baseState = coal.state;
        coalSource = coal.sources[0]?.kind;
        coalSpend = coal.spend;
        flippedTiles = coal.flippedTiles;
        incomeAwards = coal.incomeAwards;
      }

      const nextState = buildLink(baseState, action.player, action.from, action.to, era);
      const successState = {
        ...nextState,
        log: [
          ...nextState.log,
          {
            idx: nextState.log.length,
            type: "BUILD_LINK",
            data: {
              player: action.player,
              from: action.from,
              to: action.to,
              era,
              coalConsumed: era === "rail" ? 1 : 0,
              coalSource,
              coalSpend,
              flippedTiles,
              incomeAwards,
            },
          },
        ],
      };
      const exitInvariant = assertAllTileInvariants(successState);
      if (exitInvariant) {
        return invalid(successState, action, exitInvariant.code, exitInvariant.message);
      }
      return ok(finalizeAction(successState, action.player));
    }
    case "BUILD_INDUSTRY": {
      if (action.player !== state.currentPlayer) {
        return invalid(
          state,
          action,
          "NOT_CURRENT_PLAYER",
          "Only the current player can build an industry.",
        );
      }
      if (state.actionsTakenThisTurn >= requiredActionsThisTurn(state)) {
        return invalid(
          state,
          action,
          "TURN_ACTION_LIMIT_REACHED",
          "This turn has already used all available actions.",
        );
      }

      const built = applyBuildIndustry(state, action);
      if (!built.ok) {
        return invalid(state, action, built.code, built.message);
      }

      const successState = {
        ...built.state,
        log: [
          ...built.state.log,
          {
            idx: built.state.log.length,
            type: "BUILD_INDUSTRY",
            data: {
              player: action.player,
              city: action.city,
              industry: action.industry,
              level: action.level,
              cardId: built.cardId,
              cardKind: built.cardKind,
              discardedCardId: built.discardedCardId,
              tileId: built.tileId,
              marketMoved: built.marketMoved,
              resourcesRemaining: built.resourcesRemaining,
              flipped: built.flipped,
              incomeDelta: built.incomeDelta,
              buildCost: built.buildCost,
              resourceSpend: built.resourceSpend,
              resourceSources: built.resourceSources,
            },
          },
        ],
      };
      const exitInvariant = assertAllTileInvariants(successState);
      if (exitInvariant) {
        return invalid(successState, action, exitInvariant.code, exitInvariant.message);
      }
      return ok(finalizeAction(successState, action.player));
    }

    default:
      // Exhaustiveness guard (TS will flag if Action grows and we forget a case)
      const _never: never = action;
      return invalid(state, action, "UNKNOWN_ACTION", `Unknown action: ${_never}`);
  }
}

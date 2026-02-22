import { expect } from "vitest";
import type { GameState, ReduceResult } from "@/engine";
import type { Edge } from "@/engine/board/topology";

export function findEdgeOrThrow(
  state: GameState,
  predicate: (edge: Edge) => boolean,
  label: string,
): Edge {
  const edge = state.board.topology.edges.find(predicate);
  expect(edge, `Missing ${label} edge in test topology`).toBeDefined();
  return edge!;
}

export function expectOk(result: ReduceResult): GameState {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected ok result, got ${result.error.code}`);
  }
  return result.state;
}

export function expectInvalid(
  result: ReduceResult,
  previous: GameState,
  code:
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
    | "ILLEGAL_INDUSTRY_BUILD",
): GameState {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected invalid result");
  }
  expect(result.error.code).toBe(code);
  const next = result.state;
  expect(next).not.toBe(previous);
  expect(next.log).toHaveLength(previous.log.length + 1);
  expect(next.log[next.log.length - 1]).toMatchObject({
    type: "INVALID_ACTION",
    data: {
      code,
      message: result.error.message,
      context: {
        currentPlayer: previous.currentPlayer,
        phase: previous.phase,
      },
    },
  });
  return next;
}

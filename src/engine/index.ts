export type { GameState, PlayerId } from "./types";
export type { Action } from "./actions";
export type { ReduceError, ReduceErrorCode, ReduceResult } from "./reduce";
export { createGame } from "./state/create";
export { reduce } from "./reduce";
export { getLegalMoves, type LegalMove } from "./legal";

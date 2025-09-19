import type { GameState, PlayerId } from "../types";
import type { CityId, EraKind, Edge } from "./topology";

function edgeAllowsEra(edge: Edge, era: EraKind) {
  return edge.kind === era || edge.kind === "both";
}

function isMatchingEdge(edge: Edge, a: CityId, b: CityId) {
  return (
    (edge.a === a && edge.b === b) ||
    (edge.a === b && edge.b === a)
  );
}

function findEdgeIndex(
  state: GameState,
  a: CityId,
  b: CityId,
  era: EraKind,
): number {
  return state.board.topology.edges.findIndex(
    (edge) => edgeAllowsEra(edge, era) && isMatchingEdge(edge, a, b),
  );
}

export function isLegalLink(
  state: GameState,
  a: CityId,
  b: CityId,
  era: EraKind,
): boolean {
  const idx = findEdgeIndex(state, a, b, era);
  if (idx === -1) return false;
  return !state.board.linkStates[idx].builtBy;
}

export function buildLink(
  state: GameState,
  player: PlayerId,
  a: CityId,
  b: CityId,
  era: EraKind,
): GameState {
  const idx = findEdgeIndex(state, a, b, era);
  if (idx === -1) {
    throw new Error("Illegal link for this era");
  }
  if (state.board.linkStates[idx].builtBy) {
    throw new Error("Link already built");
  }
  const linkStates = state.board.linkStates.slice();
  linkStates[idx] = { builtBy: player };
  return {
    ...state,
    board: {
      ...state.board,
      linkStates,
    },
  };
}

export function areConnected(state: GameState, from: CityId, to: CityId): boolean {
  if (from === to) return true;
  const visited = new Set<CityId>();
  const queue: CityId[] = [from];
  while (queue.length > 0) {
    const city = queue.shift()!;
    if (visited.has(city)) continue;
    visited.add(city);
    for (const [idx, edge] of state.board.topology.edges.entries()) {
      if (!state.board.linkStates[idx].builtBy) continue;

      const neighbor = edge.a === city ? edge.b : edge.b === city ? edge.a : null;
      if (!neighbor) continue;
      if (neighbor === to) return true;
      queue.push(neighbor);
    }
  }
  return false;
}

export function listBuildableLinks(state: GameState, era: EraKind) {
  return state.board.topology.edges.flatMap((edge, index) => {
    if (!edgeAllowsEra(edge, era)) return [];
    if (state.board.linkStates[index].builtBy) return [];
    return [{ edge, index }];
  });
}

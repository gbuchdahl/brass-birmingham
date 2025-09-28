import type { GameState, PlayerId } from "../types";
import type { EraKind, Edge, NodeId } from "./topology";

function edgeAllowsEra(edge: Edge, era: EraKind) {
  return edge.kind === era || edge.kind === "both";
}

function edgeMatches(edge: Edge, a: NodeId, b: NodeId) {
  const [first, second] = edge.nodes;
  return (
    (first === a && second === b) ||
    (first === b && second === a)
  );
}

function findEdgeIndex(
  state: GameState,
  a: NodeId,
  b: NodeId,
  era: EraKind,
): number {
  return state.board.topology.edges.findIndex(
    (edge) => edgeAllowsEra(edge, era) && edgeMatches(edge, a, b),
  );
}

export function isLegalLink(
  state: GameState,
  a: NodeId,
  b: NodeId,
  era: EraKind,
): boolean {
  const idx = findEdgeIndex(state, a, b, era);
  if (idx === -1) return false;
  return !state.board.linkStates[idx].builtBy;
}

export function buildLink(
  state: GameState,
  player: PlayerId,
  a: NodeId,
  b: NodeId,
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

export function areConnected(state: GameState, from: NodeId, to: NodeId): boolean {
  if (from === to) return true;
  const visited = new Set<NodeId>();
  const queue: NodeId[] = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const [idx, edge] of state.board.topology.edges.entries()) {
      if (!state.board.linkStates[idx].builtBy) continue;

      const [first, second] = edge.nodes;
      const neighbor = first === node ? second : second === node ? first : null;
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

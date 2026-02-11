import type { Action } from "./actions";
import type { GameState, PlayerId } from "./types";
import { listBuildableLinks } from "./board/api";

export type LegalMove = Action;

export function getLegalMoves(state: GameState, player: PlayerId): LegalMove[] {
  if (player !== state.currentPlayer) {
    return [];
  }

  const era = state.phase;
  return listBuildableLinks(state, era).map(({ edge }) => {
    const [from, to] = edge.nodes;
    return {
      type: "BUILD_LINK",
      player,
      from,
      to,
    };
  });
}

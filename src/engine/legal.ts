import type { Action } from "./actions";
import type { GameState, PlayerId } from "./types";
import { isLegalPlayerLinkBuild, listBuildableLinks } from "./board/api";

export type LegalMove = Action;

export function getLegalMoves(state: GameState, player: PlayerId): LegalMove[] {
  if (player !== state.currentPlayer) {
    return [];
  }

  const era = state.phase;
  return listBuildableLinks(state, era).flatMap(({ edge }) => {
    const [from, to] = edge.nodes;
    if (!isLegalPlayerLinkBuild(state, player, from, to, era)) {
      return [];
    }
    return {
      type: "BUILD_LINK",
      player,
      from,
      to,
    };
  });
}

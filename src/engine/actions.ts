import type { PlayerId } from "./types";
import type { NodeId } from "./board/topology";

export type EndTurn = { type: "END_TURN"; player: PlayerId };
export type BuildLink = {
  type: "BUILD_LINK";
  player: PlayerId;
  from: NodeId;
  to: NodeId;
};

export type Action = EndTurn | BuildLink;

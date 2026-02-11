import type { CityId, NodeId } from "./board/topology";
import type { IndustryKind, PlayerId } from "./types";

export type EndTurn = { type: "END_TURN"; player: PlayerId };
export type BuildLink = {
  type: "BUILD_LINK";
  player: PlayerId;
  from: NodeId;
  to: NodeId;
};

export type BuildIndustry = {
  type: "BUILD_INDUSTRY";
  player: PlayerId;
  city: CityId;
  industry: IndustryKind;
  level: number;
};

export type Action = EndTurn | BuildLink | BuildIndustry;

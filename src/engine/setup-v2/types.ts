import type { RulesPhysicalCardId } from "../rules/generated/cards";

export const CANAL_SETUP_SCHEMA_VERSION = 1 as const;

export type SeatId = string;
export type SupportedPlayerCount = 2 | 3 | 4;

export type CanalSetupResult = {
  schemaVersion: typeof CANAL_SETUP_SCHEMA_VERSION;
  ruleset: {
    id: string;
    version: string;
  };
  era: "canal";
  seed: string;
  seats: SeatId[];
  hands: Record<SeatId, RulesPhysicalCardId[]>;
  draw: RulesPhysicalCardId[];
  /**
   * During initial setup, discard[i] is the face-down card assigned to
   * seats[i]. Subsequent engine phases may append played cards to this pile.
   */
  discard: RulesPhysicalCardId[];
  wildSupplies: {
    location: number;
    industry: number;
  };
};

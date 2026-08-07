import type { RulesPhysicalCardId } from "../rules/generated/cards";

export const WILD_LOCATION_CARD_ID = "wild-location" as const;
export const WILD_INDUSTRY_CARD_ID = "wild-industry" as const;

export type WildCardId =
  | typeof WILD_LOCATION_CARD_ID
  | typeof WILD_INDUSTRY_CARD_ID;
export type PlayableCardId = RulesPhysicalCardId | WildCardId;

export type CardZones = {
  hands: Record<string, PlayableCardId[]>;
  draw: RulesPhysicalCardId[];
  discard: RulesPhysicalCardId[];
  wildSupplies: {
    location: number;
    industry: number;
  };
};

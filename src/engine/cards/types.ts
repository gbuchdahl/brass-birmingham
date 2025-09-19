export type CardId = string;

export type CardKind = "Location" | "Industry" | "Wild";

export type Card = {
  id: CardId;
  kind: CardKind;
  payload?: {
    city?: string;
    industry?: string;
  };
};

export type DeckState = {
  draw: CardId[];
  discard: CardId[];
  removed: CardId[];
  byId: Record<CardId, Card>;
};

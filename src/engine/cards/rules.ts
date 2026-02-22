import type { GameState, PlayerId } from "../types";
import type { Card, CardId } from "./types";

export function canPlayCard(_state: GameState, _player: PlayerId, _cardId: CardId): boolean {
  return true;
}

export function describeCard(card?: Card): string {
  if (!card) {
    return "Unknown card";
  }
  switch (card.kind) {
    case "Location":
      return `Location: ${card.payload?.city ?? "Unknown"}`;
    case "Industry":
      return `Industry: ${card.payload?.industry ?? "Unknown"}`;
    case "Wild":
      return "Wild";
    default:
      return card.id;
  }
}

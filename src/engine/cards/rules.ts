import type { GameState, PlayerId } from "../types";
import type { CardId } from "./types";

export function canPlayCard(_state: GameState, _player: PlayerId, _cardId: CardId): boolean {
  return true;
}

export function describeCard(_cardId: CardId): string {
  return "Unknown card";
}

import type { DeckState, PlayerId } from "../types";
import { drawCards } from "./deck";

export function dealToPlayers(
  deck: DeckState,
  seats: PlayerId[],
  handSize: number,
): { deck: DeckState; hands: Record<PlayerId, string[]> } {
  const hands: Record<PlayerId, string[]> = {};
  let d = deck;
  for (const p of seats) {
    const { ids, deck: nd } = drawCards(d, handSize);
    hands[p] = ids;
    d = nd;
  }
  return { deck: d, hands };
}

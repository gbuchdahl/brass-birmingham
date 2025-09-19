import type { DeckState } from "./types";
import type { PlayerId } from "../types";
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

export function addToHand(
  hands: Record<PlayerId, string[]>,
  player: PlayerId,
  cardIds: string[],
): Record<PlayerId, string[]> {
  return {
    ...hands,
    [player]: [...(hands[player] ?? []), ...cardIds],
  };
}

export function removeFromHand(
  hands: Record<PlayerId, string[]>,
  player: PlayerId,
  cardIds: string[],
): Record<PlayerId, string[]> {
  const removeSet = new Set(cardIds);
  return {
    ...hands,
    [player]: (hands[player] ?? []).filter((id) => !removeSet.has(id)),
  };
}

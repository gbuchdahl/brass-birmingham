import type { CardId, DeckState } from "./types";
import type { PlayerId } from "../types";
import { drawCards } from "./deck";

export function dealToPlayers(
  deck: DeckState,
  seats: PlayerId[],
  handSize: number,
): { deck: DeckState; hands: Record<PlayerId, CardId[]> } {
  const hands: Record<PlayerId, CardId[]> = {};
  let d = deck;
  for (const p of seats) {
    const { ids, deck: nd } = drawCards(d, handSize);
    hands[p] = ids;
    d = nd;
  }
  return { deck: d, hands };
}

export function addToHand(
  hands: Record<PlayerId, CardId[]>,
  player: PlayerId,
  cardIds: CardId[],
): Record<PlayerId, CardId[]> {
  return {
    ...hands,
    [player]: [...(hands[player] ?? []), ...cardIds],
  };
}

export function removeFromHand(
  hands: Record<PlayerId, CardId[]>,
  player: PlayerId,
  cardIds: CardId[],
): Record<PlayerId, CardId[]> {
  const removeSet = new Set(cardIds);
  return {
    ...hands,
    [player]: (hands[player] ?? []).filter((id) => !removeSet.has(id)),
  };
}

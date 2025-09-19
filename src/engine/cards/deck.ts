import type { Card, CardId, DeckState } from "./types";
import { shuffleInPlace } from "../util/rng";

const templateCards: Array<Omit<Card, "id">> = [
  { kind: "Location", payload: { city: "Birmingham" } },
  { kind: "Location", payload: { city: "Coventry" } },
  { kind: "Industry", payload: { industry: "Coal" } },
  { kind: "Industry", payload: { industry: "Iron" } },
  { kind: "Wild" },
  { kind: "Wild" },
];

const TEMPLATE_REPETITIONS = 6; // 6 * 6 = 36 cards, enough for 4 players * 8 cards

function baseCards(): Card[] {
  const cards: Card[] = [];
  let c = 0;
  for (let rep = 0; rep < TEMPLATE_REPETITIONS; rep += 1) {
    for (const card of templateCards) {
      cards.push({ id: `c${c++}`, ...card });
    }
  }
  return cards;
}

export function buildDeck(seed: string): DeckState {
  const cards = baseCards();
  const byId: Record<CardId, Card> = {};
  for (const card of cards) {
    byId[card.id] = card;
  }

  const draw = cards.map((c) => c.id);
  shuffleInPlace(draw, seed); // deterministic

  return { draw, discard: [], removed: [], byId };
}

export function drawCards(
  deck: DeckState,
  n: number,
): { ids: CardId[]; deck: DeckState } {
  const ids = deck.draw.slice(0, n);
  const rest = deck.draw.slice(n);
  return { ids, deck: { ...deck, draw: rest } };
}

export function discardCards(deck: DeckState, ids: CardId[]): DeckState {
  return {
    ...deck,
    discard: [...deck.discard, ...ids],
  };
}

export function removeCards(deck: DeckState, ids: CardId[]): DeckState {
  return {
    ...deck,
    removed: [...deck.removed, ...ids],
  };
}

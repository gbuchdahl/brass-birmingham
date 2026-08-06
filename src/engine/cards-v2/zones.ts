import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type CardZones,
  type PlayableCardId,
  type WildCardId,
} from "./types";

function requireHand(zones: CardZones, seat: string): PlayableCardId[] {
  if (!Object.hasOwn(zones.hands, seat)) {
    throw new Error(`Unknown seat: ${seat}`);
  }
  return zones.hands[seat];
}

function removeCardOnce(
  hand: readonly PlayableCardId[],
  cardId: PlayableCardId,
): PlayableCardId[] {
  const index = hand.indexOf(cardId);
  if (index === -1) {
    throw new Error(`Card is not in hand: ${cardId}`);
  }
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

function isWildCard(cardId: PlayableCardId): cardId is WildCardId {
  return cardId === WILD_LOCATION_CARD_ID || cardId === WILD_INDUSTRY_CARD_ID;
}

/** Regular cards enter the discard pile; Wild cards return to their supply. */
export function discardActionCard(
  zones: CardZones,
  seat: string,
  cardId: PlayableCardId,
): CardZones {
  const nextHand = removeCardOnce(requireHand(zones, seat), cardId);
  const hands = { ...zones.hands, [seat]: nextHand };

  if (isWildCard(cardId)) {
    const supply = cardId === WILD_LOCATION_CARD_ID ? "location" : "industry";
    return {
      ...zones,
      hands,
      wildSupplies: {
        ...zones.wildSupplies,
        [supply]: zones.wildSupplies[supply] + 1,
      },
    };
  }

  return {
    ...zones,
    hands,
    discard: [...zones.discard, cardId],
  };
}

/** Refill happens once after all actions in a player's turn are complete. */
export function refillHand(
  zones: CardZones,
  seat: string,
  targetSize = 8,
): CardZones {
  const hand = requireHand(zones, seat);
  if (!Number.isSafeInteger(targetSize) || targetSize < 0) {
    throw new RangeError("Target hand size must be a non-negative integer");
  }
  if (hand.length > targetSize) {
    throw new Error(`Hand already exceeds target size for seat: ${seat}`);
  }

  const drawCount = Math.min(targetSize - hand.length, zones.draw.length);
  if (drawCount === 0) return zones;

  return {
    ...zones,
    hands: {
      ...zones.hands,
      [seat]: [...hand, ...zones.draw.slice(0, drawCount)],
    },
    draw: zones.draw.slice(drawCount),
  };
}

/**
 * Scout uses one action card plus two additional regular cards, then takes one
 * Wild Location and one Wild Industry card. A hand already containing either
 * Wild card cannot Scout.
 */
export function scout(
  zones: CardZones,
  seat: string,
  cardsToDiscard: readonly [PlayableCardId, PlayableCardId, PlayableCardId],
): CardZones {
  const hand = requireHand(zones, seat);
  if (hand.some(isWildCard)) {
    throw new Error("Cannot Scout while holding a Wild card");
  }
  if (new Set(cardsToDiscard).size !== cardsToDiscard.length) {
    throw new Error("Scout requires three distinct cards from hand");
  }
  if (cardsToDiscard.some(isWildCard)) {
    throw new Error("Scout discard cards must be regular cards");
  }
  for (const cardId of cardsToDiscard) {
    if (!hand.includes(cardId)) {
      throw new Error(`Card is not in hand: ${cardId}`);
    }
  }
  if (zones.wildSupplies.location < 1 || zones.wildSupplies.industry < 1) {
    throw new Error("Both Wild card supplies are required to Scout");
  }

  const discarded = cardsToDiscard.reduce(
    (current, cardId) => discardActionCard(current, seat, cardId),
    zones,
  );
  return {
    ...discarded,
    hands: {
      ...discarded.hands,
      [seat]: [
        ...discarded.hands[seat],
        WILD_LOCATION_CARD_ID,
        WILD_INDUSTRY_CARD_ID,
      ],
    },
    wildSupplies: {
      location: discarded.wildSupplies.location - 1,
      industry: discarded.wildSupplies.industry - 1,
    },
  };
}

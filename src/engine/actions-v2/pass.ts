import { discardActionCard } from "../cards-v2/zones";
import type { CardZones, PlayableCardId } from "../cards-v2/types";

export type PassActionState = {
  readonly seat: string;
  readonly cards: CardZones;
};

export type PassActionErrorCode = "UNKNOWN_SEAT" | "CARD_NOT_IN_HAND";

export type PassActionError = {
  readonly code: PassActionErrorCode;
  readonly message: string;
};

export type PassActionEffect = {
  readonly type: "PASSED";
  readonly seat: string;
  readonly discardedCardId: PlayableCardId;
  /** A Pass always uses exactly one of the turn's available actions. */
  readonly actionsConsumed: 1;
  /** Passing never contributes to round turn-order spending. */
  readonly moneySpent: 0;
};

export type PassActionResult =
  | {
      readonly ok: true;
      readonly state: PassActionState;
      readonly effect: PassActionEffect;
    }
  | {
      readonly ok: false;
      readonly state: PassActionState;
      readonly error: PassActionError;
    };

function reject(
  state: PassActionState,
  code: PassActionErrorCode,
  message: string,
): PassActionResult {
  return { ok: false, state, error: { code, message } };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Passes one action by consuming exactly one chosen card.
 *
 * The returned effect records the action-budget and round-spend consequences
 * for a parent reducer. Regular cards enter the discard pile, while Wild cards
 * return to their supplies through the shared card-zone semantics.
 */
export function passAction(
  state: PassActionState,
  cardId: PlayableCardId,
): PassActionResult {
  let cards: CardZones;
  try {
    cards = discardActionCard(state.cards, state.seat, cardId);
  } catch (error) {
    const message = messageFrom(error);
    return reject(
      state,
      message.startsWith("Unknown seat:") ? "UNKNOWN_SEAT" : "CARD_NOT_IN_HAND",
      message,
    );
  }

  return {
    ok: true,
    state: { ...state, cards },
    effect: {
      type: "PASSED",
      seat: state.seat,
      discardedCardId: cardId,
      actionsConsumed: 1,
      moneySpent: 0,
    },
  };
}

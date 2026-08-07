import { scout } from "../cards-v2/zones";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type CardZones,
  type PlayableCardId,
} from "../cards-v2/types";

export type ScoutActionState = {
  readonly seat: string;
  readonly cards: CardZones;
};

export type ScoutActionSelection = {
  readonly cardsToDiscard: readonly [
    PlayableCardId,
    PlayableCardId,
    PlayableCardId,
  ];
};

export type ScoutActionErrorCode =
  | "UNKNOWN_SEAT"
  | "WILD_ALREADY_IN_HAND"
  | "INVALID_SCOUT_DISCARD"
  | "CARD_NOT_IN_HAND"
  | "WILD_SUPPLY_EMPTY";

export type ScoutActionError = {
  readonly code: ScoutActionErrorCode;
  readonly message: string;
};

export type ScoutActionEffect = {
  readonly type: "SCOUTED";
  readonly seat: string;
  readonly discardedCardIds: readonly PlayableCardId[];
  readonly receivedCardIds: readonly [
    typeof WILD_LOCATION_CARD_ID,
    typeof WILD_INDUSTRY_CARD_ID,
  ];
  readonly actionsConsumed: 1;
  readonly moneySpent: 0;
};

export type ScoutActionResult =
  | {
      readonly ok: true;
      readonly state: ScoutActionState;
      readonly effect: ScoutActionEffect;
    }
  | {
      readonly ok: false;
      readonly state: ScoutActionState;
      readonly error: ScoutActionError;
    };

function errorCode(message: string): ScoutActionErrorCode {
  if (message.startsWith("Unknown seat:")) return "UNKNOWN_SEAT";
  if (message === "Cannot Scout while holding a Wild card") {
    return "WILD_ALREADY_IN_HAND";
  }
  if (message.startsWith("Card is not in hand:")) return "CARD_NOT_IN_HAND";
  if (message === "Both Wild card supplies are required to Scout") {
    return "WILD_SUPPLY_EMPTY";
  }
  return "INVALID_SCOUT_DISCARD";
}

/** Exchanges three regular cards for the two reusable Wild cards as one action. */
export function scoutAction(
  state: ScoutActionState,
  selection: ScoutActionSelection,
): ScoutActionResult {
  let cards: CardZones;
  try {
    cards = scout(state.cards, state.seat, selection.cardsToDiscard);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      state,
      error: { code: errorCode(message), message },
    };
  }

  return {
    ok: true,
    state: { ...state, cards },
    effect: {
      type: "SCOUTED",
      seat: state.seat,
      discardedCardIds: [...selection.cardsToDiscard],
      receivedCardIds: [WILD_LOCATION_CARD_ID, WILD_INDUSTRY_CARD_ID],
      actionsConsumed: 1,
      moneySpent: 0,
    },
  };
}

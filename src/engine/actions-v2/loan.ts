import { discardActionCard } from "../cards-v2/zones";
import type { CardZones, PlayableCardId } from "../cards-v2/types";
import { applyLoanToIncome, incomeLevelAt } from "../economy/income";

export type LoanActionState = {
  readonly seat: string;
  readonly player: {
    readonly money: number;
    readonly incomeMarkerSpace: number;
  };
  readonly cards: CardZones;
};

export type LoanActionErrorCode =
  | "INVALID_LOAN_STATE"
  | "LOAN_INCOME_FLOOR"
  | "UNKNOWN_SEAT"
  | "CARD_NOT_IN_HAND";

export type LoanActionError = {
  readonly code: LoanActionErrorCode;
  readonly message: string;
};

export type LoanActionEffect = {
  readonly type: "LOAN_TAKEN";
  readonly seat: string;
  readonly discardedCardId: PlayableCardId;
  readonly moneyReceived: number;
  /** A Loan always uses exactly one of the turn's available actions. */
  readonly actionsConsumed: 1;
  /** Loans do not contribute to round turn-order spending. */
  readonly moneySpent: 0;
  readonly income: {
    readonly fromMarkerSpace: number;
    readonly toMarkerSpace: number;
    readonly fromLevel: number;
    readonly toLevel: number;
  };
};

export type LoanActionResult =
  | {
      readonly ok: true;
      readonly state: LoanActionState;
      readonly effect: LoanActionEffect;
    }
  | {
      readonly ok: false;
      readonly state: LoanActionState;
      readonly error: LoanActionError;
    };

function reject(
  state: LoanActionState,
  code: LoanActionErrorCode,
  message: string,
): LoanActionResult {
  return { ok: false, state, error: { code, message } };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Takes one loan as an atomic, pure state transition.
 *
 * Validation is completed before the returned state is constructed. A
 * rejection returns the exact input state object, while a success records the
 * zero-cost effect a parent reducer should apply to its round spend ledger.
 */
export function takeLoan(
  state: LoanActionState,
  cardId: PlayableCardId,
): LoanActionResult {
  if (!Number.isSafeInteger(state.player.money) || state.player.money < 0) {
    return reject(
      state,
      "INVALID_LOAN_STATE",
      "Player money must be a non-negative safe integer.",
    );
  }
  let fromLevel: number;
  let loan: ReturnType<typeof applyLoanToIncome>;
  try {
    fromLevel = incomeLevelAt(state.player.incomeMarkerSpace);
    loan = applyLoanToIncome(state.player.incomeMarkerSpace);
  } catch (error) {
    const message = messageFrom(error);
    return reject(
      state,
      message === "A loan cannot lower income below level -10."
        ? "LOAN_INCOME_FLOOR"
        : "INVALID_LOAN_STATE",
      message,
    );
  }
  if (!Number.isSafeInteger(state.player.money + loan.moneyReceived)) {
    return reject(
      state,
      "INVALID_LOAN_STATE",
      "Loan proceeds would exceed the maximum safe money value.",
    );
  }

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
    state: {
      ...state,
      player: {
        ...state.player,
        money: state.player.money + loan.moneyReceived,
        incomeMarkerSpace: loan.markerSpace,
      },
      cards,
    },
    effect: {
      type: "LOAN_TAKEN",
      seat: state.seat,
      discardedCardId: cardId,
      moneyReceived: loan.moneyReceived,
      actionsConsumed: 1,
      moneySpent: 0,
      income: {
        fromMarkerSpace: state.player.incomeMarkerSpace,
        toMarkerSpace: loan.markerSpace,
        fromLevel,
        toLevel: loan.incomeLevel,
      },
    },
  };
}

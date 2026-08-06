import { describe, expect, it } from "vitest";
import { takeLoan, type LoanActionState } from "@/engine/actions-v2/loan";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "@/engine/cards-v2/types";
import {
  highestSpaceForIncomeLevel,
  incomeLevelAt,
} from "@/engine/economy/income";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

function loanState(
  incomeLevel = 11,
  seed = "loan-action",
): LoanActionState {
  const setup = createCanalSetup(["alice", "bob"], seed);
  return {
    seat: "alice",
    player: {
      money: 17,
      incomeMarkerSpace: highestSpaceForIncomeLevel(incomeLevel),
    },
    cards: {
      hands: setup.hands,
      draw: setup.draw,
      discard: setup.discard,
      wildSupplies: setup.wildSupplies,
    },
  };
}

function requireSuccess(
  result: ReturnType<typeof takeLoan>,
): Extract<ReturnType<typeof takeLoan>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Loan action", () => {
  it("moves three income levels to the highest space in a differently sized band", () => {
    const initial = loanState(11);
    expect(initial.player.incomeMarkerSpace).toBe(33);

    const result = requireSuccess(takeLoan(initial, initial.cards.hands.alice[0]));

    expect(result.state.player.incomeMarkerSpace).toBe(26);
    expect(incomeLevelAt(result.state.player.incomeMarkerSpace)).toBe(8);
    expect(result.effect.income).toEqual({
      fromMarkerSpace: 33,
      toMarkerSpace: 26,
      fromLevel: 11,
      toLevel: 8,
    });
  });

  it("permits a loan ending at -10 and rejects one that would cross the floor", () => {
    const legal = loanState(-7, "loan-floor-legal");
    const accepted = requireSuccess(takeLoan(legal, legal.cards.hands.alice[0]));
    expect(accepted.state.player.incomeMarkerSpace).toBe(
      highestSpaceForIncomeLevel(-10),
    );

    const illegal = loanState(-8, "loan-floor-illegal");
    const cardId = illegal.cards.hands.alice[0];
    const rejected = takeLoan(illegal, cardId);
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "LOAN_INCOME_FLOOR" },
    });
    expect(rejected.state).toBe(illegal);
    expect(illegal.cards.hands.alice).toContain(cardId);
    expect(illegal.player).toEqual({
      money: 17,
      incomeMarkerSpace: highestSpaceForIncomeLevel(-8),
    });
  });

  it("supports repeated loans until the next loan would cross the floor", () => {
    let state = loanState(3, "repeated-loans");

    for (const expectedLevel of [0, -3, -6, -9]) {
      const result = requireSuccess(takeLoan(state, state.cards.hands.alice[0]));
      state = result.state;
      expect(incomeLevelAt(state.player.incomeMarkerSpace)).toBe(expectedLevel);
    }

    expect(state.player.money).toBe(137);
    expect(state.cards.hands.alice).toHaveLength(4);
    const rejected = takeLoan(state, state.cards.hands.alice[0]);
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "LOAN_INCOME_FLOOR" },
    });
    expect(rejected.state).toBe(state);
  });

  it("discards a regular action card and reports exactly £30 with zero round spend", () => {
    const initial = loanState(11, "regular-loan-card");
    const cardId = initial.cards.hands.alice[0];
    const result = requireSuccess(takeLoan(initial, cardId));

    expect(result.state.player.money).toBe(47);
    expect(result.state.cards.hands.alice).toHaveLength(7);
    expect(result.state.cards.hands.alice).not.toContain(cardId);
    expect(result.state.cards.discard.at(-1)).toBe(cardId);
    expect(result.effect).toMatchObject({
      type: "LOAN_TAKEN",
      seat: "alice",
      discardedCardId: cardId,
      moneyReceived: 30,
      actionsConsumed: 1,
      moneySpent: 0,
    });
  });

  it.each([
    [WILD_LOCATION_CARD_ID, "location"],
    [WILD_INDUSTRY_CARD_ID, "industry"],
  ] as const)("returns %s to its supply instead of discarding it", (wild, supply) => {
    const initial = loanState(11, `wild-loan-${supply}`);
    const withWild: LoanActionState = {
      ...initial,
      cards: {
        ...initial.cards,
        hands: {
          ...initial.cards.hands,
          alice: [...initial.cards.hands.alice, wild],
        },
        wildSupplies: { ...initial.cards.wildSupplies, [supply]: 3 },
      },
    };

    const result = requireSuccess(takeLoan(withWild, wild));
    expect(result.state.cards.hands.alice).not.toContain(wild);
    expect(result.state.cards.wildSupplies[supply]).toBe(4);
    expect(result.state.cards.discard).toBe(withWild.cards.discard);
  });

  it("rejects a missing card without changing money, income, or card zones", () => {
    const initial = loanState(11, "missing-loan-card");
    const missing = WILD_LOCATION_CARD_ID;
    const snapshot = structuredClone(initial);

    const result = takeLoan(initial, missing);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(result.state).toBe(initial);
    expect(initial).toEqual(snapshot);
  });

  it("rejects malformed money and income atomically", () => {
    const initial = loanState(11, "invalid-loan-state");
    const cardId = initial.cards.hands.alice[0];
    const invalidStates: LoanActionState[] = [
      { ...initial, player: { ...initial.player, money: -1 } },
      {
        ...initial,
        player: {
          ...initial.player,
          money: Number.MAX_SAFE_INTEGER - 29,
        },
      },
      { ...initial, player: { ...initial.player, incomeMarkerSpace: 101 } },
    ];

    for (const invalid of invalidStates) {
      const result = takeLoan(invalid, cardId);
      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_LOAN_STATE" },
      });
      expect(result.state).toBe(invalid);
      expect(invalid.cards.hands.alice).toContain(cardId);
    }
  });

  it("does not mutate input state and produces JSON-only output", () => {
    const initial = loanState(11, "immutable-json-loan");
    const snapshot = structuredClone(initial);
    const cardId: PlayableCardId = initial.cards.hands.alice[0];

    const result = requireSuccess(takeLoan(initial, cardId));

    expect(initial).toEqual(snapshot);
    expect(result.state).not.toBe(initial);
    expect(result.state.player).not.toBe(initial.player);
    expect(result.state.cards).not.toBe(initial.cards);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("rejects a seat absent from the card zones without mutation", () => {
    const initial = loanState(11, "unknown-loan-seat");
    const unknownSeatState: LoanActionState = { ...initial, seat: "carol" };
    const result = takeLoan(unknownSeatState, initial.cards.hands.alice[0]);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(result.state).toBe(unknownSeatState);
  });
});

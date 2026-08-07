import { describe, expect, it } from "vitest";
import {
  scoutAction,
  type ScoutActionSelection,
  type ScoutActionState,
} from "@/engine/actions-v2/scout";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
} from "@/engine/cards-v2/types";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

function scoutState(seed = "scout-action"): ScoutActionState {
  const setup = createCanalSetup(["alice", "bob"], seed);
  return {
    seat: "alice",
    cards: {
      hands: setup.hands,
      draw: setup.draw,
      discard: setup.discard,
      wildSupplies: setup.wildSupplies,
    },
  };
}

function selection(state: ScoutActionState): ScoutActionSelection {
  const [first, second, third] = state.cards.hands.alice;
  return { cardsToDiscard: [first, second, third] };
}

function requireSuccess(
  result: ReturnType<typeof scoutAction>,
): Extract<ReturnType<typeof scoutAction>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Scout action", () => {
  it("exchanges exactly three regular cards for both Wild cards as one action", () => {
    const initial = scoutState("scout-success");
    const chosen = selection(initial);
    const result = requireSuccess(scoutAction(initial, chosen));

    expect(result.state.cards.hands.alice).toEqual([
      ...initial.cards.hands.alice.slice(3),
      WILD_LOCATION_CARD_ID,
      WILD_INDUSTRY_CARD_ID,
    ]);
    expect(result.state.cards.discard).toEqual([
      ...initial.cards.discard,
      ...chosen.cardsToDiscard,
    ]);
    expect(result.state.cards.wildSupplies).toEqual({ location: 3, industry: 3 });
    expect(result.effect).toEqual({
      type: "SCOUTED",
      seat: "alice",
      discardedCardIds: [...chosen.cardsToDiscard],
      receivedCardIds: [WILD_LOCATION_CARD_ID, WILD_INDUSTRY_CARD_ID],
      actionsConsumed: 1,
      moneySpent: 0,
    });
  });

  it("rejects Scout while either Wild card is already in hand", () => {
    for (const wild of [WILD_LOCATION_CARD_ID, WILD_INDUSTRY_CARD_ID] as const) {
      const initial = scoutState(`scout-holds-${wild}`);
      const invalid: ScoutActionState = {
        ...initial,
        cards: {
          ...initial.cards,
          hands: {
            ...initial.cards.hands,
            alice: [...initial.cards.hands.alice, wild],
          },
        },
      };
      const result = scoutAction(invalid, selection(invalid));
      expect(result).toMatchObject({
        ok: false,
        error: { code: "WILD_ALREADY_IN_HAND" },
      });
      expect(result.state).toBe(invalid);
    }
  });

  it("rejects duplicate or Wild discard selections atomically", () => {
    const initial = scoutState("scout-invalid-discards");
    const [first, second] = initial.cards.hands.alice;
    const withWild: ScoutActionState = {
      ...initial,
      cards: {
        ...initial.cards,
        hands: {
          ...initial.cards.hands,
          alice: [...initial.cards.hands.alice, WILD_LOCATION_CARD_ID],
        },
      },
    };

    const duplicate = scoutAction(initial, {
      cardsToDiscard: [first, first, second],
    });
    const wild = scoutAction(withWild, {
      cardsToDiscard: [first, second, WILD_LOCATION_CARD_ID],
    });

    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "INVALID_SCOUT_DISCARD" },
    });
    expect(duplicate.state).toBe(initial);
    expect(wild).toMatchObject({
      ok: false,
      error: { code: "WILD_ALREADY_IN_HAND" },
    });
    expect(wild.state).toBe(withWild);
  });

  it("rejects a missing card or unknown seat without changing state", () => {
    const initial = scoutState("scout-card-failures");
    const [first, second] = initial.cards.hands.alice;
    const missingCard = initial.cards.hands.bob[0];
    const missing = scoutAction(initial, {
      cardsToDiscard: [first, second, missingCard],
    });
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(missing.state).toBe(initial);

    const unknown: ScoutActionState = { ...initial, seat: "carol" };
    const unknownResult = scoutAction(unknown, selection(initial));
    expect(unknownResult).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(unknownResult.state).toBe(unknown);
  });

  it("requires one card in each Wild supply", () => {
    const initial = scoutState("scout-empty-supply");
    for (const wildSupplies of [
      { location: 0, industry: 4 },
      { location: 4, industry: 0 },
    ]) {
      const invalid: ScoutActionState = {
        ...initial,
        cards: { ...initial.cards, wildSupplies },
      };
      const result = scoutAction(invalid, selection(invalid));
      expect(result).toMatchObject({
        ok: false,
        error: { code: "WILD_SUPPLY_EMPTY" },
      });
      expect(result.state).toBe(invalid);
    }
  });

  it("is immutable and JSON-safe", () => {
    const initial = scoutState("scout-json");
    const snapshot = structuredClone(initial);
    const result = requireSuccess(scoutAction(initial, selection(initial)));

    expect(initial).toEqual(snapshot);
    expect(result.state).not.toBe(initial);
    expect(result.state.cards).not.toBe(initial.cards);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

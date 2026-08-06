import { describe, expect, it } from "vitest";
import { passAction, type PassActionState } from "@/engine/actions-v2/pass";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "@/engine/cards-v2/types";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";

function passState(seed = "pass-action"): PassActionState {
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

function requireSuccess(
  result: ReturnType<typeof passAction>,
): Extract<ReturnType<typeof passAction>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Pass action", () => {
  it("consumes exactly one chosen regular card and spends nothing", () => {
    const initial = passState("pass-regular-card");
    const cardId = initial.cards.hands.alice[3];
    const priorHand = initial.cards.hands.alice;
    const result = requireSuccess(passAction(initial, cardId));

    expect(result.state.cards.hands.alice).toEqual([
      ...priorHand.slice(0, 3),
      ...priorHand.slice(4),
    ]);
    expect(result.state.cards.hands.alice).toHaveLength(priorHand.length - 1);
    expect(result.state.cards.discard).toEqual([
      ...initial.cards.discard,
      cardId,
    ]);
    expect(result.state.cards.draw).toBe(initial.cards.draw);
    expect(result.state.cards.hands.bob).toBe(initial.cards.hands.bob);
    expect(result.effect).toEqual({
      type: "PASSED",
      seat: "alice",
      discardedCardId: cardId,
      actionsConsumed: 1,
      moneySpent: 0,
    });
  });

  it.each([
    [WILD_LOCATION_CARD_ID, "location"],
    [WILD_INDUSTRY_CARD_ID, "industry"],
  ] as const)("returns %s to its supply instead of discarding it", (wild, supply) => {
    const initial = passState(`pass-wild-${supply}`);
    const withWild: PassActionState = {
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

    const result = requireSuccess(passAction(withWild, wild));

    expect(result.state.cards.hands.alice).not.toContain(wild);
    expect(result.state.cards.wildSupplies[supply]).toBe(4);
    expect(result.state.cards.discard).toBe(withWild.cards.discard);
    expect(result.effect).toMatchObject({
      discardedCardId: wild,
      actionsConsumed: 1,
      moneySpent: 0,
    });
  });

  it("removes only one occurrence when the selected card is duplicated", () => {
    const initial = passState("pass-one-occurrence");
    const withDuplicateWild: PassActionState = {
      ...initial,
      cards: {
        ...initial.cards,
        hands: {
          ...initial.cards.hands,
          alice: [
            WILD_LOCATION_CARD_ID,
            WILD_LOCATION_CARD_ID,
            ...initial.cards.hands.alice,
          ],
        },
      },
    };

    const result = requireSuccess(
      passAction(withDuplicateWild, WILD_LOCATION_CARD_ID),
    );
    expect(
      result.state.cards.hands.alice.filter(
        (card) => card === WILD_LOCATION_CARD_ID,
      ),
    ).toHaveLength(1);
    expect(result.state.cards.hands.alice).toHaveLength(
      withDuplicateWild.cards.hands.alice.length - 1,
    );
    expect(result.state.cards.wildSupplies.location).toBe(
      withDuplicateWild.cards.wildSupplies.location + 1,
    );
  });

  it("rejects a missing card atomically", () => {
    const initial = passState("pass-missing-card");
    const snapshot = structuredClone(initial);
    const result = passAction(initial, WILD_LOCATION_CARD_ID);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(result.state).toBe(initial);
    expect(initial).toEqual(snapshot);
  });

  it("rejects an unknown seat atomically", () => {
    const initial = passState("pass-unknown-seat");
    const invalid: PassActionState = { ...initial, seat: "carol" };
    const snapshot = structuredClone(invalid);
    const result = passAction(invalid, initial.cards.hands.alice[0]);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_SEAT" },
    });
    expect(result.state).toBe(invalid);
    expect(invalid).toEqual(snapshot);
  });

  it("rejects passing from an empty hand without fabricating an action effect", () => {
    const initial = passState("pass-empty-hand");
    const empty: PassActionState = {
      ...initial,
      cards: {
        ...initial.cards,
        hands: { ...initial.cards.hands, alice: [] },
      },
    };
    const cardId: PlayableCardId = initial.cards.hands.alice[0];
    const result = passAction(empty, cardId);

    expect(result).toEqual({
      ok: false,
      state: empty,
      error: {
        code: "CARD_NOT_IN_HAND",
        message: `Card is not in hand: ${cardId}`,
      },
    });
    expect("effect" in result).toBe(false);
  });

  it("does not mutate its input and produces JSON-only output", () => {
    const initial = passState("pass-immutable-json");
    const snapshot = structuredClone(initial);
    const cardId = initial.cards.hands.alice[0];
    const result = requireSuccess(passAction(initial, cardId));

    expect(initial).toEqual(snapshot);
    expect(result.state).not.toBe(initial);
    expect(result.state.cards).not.toBe(initial.cards);
    expect(result.state.cards.hands).not.toBe(initial.cards.hands);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

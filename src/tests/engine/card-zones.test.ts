import { describe, expect, it } from "vitest";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  createCanalSetup,
  discardActionCard,
  refillHand,
  scout,
  type CardZones,
} from "@/engine";

function zones(seed = "card-zones"): CardZones {
  const setup = createCanalSetup(["alice", "bob"], seed);
  return {
    hands: setup.hands,
    draw: setup.draw,
    discard: setup.discard,
    wildSupplies: setup.wildSupplies,
  };
}

describe("action card discard", () => {
  it("moves a regular card from hand to the top of discard", () => {
    const initial = zones();
    const cardId = initial.hands.alice[0];
    const next = discardActionCard(initial, "alice", cardId);

    expect(next.hands.alice).not.toContain(cardId);
    expect(next.hands.alice).toHaveLength(7);
    expect(next.discard.at(-1)).toBe(cardId);
    expect(next.draw).toBe(initial.draw);
    expect(initial.hands.alice).toHaveLength(8);
  });

  it("returns a Wild card to supply instead of discard", () => {
    const initial = zones();
    const withWild: CardZones = {
      ...initial,
      hands: {
        ...initial.hands,
        alice: [...initial.hands.alice, WILD_LOCATION_CARD_ID],
      },
      wildSupplies: { ...initial.wildSupplies, location: 3 },
    };
    const next = discardActionCard(withWild, "alice", WILD_LOCATION_CARD_ID);

    expect(next.hands.alice).not.toContain(WILD_LOCATION_CARD_ID);
    expect(next.wildSupplies.location).toBe(4);
    expect(next.discard).toBe(withWild.discard);
  });

  it("rejects unknown seats and cards without mutating zones", () => {
    const initial = zones();
    expect(() => discardActionCard(initial, "carol", initial.hands.alice[0])).toThrow(
      /Unknown seat/,
    );
    expect(() => discardActionCard(initial, "alice", WILD_INDUSTRY_CARD_ID)).toThrow(
      /not in hand/,
    );
    expect(initial.hands.alice).toHaveLength(8);
  });
});

describe("end-of-turn refill", () => {
  it("draws back to eight after all turn actions", () => {
    const initial = zones();
    const afterFirst = discardActionCard(initial, "alice", initial.hands.alice[0]);
    const afterSecond = discardActionCard(
      afterFirst,
      "alice",
      afterFirst.hands.alice[0],
    );
    const expectedDrawn = afterSecond.draw.slice(0, 2);
    const refilled = refillHand(afterSecond, "alice");

    expect(refilled.hands.alice).toHaveLength(8);
    expect(refilled.hands.alice.slice(-2)).toEqual(expectedDrawn);
    expect(refilled.draw).toEqual(afterSecond.draw.slice(2));
  });

  it("draws only what remains and returns identity when no draw is needed", () => {
    const initial = zones();
    expect(refillHand(initial, "alice")).toBe(initial);

    const short: CardZones = {
      ...initial,
      hands: { ...initial.hands, alice: initial.hands.alice.slice(0, 3) },
      draw: initial.draw.slice(0, 2),
    };
    const refilled = refillHand(short, "alice");
    expect(refilled.hands.alice).toHaveLength(5);
    expect(refilled.draw).toEqual([]);
  });

  it("rejects invalid target sizes and oversized hands", () => {
    const initial = zones();
    expect(() => refillHand(initial, "alice", -1)).toThrow(RangeError);
    expect(() => refillHand(initial, "alice", 7)).toThrow(/exceeds/);
  });
});

describe("Scout card exchange", () => {
  it("discards exactly three regular cards and takes both Wild cards", () => {
    const initial = zones("scout-success");
    const selected = initial.hands.alice.slice(0, 3) as [
      (typeof initial.hands.alice)[number],
      (typeof initial.hands.alice)[number],
      (typeof initial.hands.alice)[number],
    ];
    const next = scout(initial, "alice", selected);

    expect(next.discard.slice(-3)).toEqual(selected);
    expect(next.hands.alice).toHaveLength(7);
    expect(next.hands.alice.slice(-2)).toEqual([
      WILD_LOCATION_CARD_ID,
      WILD_INDUSTRY_CARD_ID,
    ]);
    expect(next.wildSupplies).toEqual({ location: 3, industry: 3 });
    expect(initial.hands.alice).toHaveLength(8);
  });

  it("rejects Scout while holding a Wild card", () => {
    const initial = zones("scout-has-wild");
    const withWild: CardZones = {
      ...initial,
      hands: {
        ...initial.hands,
        alice: [...initial.hands.alice, WILD_LOCATION_CARD_ID],
      },
    };
    expect(() =>
      scout(withWild, "alice", initial.hands.alice.slice(0, 3) as never),
    ).toThrow(/holding a Wild/);
  });

  it("rejects duplicate, missing, or unavailable cards atomically", () => {
    const initial = zones("scout-invalid");
    const [first, second] = initial.hands.alice;
    expect(() => scout(initial, "alice", [first, first, second])).toThrow(/distinct/);
    expect(() =>
      scout(initial, "alice", [first, second, WILD_LOCATION_CARD_ID]),
    ).toThrow(/regular cards/);
    expect(() =>
      scout(
        { ...initial, wildSupplies: { location: 0, industry: 4 } },
        "alice",
        initial.hands.alice.slice(0, 3) as never,
      ),
    ).toThrow(/supplies/);
    expect(initial.hands.alice).toHaveLength(8);
  });
});

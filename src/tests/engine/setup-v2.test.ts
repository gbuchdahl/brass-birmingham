import { describe, expect, it } from "vitest";
import { createCanalSetup } from "@/engine/setup-v2";
import {
  CARD_CATALOG,
  CARD_TEMPLATES,
  DRAW_DECK_SIZE_BY_PLAYER_COUNT,
  WILD_CARD_SUPPLY,
} from "@/engine/rules/generated/cards";
import { RULESET_META, SETUP_DATA } from "@/engine/rules/generated/ruleset";
import { shuffleInPlace } from "@/engine/util/rng";

const PLAYER_COUNTS = [2, 3, 4] as const;

function seats(playerCount: number): string[] {
  return Array.from({ length: playerCount }, (_, index) => `seat-${index + 1}`);
}

function regularCardIds(playerCount: 2 | 3 | 4): string[] {
  return CARD_CATALOG.filter((card) =>
    (card.includedAt as readonly number[]).includes(playerCount),
  ).map((card) => card.id);
}

function allRegularCards(setup: ReturnType<typeof createCanalSetup>): string[] {
  return [
    ...setup.seats.flatMap((seat) => setup.hands[seat]),
    ...setup.draw,
    ...setup.discard,
  ];
}

describe("deterministic Canal Era setup", () => {
  it.each(PLAYER_COUNTS)(
    "uses every regular physical card exactly once for %i players",
    (playerCount) => {
      const setup = createCanalSetup(seats(playerCount), "conservation-seed");
      const allCards = allRegularCards(setup);

      expect(allCards).toHaveLength(DRAW_DECK_SIZE_BY_PLAYER_COUNT[playerCount]);
      expect(new Set(allCards)).toHaveLength(allCards.length);
      expect([...allCards].sort()).toEqual([...regularCardIds(playerCount)].sort());
    },
  );

  it.each(PLAYER_COUNTS)(
    "deals exact hand, discard, and draw totals for %i players",
    (playerCount) => {
      const setup = createCanalSetup(seats(playerCount), "totals-seed");

      expect(setup.seats).toHaveLength(playerCount);
      for (const seat of setup.seats) {
        expect(setup.hands[seat]).toHaveLength(SETUP_DATA.shared.handSize);
      }
      expect(setup.discard).toHaveLength(
        playerCount * SETUP_DATA.shared.initialDiscardPerPlayer,
      );
      expect(setup.draw).toHaveLength(
        SETUP_DATA.playerCounts[playerCount].regularCards -
          playerCount *
            (SETUP_DATA.shared.handSize +
              SETUP_DATA.shared.initialDiscardPerPlayer),
      );
    },
  );

  it.each(PLAYER_COUNTS)(
    "preserves the exact template distribution for %i players",
    (playerCount) => {
      const setup = createCanalSetup(seats(playerCount), "distribution-seed");
      const allCards = new Set(allRegularCards(setup));

      for (const template of CARD_TEMPLATES) {
        expect(
          CARD_CATALOG.filter(
            (card) =>
              card.templateId === template.id && allCards.has(card.id),
          ),
        ).toHaveLength(template.copies[playerCount]);
      }
    },
  );

  it("deals in stable seat round-robin order before assigning discard cards", () => {
    const seatOrder = ["alice", "bob", "carol"];
    const seed = "round-robin-seed";
    const setup = createCanalSetup(seatOrder, seed);
    const shuffled = shuffleInPlace(regularCardIds(3), seed);

    for (let seatIndex = 0; seatIndex < seatOrder.length; seatIndex += 1) {
      expect(setup.hands[seatOrder[seatIndex]]).toEqual(
        Array.from(
          { length: SETUP_DATA.shared.handSize },
          (_, cardNumber) =>
            shuffled[cardNumber * seatOrder.length + seatIndex],
        ),
      );
    }

    const dealtCards = seatOrder.length * SETUP_DATA.shared.handSize;
    expect(setup.discard).toEqual(
      shuffled.slice(dealtCards, dealtCards + seatOrder.length),
    );
    expect(setup.draw).toEqual(shuffled.slice(dealtCards + seatOrder.length));
  });

  it("is repeatable for a seed and changes order for a different seed", () => {
    const seatOrder = ["alice", "bob", "carol", "dave"];
    const first = createCanalSetup(seatOrder, "same-seed");
    const repeated = createCanalSetup(seatOrder, "same-seed");
    const different = createCanalSetup(seatOrder, "different-seed");

    expect(repeated).toEqual(first);
    expect(allRegularCards(different)).not.toEqual(allRegularCards(first));
  });

  it.each([
    { invalidSeats: [] },
    { invalidSeats: ["only-one"] },
    { invalidSeats: ["a", "b", "c", "d", "e"] },
  ])("rejects unsupported seat counts: $invalidSeats", ({ invalidSeats }) => {
    expect(() => createCanalSetup(invalidSeats, "seed")).toThrow(/2–4/);
  });

  it.each([
    { invalidSeats: ["alice", "alice"] },
    { invalidSeats: ["alice", ""] },
    { invalidSeats: ["alice", "   "] },
  ])(
    "rejects duplicate or empty seat IDs: $invalidSeats",
    ({ invalidSeats }) => {
      expect(() => createCanalSetup(invalidSeats, "seed")).toThrow();
    },
  );

  it("does not mutate seat input or generated card data", () => {
    const seatOrder = Object.freeze(["alice", "bob"]);
    const catalogBefore = JSON.stringify(CARD_CATALOG);
    const setup = createCanalSetup(seatOrder, "immutable-seed");

    expect(seatOrder).toEqual(["alice", "bob"]);
    expect(setup.seats).not.toBe(seatOrder);
    expect(JSON.stringify(CARD_CATALOG)).toBe(catalogBefore);
  });

  it("keeps wild cards outside every regular card zone", () => {
    const setup = createCanalSetup(["alice", "bob", "carol", "dave"], "wild-seed");
    const regularCardIds = allRegularCards(setup);
    const regularCatalogIds = new Set(CARD_CATALOG.map((card) => card.id));

    expect(setup.wildSupplies).toEqual(WILD_CARD_SUPPLY);
    expect(regularCardIds.every((id) => regularCatalogIds.has(id as never))).toBe(
      true,
    );
    expect(regularCardIds.some((id) => id.startsWith("wild-"))).toBe(false);
  });

  it("returns versioned JSON-only setup data", () => {
    const setup = createCanalSetup(["__proto__", "constructor"], "json-seed");

    expect(setup).toMatchObject({
      schemaVersion: 1,
      ruleset: {
        id: RULESET_META.id,
        version: RULESET_META.version,
      },
      era: "canal",
      seed: "json-seed",
      seats: ["__proto__", "constructor"],
    });
    expect(JSON.parse(JSON.stringify(setup))).toEqual(setup);
    expect(setup.hands["__proto__"]).toHaveLength(8);
    expect(setup.hands.constructor).toHaveLength(8);
  });
});

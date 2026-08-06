import { describe, expect, it } from "vitest";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type CardZones,
} from "@/engine/cards-v2/types";
import {
  CARD_CATALOG,
  DRAW_DECK_SIZE_BY_PLAYER_COUNT,
  WILD_CARD_SUPPLY,
} from "@/engine/rules/generated/cards";
import { RULESET_META, SETUP_DATA } from "@/engine/rules/generated/ruleset";
import { createCanalSetup } from "@/engine/setup-v2/create-canal-setup";
import { createRailSetup } from "@/engine/setup-v2/create-rail-setup";

const PLAYER_COUNTS = [2, 3, 4] as const;

function seats(playerCount: number): string[] {
  return Array.from({ length: playerCount }, (_, index) => `seat-${index + 1}`);
}

function completedCanalZones(
  playerCount: 2 | 3 | 4,
  seed = "completed-canal",
): CardZones {
  const setup = createCanalSetup(seats(playerCount), seed);
  const regularCards = [
    ...setup.seats.flatMap((seat) => setup.hands[seat]),
    ...setup.draw,
    ...setup.discard,
  ];
  if (
    regularCards.some(
      (cardId) =>
        cardId === WILD_LOCATION_CARD_ID || cardId === WILD_INDUSTRY_CARD_ID,
    )
  ) {
    throw new Error("Canal setup unexpectedly contained a Wild card");
  }
  return {
    hands: Object.fromEntries(setup.seats.map((seat) => [seat, []])),
    draw: [],
    discard: regularCards as CardZones["discard"],
    wildSupplies: { ...setup.wildSupplies },
  };
}

function allRegularCards(setup: ReturnType<typeof createRailSetup>): string[] {
  return [
    ...setup.seats.flatMap((seat) => setup.hands[seat]),
    ...setup.draw,
    ...setup.discard,
  ];
}

describe("deterministic Rail Era setup", () => {
  it.each(PLAYER_COUNTS)(
    "redeals all eligible cards with no initial discard for %i players",
    (playerCount) => {
      const setup = createRailSetup(
        seats(playerCount),
        completedCanalZones(playerCount),
        "rail-redeal",
      );
      const cards = allRegularCards(setup);
      const expected = CARD_CATALOG.filter((card) =>
        (card.includedAt as readonly number[]).includes(playerCount),
      ).map((card) => card.id);

      expect(setup.discard).toEqual([]);
      expect(cards).toHaveLength(DRAW_DECK_SIZE_BY_PLAYER_COUNT[playerCount]);
      expect(new Set(cards)).toHaveLength(cards.length);
      expect([...cards].sort()).toEqual([...expected].sort());
      for (const seat of setup.seats) {
        expect(setup.hands[seat]).toHaveLength(SETUP_DATA.shared.handSize);
      }
      expect(setup.draw).toHaveLength(
        expected.length - playerCount * SETUP_DATA.shared.handSize,
      );
      expect(
        SETUP_DATA.playerCounts[playerCount].roundsPerEra *
          SETUP_DATA.eras.rail.firstRoundActions *
          playerCount,
      ).toBe(expected.length);
    },
  );

  it("collects regular and Wild cards from all zones before redealing", () => {
    const seatOrder = seats(2);
    const [alice, bob] = seatOrder;
    const zones = completedCanalZones(2, "mixed-zone-source");
    const first = zones.discard.shift();
    const second = zones.discard.shift();
    if (!first || !second) throw new Error("Expected regular cards");
    zones.hands[alice].push(first, WILD_LOCATION_CARD_ID);
    zones.hands[bob].push(second, WILD_INDUSTRY_CARD_ID);
    zones.wildSupplies = { location: 3, industry: 3 };

    const setup = createRailSetup(seatOrder, zones, "mixed-zone-rail");

    expect(setup.wildSupplies).toEqual(WILD_CARD_SUPPLY);
    expect(allRegularCards(setup)).toHaveLength(40);
    expect(allRegularCards(setup).some((card) => card.startsWith("wild-"))).toBe(
      false,
    );
  });

  it("is deterministic by seed and returns versioned JSON-only state", () => {
    const seatOrder = seats(3);
    const zones = completedCanalZones(3, "rail-determinism-source");
    const first = createRailSetup(seatOrder, zones, "same-rail-seed");
    const repeated = createRailSetup(seatOrder, zones, "same-rail-seed");
    const different = createRailSetup(seatOrder, zones, "different-rail-seed");

    expect(repeated).toEqual(first);
    expect(allRegularCards(different)).not.toEqual(allRegularCards(first));
    expect(first).toMatchObject({
      schemaVersion: 1,
      ruleset: { id: RULESET_META.id, version: RULESET_META.version },
      era: "rail",
      seats: seatOrder,
      seed: "same-rail-seed",
    });
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("rejects missing, duplicate, excluded, or unconserved cards", () => {
    const missing = completedCanalZones(2, "rail-missing");
    missing.discard.pop();
    expect(() => createRailSetup(seats(2), missing, "seed")).toThrow(
      /conserve every eligible regular card/,
    );

    const duplicate = completedCanalZones(2, "rail-duplicate");
    duplicate.discard[0] = duplicate.discard[1];
    expect(() => createRailSetup(seats(2), duplicate, "seed")).toThrow(
      /conserve every eligible regular card/,
    );

    const excluded = completedCanalZones(2, "rail-excluded");
    const excludedCard = CARD_CATALOG.find(
      (card) => !(card.includedAt as readonly number[]).includes(2),
    );
    if (!excludedCard) throw new Error("Expected a player-count-excluded card");
    excluded.discard[0] = excludedCard.id;
    expect(() => createRailSetup(seats(2), excluded, "seed")).toThrow(
      /not used at 2 players/,
    );

    const missingWild = completedCanalZones(2, "rail-missing-wild");
    missingWild.wildSupplies.location = 3;
    expect(() => createRailSetup(seats(2), missingWild, "seed")).toThrow(
      /conserve all Wild cards/,
    );
  });

  it("rejects mismatched seats and malformed setup inputs", () => {
    const zones = completedCanalZones(2, "rail-invalid-input");
    expect(() => createRailSetup(["alice"], zones, "seed")).toThrow(/2–4/);
    expect(() => createRailSetup(["a", "a"], zones, "seed")).toThrow(/unique/);
    expect(() => createRailSetup(["a", "b"], zones, "seed")).toThrow(
      /exactly the setup seats/,
    );
    expect(() => createRailSetup(seats(2), zones, 42 as never)).toThrow(
      TypeError,
    );
  });
});

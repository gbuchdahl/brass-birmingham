import { describe, expect, it } from "vitest";
import {
  CARD_CATALOG,
  CARD_DATA_PROVENANCE,
  CARD_TEMPLATES,
  DRAW_DECK_SIZE_BY_PLAYER_COUNT,
  WILD_CARD_SUPPLY,
} from "@/engine/rules/generated/cards";

const PLAYER_COUNTS = [2, 3, 4] as const;

const EXPECTED_COPIES = {
  "industry-brewery": { 2: 5, 3: 5, 4: 5 },
  "industry-coal-mine": { 2: 2, 3: 2, 4: 3 },
  "industry-iron-works": { 2: 4, 3: 4, 4: 4 },
  "industry-manufactured-goods-cotton-mill": { 2: 0, 3: 6, 4: 8 },
  "industry-pottery": { 2: 2, 3: 2, 4: 3 },
  "location-belper": { 2: 0, 3: 0, 4: 2 },
  "location-birmingham": { 2: 3, 3: 3, 4: 3 },
  "location-burton-on-trent": { 2: 2, 3: 2, 4: 2 },
  "location-cannock": { 2: 2, 3: 2, 4: 2 },
  "location-coalbrookdale": { 2: 3, 3: 3, 4: 3 },
  "location-coventry": { 2: 3, 3: 3, 4: 3 },
  "location-derby": { 2: 0, 3: 0, 4: 3 },
  "location-dudley": { 2: 2, 3: 2, 4: 2 },
  "location-kidderminster": { 2: 2, 3: 2, 4: 2 },
  "location-leek": { 2: 0, 3: 2, 4: 2 },
  "location-nuneaton": { 2: 1, 3: 1, 4: 1 },
  "location-redditch": { 2: 1, 3: 1, 4: 1 },
  "location-stafford": { 2: 2, 3: 2, 4: 2 },
  "location-stoke-on-trent": { 2: 0, 3: 3, 4: 3 },
  "location-stone": { 2: 0, 3: 2, 4: 2 },
  "location-tamworth": { 2: 1, 3: 1, 4: 1 },
  "location-uttoxeter": { 2: 0, 3: 1, 4: 2 },
  "location-walsall": { 2: 1, 3: 1, 4: 1 },
  "location-wolverhampton": { 2: 2, 3: 2, 4: 2 },
  "location-worcester": { 2: 2, 3: 2, 4: 2 },
} as const;

describe("generated card data", () => {
  it("records the exact physical card template distribution", () => {
    expect(
      Object.fromEntries(
        CARD_TEMPLATES.map((template) => [template.id, template.copies]),
      ),
    ).toEqual(EXPECTED_COPIES);
  });

  it.each(PLAYER_COUNTS)(
    "expands the exact %i-player draw deck",
    (playerCount) => {
      const deck = CARD_CATALOG.filter((card) =>
        (card.includedAt as readonly number[]).includes(playerCount),
      );

      expect(deck).toHaveLength(DRAW_DECK_SIZE_BY_PLAYER_COUNT[playerCount]);
      for (const template of CARD_TEMPLATES) {
        expect(
          deck.filter((card) => card.templateId === template.id),
        ).toHaveLength(template.copies[playerCount]);
      }
    },
  );

  it("uses unique stable IDs for all 64 physical cards", () => {
    expect(CARD_CATALOG).toHaveLength(64);
    expect(new Set(CARD_CATALOG.map((card) => card.id))).toHaveLength(64);

    for (const template of CARD_TEMPLATES) {
      const expectedIds = Array.from(
        { length: template.copies[4] },
        (_, index) => `${template.id}-${String(index + 1).padStart(2, "0")}`,
      );
      expect(
        CARD_CATALOG.filter((card) => card.templateId === template.id).map(
          (card) => card.id,
        ),
      ).toEqual(expectedIds);
    }
  });

  it("adds cards monotonically as the player count increases", () => {
    for (const template of CARD_TEMPLATES) {
      expect(template.copies[2]).toBeLessThanOrEqual(template.copies[3]);
      expect(template.copies[3]).toBeLessThanOrEqual(template.copies[4]);
    }

    for (const card of CARD_CATALOG) {
      const includedAt = card.includedAt as readonly number[];
      expect([[2, 3, 4], [3, 4], [4]]).toContainEqual(includedAt);
    }
  });

  it("models the manufactured-goods and cotton card as the sole multi-icon card", () => {
    const industryTemplates = CARD_TEMPLATES.filter(
      (template) => template.kind === "industry",
    );
    const multiIconTemplates = industryTemplates.filter(
      (template) => template.industries.length > 1,
    );

    expect(multiIconTemplates).toEqual([
      expect.objectContaining({
        id: "industry-manufactured-goods-cotton-mill",
        industries: ["manufactured", "cotton"],
      }),
    ]);
  });

  it("keeps the wild cards as a separate shared supply", () => {
    expect(WILD_CARD_SUPPLY).toEqual({ location: 4, industry: 4 });
    expect(CARD_CATALOG.every((card) => card.kind !== ("wild" as never))).toBe(
      true,
    );
  });

  it("retains source provenance with an explicit confidence level", () => {
    expect(CARD_DATA_PROVENANCE).toMatchObject({
      primaryRules: expect.stringMatching(/^https:\/\//),
      componentReference: expect.stringMatching(/^https:\/\//),
      confidence: "high",
    });
    expect(CARD_DATA_PROVENANCE.sourceNote).not.toHaveLength(0);
  });
});

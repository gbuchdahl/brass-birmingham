import { describe, expect, it } from "vitest";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import {
  MERCHANT_TILE_CATALOG,
  MERCHANT_TILE_COUNTS_BY_PLAYER_COUNT,
  MERCHANT_TILE_DATA_PROVENANCE,
} from "@/engine/rules/generated/merchant-tiles";
import { RULESET_META } from "@/engine/rules/generated/ruleset";
import { createMerchantSetup } from "@/engine/setup-v2/create-merchant-setup";

const PLAYER_COUNTS = [2, 3, 4] as const;

function face(tile: (typeof MERCHANT_TILE_CATALOG)[number]): string {
  if (tile.demandIndustries.length === 0) return "blank";
  if (tile.demandIndustries.length === 3) return "universal";
  return tile.demandIndustries[0];
}

describe("generated Merchant tile catalog", () => {
  it("contains the exact nine retail faces and player-count bands", () => {
    expect(MERCHANT_TILE_CATALOG).toHaveLength(9);
    expect(new Set(MERCHANT_TILE_CATALOG.map((tile) => tile.id))).toHaveLength(9);

    expect(
      Object.fromEntries(
        ["blank", "cotton_mill", "manufacturer", "pottery", "universal"].map(
          (faceId) => [
            faceId,
            MERCHANT_TILE_CATALOG.filter((tile) => face(tile) === faceId).length,
          ],
        ),
      ),
    ).toEqual({
      blank: 3,
      cotton_mill: 2,
      manufacturer: 2,
      pottery: 1,
      universal: 1,
    });

    expect(
      Object.fromEntries(
        PLAYER_COUNTS.map((playerCount) => [
          playerCount,
          MERCHANT_TILE_CATALOG.filter(
            (tile) => tile.minPlayers === playerCount,
          )
            .map(face)
            .sort(),
        ]),
      ),
    ).toEqual({
      2: ["blank", "blank", "cotton_mill", "manufacturer", "universal"],
      3: ["blank", "pottery"],
      4: ["cotton_mill", "manufacturer"],
    });
  });

  it("retains claim-level provenance without overstating band confidence", () => {
    const sourceIds = new Set(
      MERCHANT_TILE_DATA_PROVENANCE.sources.map((source) => source.id),
    );

    expect(sourceIds).toEqual(
      new Set(["official_rulebook", "retail_component_photo", "andre_implementation"]),
    );
    expect(
      MERCHANT_TILE_DATA_PROVENANCE.claims.face_catalog_and_distribution
        .confidence,
    ).toBe("high");
    expect(MERCHANT_TILE_DATA_PROVENANCE.claims.player_count_bands.confidence).toBe(
      "medium",
    );
    for (const claim of Object.values(MERCHANT_TILE_DATA_PROVENANCE.claims)) {
      expect(claim.sources.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
    }
  });
});

describe("deterministic Merchant setup", () => {
  it.each(PLAYER_COUNTS)(
    "places every eligible tile exactly once for %i players",
    (playerCount) => {
      const setup = createMerchantSetup(playerCount, "conservation-seed");
      const placedIds = setup.spaces.flatMap((space) =>
        space.tileId === null ? [] : [space.tileId],
      );
      const expectedIds = MERCHANT_TILE_CATALOG.filter(
        (tile) => tile.minPlayers <= playerCount,
      ).map((tile) => tile.id);

      expect(placedIds).toHaveLength(
        MERCHANT_TILE_COUNTS_BY_PLAYER_COUNT[playerCount],
      );
      expect(new Set(placedIds)).toHaveLength(placedIds.length);
      expect([...placedIds].sort()).toEqual([...expectedIds].sort());
    },
  );

  it.each(PLAYER_COUNTS)(
    "uses all and only the board's active Merchant spaces for %i players",
    (playerCount) => {
      const setup = createMerchantSetup(playerCount, "space-seed");
      const activeLocations = new Set<string>(
        BOARD_V2.playerCountRules[playerCount].merchantTileLocations,
      );
      const activeSpaces = setup.spaces.filter((space) => space.active);
      const inactiveSpaces = setup.spaces.filter((space) => !space.active);

      expect(setup.spaces).toHaveLength(BOARD_V2.counts.merchantSpaces);
      expect(activeSpaces).toHaveLength(
        BOARD_V2.playerCountRules[playerCount].activeMerchantSpaces,
      );
      expect(
        activeSpaces.every(
          (space) =>
            activeLocations.has(space.locationId) && space.tileId !== null,
        ),
      ).toBe(true);
      expect(
        inactiveSpaces.every(
          (space) =>
            !activeLocations.has(space.locationId) &&
            space.tileId === null &&
            space.demandIndustries.length === 0 &&
            space.beer === 0,
        ),
      ).toBe(true);
    },
  );

  it("leaves Warrington and Nottingham empty at two players", () => {
    const setup = createMerchantSetup(2, "two-player-seed");

    expect(
      setup.spaces.filter((space) =>
        ["merchant_warrington", "merchant_nottingham"].includes(space.locationId),
      ),
    ).toEqual([
      expect.objectContaining({ locationId: "merchant_warrington", active: false }),
      expect.objectContaining({ locationId: "merchant_warrington", active: false }),
      expect.objectContaining({ locationId: "merchant_nottingham", active: false }),
      expect.objectContaining({ locationId: "merchant_nottingham", active: false }),
    ]);
  });

  it.each(PLAYER_COUNTS)(
    "puts one beer on nonblank tiles and none on demand-blank tiles at %i players",
    (playerCount) => {
      const setup = createMerchantSetup(playerCount, "beer-seed");

      for (const space of setup.spaces) {
        if (!space.active || space.demandIndustries.length === 0) {
          expect(space.beer).toBe(0);
        } else {
          expect(space.beer).toBe(1);
        }
      }
      expect(setup.spaces.filter((space) => space.beer === 1)).toHaveLength(
        { 2: 3, 3: 4, 4: 6 }[playerCount],
      );
    },
  );

  it.each(PLAYER_COUNTS)(
    "conserves the complete nine-tile catalog for %i players",
    (playerCount) => {
      const setup = createMerchantSetup(playerCount, "returned-seed");
      const placedIds = setup.spaces.flatMap((space) =>
        space.tileId === null ? [] : [space.tileId],
      );
      const allIds = [...placedIds, ...setup.returnedToBox];

      expect(allIds).toHaveLength(MERCHANT_TILE_CATALOG.length);
      expect(new Set(allIds)).toHaveLength(MERCHANT_TILE_CATALOG.length);
      expect([...allIds].sort()).toEqual(
        MERCHANT_TILE_CATALOG.map((tile) => tile.id).sort(),
      );
    },
  );

  it("is repeatable for a seed and changes placement for another seed", () => {
    const first = createMerchantSetup(4, "same-seed");
    const repeated = createMerchantSetup(4, "same-seed");
    const different = createMerchantSetup(4, "different-seed");

    expect(repeated).toEqual(first);
    expect(different.spaces.map((space) => space.tileId)).not.toEqual(
      first.spaces.map((space) => space.tileId),
    );
  });

  it.each([1, 5, 2.5, Number.NaN])(
    "rejects unsupported player count %s",
    (playerCount) => {
      expect(() => createMerchantSetup(playerCount, "seed")).toThrow(/2–4/);
    },
  );

  it("rejects non-string seeds", () => {
    expect(() => createMerchantSetup(2, 42 as never)).toThrow(TypeError);
  });

  it("returns versioned JSON-only state without mutating generated inputs", () => {
    const boardBefore = JSON.stringify(BOARD_V2);
    const catalogBefore = JSON.stringify(MERCHANT_TILE_CATALOG);
    const setup = createMerchantSetup(3, "json-seed");

    expect(setup).toMatchObject({
      schemaVersion: 1,
      ruleset: { id: RULESET_META.id, version: RULESET_META.version },
      boardData: {
        schemaVersion: BOARD_V2.schemaVersion,
        rulesetId: BOARD_V2.rulesetId,
      },
      playerCount: 3,
      seed: "json-seed",
    });
    expect(JSON.parse(JSON.stringify(setup))).toEqual(setup);
    expect(JSON.stringify(BOARD_V2)).toBe(boardBefore);
    expect(JSON.stringify(MERCHANT_TILE_CATALOG)).toBe(catalogBefore);
  });
});

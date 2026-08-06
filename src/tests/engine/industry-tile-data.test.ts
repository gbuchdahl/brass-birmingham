import { describe, expect, it } from "vitest";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_EXPECTED_KIND_COUNTS,
  INDUSTRY_TILE_FACE_BY_ID,
  INDUSTRY_TILE_FACES,
  INDUSTRY_TILE_KIND_ORDER,
  INDUSTRY_TILE_METADATA,
  INDUSTRY_TILE_SOURCES,
  INDUSTRY_TILE_STACKS,
  INDUSTRY_TILES,
} from "@/engine/rules/generated/industry-tiles-v2";

const EXPECTED_FACE_VALUES = [
  // id, copies, money, coal cost, iron cost, beer to sell, income, VP, links,
  // era, coal output, iron output, Canal beer, Rail beer, developable
  ["manufacturer-1", 1, 8, 1, 0, 1, 5, 3, 2, "canal_only", 0, 0, 0, 0, true],
  ["manufacturer-2", 2, 10, 0, 1, 1, 0, 5, 1, "either", 0, 0, 0, 0, true],
  ["manufacturer-3", 1, 12, 2, 0, 0, 4, 4, 0, "either", 0, 0, 0, 0, true],
  ["manufacturer-4", 1, 14, 0, 1, 1, 6, 3, 1, "either", 0, 0, 0, 0, true],
  ["manufacturer-5", 2, 16, 1, 0, 2, 2, 8, 2, "either", 0, 0, 0, 0, true],
  ["manufacturer-6", 1, 20, 0, 0, 1, 6, 7, 1, "either", 0, 0, 0, 0, true],
  ["manufacturer-7", 1, 16, 1, 1, 0, 4, 9, 0, "either", 0, 0, 0, 0, true],
  ["manufacturer-8", 2, 20, 0, 2, 1, 1, 11, 1, "either", 0, 0, 0, 0, true],
  ["cotton-1", 3, 12, 0, 0, 1, 5, 5, 1, "canal_only", 0, 0, 0, 0, true],
  ["cotton-2", 2, 14, 1, 0, 1, 4, 5, 2, "either", 0, 0, 0, 0, true],
  ["cotton-3", 3, 16, 1, 1, 1, 3, 9, 1, "either", 0, 0, 0, 0, true],
  ["cotton-4", 3, 18, 1, 1, 1, 2, 12, 1, "either", 0, 0, 0, 0, true],
  ["brewery-1", 2, 5, 0, 1, 0, 4, 4, 2, "canal_only", 0, 0, 1, 2, true],
  ["brewery-2", 2, 7, 0, 1, 0, 5, 5, 2, "either", 0, 0, 1, 2, true],
  ["brewery-3", 2, 9, 0, 1, 0, 5, 7, 2, "either", 0, 0, 1, 2, true],
  ["brewery-4", 1, 9, 0, 1, 0, 5, 10, 2, "rail_only", 0, 0, 1, 2, true],
  ["coal-1", 1, 5, 0, 0, 0, 4, 1, 2, "canal_only", 2, 0, 0, 0, true],
  ["coal-2", 2, 7, 0, 0, 0, 7, 2, 1, "either", 3, 0, 0, 0, true],
  ["coal-3", 2, 8, 0, 1, 0, 6, 3, 1, "either", 4, 0, 0, 0, true],
  ["coal-4", 2, 10, 0, 1, 0, 5, 4, 1, "either", 5, 0, 0, 0, true],
  ["pottery-1", 1, 17, 0, 1, 1, 5, 10, 1, "either", 0, 0, 0, 0, false],
  ["pottery-2", 1, 0, 1, 0, 1, 1, 1, 1, "either", 0, 0, 0, 0, true],
  ["pottery-3", 1, 22, 2, 0, 2, 5, 11, 1, "either", 0, 0, 0, 0, false],
  ["pottery-4", 1, 0, 1, 0, 1, 1, 1, 1, "either", 0, 0, 0, 0, true],
  ["pottery-5", 1, 24, 2, 0, 2, 5, 20, 1, "rail_only", 0, 0, 0, 0, true],
  ["iron-1", 1, 5, 1, 0, 0, 3, 3, 1, "canal_only", 0, 4, 0, 0, true],
  ["iron-2", 1, 7, 1, 0, 0, 3, 5, 1, "either", 0, 4, 0, 0, true],
  ["iron-3", 1, 9, 1, 0, 0, 2, 7, 1, "either", 0, 5, 0, 0, true],
  ["iron-4", 1, 12, 1, 0, 0, 1, 9, 1, "either", 0, 6, 0, 0, true],
] as const;

describe("generated industry tile data", () => {
  it("locks every printed face value and copy count", () => {
    expect(
      INDUSTRY_TILE_FACES.map((face) => [
        face.faceId,
        face.copies,
        face.build.money,
        face.build.coal,
        face.build.iron,
        face.beerToSell,
        face.incomeSteps,
        face.victoryPoints,
        face.linkIcons,
        face.build.era,
        face.production.coal,
        face.production.iron,
        face.production.beer.canal,
        face.production.beer.rail,
        face.developable,
      ]),
    ).toEqual(EXPECTED_FACE_VALUES);
  });

  it("expands the exact 45-tile per-player manifest", () => {
    expect(INDUSTRY_TILE_METADATA.perPlayerTileCount).toBe(45);
    expect(INDUSTRY_TILES).toHaveLength(45);
    expect(new Set(INDUSTRY_TILES.map((tile) => tile.id))).toHaveLength(45);
    expect(Object.keys(INDUSTRY_TILE_BY_ID)).toHaveLength(45);

    expect(
      Object.fromEntries(
        INDUSTRY_TILE_KIND_ORDER.map((kind) => [
          kind,
          INDUSTRY_TILES.filter((tile) => tile.industry === kind).length,
        ]),
      ),
    ).toEqual(INDUSTRY_TILE_EXPECTED_KIND_COUNTS);
  });

  it("uses stable face and physical IDs in player-mat stack order", () => {
    expect(Object.keys(INDUSTRY_TILE_FACE_BY_ID)).toHaveLength(29);

    for (const face of INDUSTRY_TILE_FACES) {
      expect(face.faceId).toBe(`${face.industry}-${face.level}`);
      expect(face.stackOrder).toBe(face.level);
      expect(face.physicalIds).toEqual(
        Array.from(
          { length: face.copies },
          (_, index) => `${face.faceId}-${String.fromCharCode(97 + index)}`,
        ),
      );
      expect(
        face.physicalIds.map((physicalId) =>
          INDUSTRY_TILE_BY_ID[physicalId].faceId,
        ),
      ).toEqual(Array.from({ length: face.copies }, () => face.faceId));
    }

    for (const kind of INDUSTRY_TILE_KIND_ORDER) {
      const expectedIds = INDUSTRY_TILE_FACES.filter(
        (face) => face.industry === kind,
      ).flatMap((face) => face.physicalIds);
      expect(INDUSTRY_TILE_STACKS[kind].map((tile) => tile.id)).toEqual(
        expectedIds,
      );
      expect(
        INDUSTRY_TILE_STACKS[kind].map((tile) => tile.copyIndex),
      ).toEqual(
        INDUSTRY_TILE_FACES.filter((face) => face.industry === kind).flatMap(
          (face) => Array.from({ length: face.copies }, (_, index) => index),
        ),
      );
    }
  });

  it("models the era-specific brewery production rule", () => {
    for (const face of INDUSTRY_TILE_FACES.filter(
      (candidate) => candidate.industry === "brewery",
    )) {
      expect(face.production).toEqual({
        coal: 0,
        iron: 0,
        beer: { canal: 1, rail: 2 },
      });
    }
  });

  it("records all era restrictions and develop exceptions", () => {
    expect(
      INDUSTRY_TILE_FACES.filter(
        (face) => face.build.era === "canal_only",
      ).map((face) => face.faceId),
    ).toEqual([
      "manufacturer-1",
      "cotton-1",
      "brewery-1",
      "coal-1",
      "iron-1",
    ]);
    expect(
      INDUSTRY_TILE_FACES.filter(
        (face) => face.build.era === "rail_only",
      ).map((face) => face.faceId),
    ).toEqual(["brewery-4", "pottery-5"]);
    expect(
      INDUSTRY_TILE_FACES.filter((face) => !face.developable).map(
        (face) => face.faceId,
      ),
    ).toEqual(["pottery-1", "pottery-3"]);
    expect(INDUSTRY_TILE_FACE_BY_ID["pottery-1"].build.era).toBe("either");
  });

  it("keeps all engine-facing values within sensible bounds", () => {
    for (const face of INDUSTRY_TILE_FACES) {
      expect(face.build.money).toBeGreaterThanOrEqual(0);
      expect(face.build.money).toBeLessThanOrEqual(30);
      expect(face.build.coal).toBeGreaterThanOrEqual(0);
      expect(face.build.coal).toBeLessThanOrEqual(3);
      expect(face.build.iron).toBeGreaterThanOrEqual(0);
      expect(face.build.iron).toBeLessThanOrEqual(3);
      expect(face.beerToSell).toBeGreaterThanOrEqual(0);
      expect(face.beerToSell).toBeLessThanOrEqual(2);
      expect(face.incomeSteps).toBeGreaterThanOrEqual(0);
      expect(face.incomeSteps).toBeLessThanOrEqual(10);
      expect(face.victoryPoints).toBeGreaterThanOrEqual(0);
      expect(face.victoryPoints).toBeLessThanOrEqual(25);
      expect(face.linkIcons).toBeGreaterThanOrEqual(0);
      expect(face.linkIcons).toBeLessThanOrEqual(2);
    }
  });

  it("retains complete, resolved provenance for every face", () => {
    const unresolvedMarker = /\b(?:todo|tbd|unknown|placeholder)\b/i;
    expect(Object.keys(INDUSTRY_TILE_SOURCES).length).toBeGreaterThanOrEqual(2);

    for (const source of Object.values(INDUSTRY_TILE_SOURCES)) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.role).not.toMatch(unresolvedMarker);
    }
    for (const face of INDUSTRY_TILE_FACES) {
      expect(face.provenance.confidence).toBe("high");
      expect(face.provenance.valueSources.length).toBeGreaterThan(0);
      expect(face.provenance.crossChecks.length).toBeGreaterThan(0);
      for (const sourceId of [
        ...face.provenance.valueSources,
        ...face.provenance.crossChecks,
      ]) {
        expect(INDUSTRY_TILE_SOURCES[sourceId]).toBeDefined();
      }
      expect(JSON.stringify(face.provenance)).not.toMatch(unresolvedMarker);
    }
  });
});

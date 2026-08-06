import { describe, expect, it } from "vitest";
import {
  createIndustryInventory,
  developIndustryTiles,
  getLowestIndustryTileId,
  getNextBuildableIndustryTileId,
  removeBuiltIndustryTile,
  type IndustryInventory,
} from "@/engine/player-v2";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_KIND_ORDER,
  INDUSTRY_TILE_STACKS,
  INDUSTRY_TILES,
  type IndustryTileId,
  type IndustryTileKind,
} from "@/engine/rules/generated/industry-tiles-v2";

function expectSuccess<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected operation to succeed");
}

function expectFailure<T extends { ok: boolean }>(
  result: T,
  code: string,
): asserts result is T & { ok: false; error: { code: string } } {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected operation to fail");
  expect(
    (result as unknown as { error: { code: string } }).error.code,
  ).toBe(code);
}

function buildEarlierTiles(
  inventory: IndustryInventory,
  industry: IndustryTileKind,
  targetId: IndustryTileId,
): IndustryInventory {
  let current = inventory;
  for (const tile of INDUSTRY_TILE_STACKS[industry]) {
    if (tile.id === targetId) return current;
    const era = tile.build.era === "rail_only" ? "rail" : "canal";
    const result = removeBuiltIndustryTile(current, tile.id, era);
    expectSuccess(result);
    current = result.inventory;
  }
  throw new Error(`Target is not in ${industry} stack: ${targetId}`);
}

describe("player industry inventory", () => {
  it("initializes all 45 physical tiles in exact printed stack order", () => {
    const inventory = createIndustryInventory();

    expect(inventory).toEqual({
      schemaVersion: 1,
      stacks: Object.fromEntries(
        INDUSTRY_TILE_KIND_ORDER.map((industry) => [
          industry,
          INDUSTRY_TILE_STACKS[industry].map((tile) => tile.id),
        ]),
      ),
    });
    expect(Object.values(inventory.stacks).flat()).toHaveLength(45);
    expect(new Set(Object.values(inventory.stacks).flat())).toHaveLength(45);
    expect(JSON.parse(JSON.stringify(inventory))).toEqual(inventory);
  });

  it("queries the lowest and era-buildable tile without skipping a blocker", () => {
    let inventory = createIndustryInventory();

    for (const industry of INDUSTRY_TILE_KIND_ORDER) {
      expect(getLowestIndustryTileId(inventory, industry)).toBe(
        INDUSTRY_TILE_STACKS[industry][0].id,
      );
    }
    expect(getNextBuildableIndustryTileId(inventory, "manufacturer", "canal"))
      .toBe("manufacturer-1-a");
    expect(getNextBuildableIndustryTileId(inventory, "manufacturer", "rail"))
      .toBeUndefined();

    for (const tile of INDUSTRY_TILE_STACKS.pottery) {
      const expectedCanal = tile.build.era === "rail_only" ? undefined : tile.id;
      const expectedRail = tile.id;
      expect(getNextBuildableIndustryTileId(inventory, "pottery", "canal"))
        .toBe(expectedCanal);
      expect(getNextBuildableIndustryTileId(inventory, "pottery", "rail"))
        .toBe(expectedRail);
      const result = removeBuiltIndustryTile(
        inventory,
        tile.id,
        tile.build.era === "rail_only" ? "rail" : "canal",
      );
      expectSuccess(result);
      inventory = result.inventory;
    }
    expect(getLowestIndustryTileId(inventory, "pottery")).toBeUndefined();
    expect(getNextBuildableIndustryTileId(inventory, "pottery", "rail"))
      .toBeUndefined();
  });

  it("removes every physical tile from the top while preserving order and copies", () => {
    let inventory = createIndustryInventory();
    const removed: IndustryTileId[] = [];

    for (const industry of INDUSTRY_TILE_KIND_ORDER) {
      for (const tile of INDUSTRY_TILE_STACKS[industry]) {
        expect(getLowestIndustryTileId(inventory, industry)).toBe(tile.id);
        const result = removeBuiltIndustryTile(
          inventory,
          tile.id,
          tile.build.era === "rail_only" ? "rail" : "canal",
        );
        expectSuccess(result);
        expect(result.removedTileId).toBe(tile.id);
        expect(result.inventory).not.toBe(inventory);
        removed.push(result.removedTileId);
        inventory = result.inventory;
      }
    }

    expect(removed).toEqual(INDUSTRY_TILES.map((tile) => tile.id));
    expect(Object.values(inventory.stacks).flat()).toEqual([]);
    expect(removed.length + Object.values(inventory.stacks).flat().length)
      .toBe(45);
  });

  it("can Develop every developable physical tile when it is lowest", () => {
    for (const tile of INDUSTRY_TILES.filter((candidate) => candidate.developable)) {
      const inventory = buildEarlierTiles(
        createIndustryInventory(),
        tile.industry,
        tile.id,
      );
      const snapshot = structuredClone(inventory);
      const result = developIndustryTiles(inventory, [tile.id]);

      expectSuccess(result);
      expect(result.removedTileIds).toEqual([tile.id]);
      expect(result.ironUnitsRequired).toBe(1);
      expect(inventory).toEqual(snapshot);
      expect(getLowestIndustryTileId(result.inventory, tile.industry))
        .not.toBe(tile.id);
    }
  });

  it("Develops duplicate faces sequentially within the same industry", () => {
    const afterLevelOne = removeBuiltIndustryTile(
      createIndustryInventory(),
      "manufacturer-1-a",
      "canal",
    );
    expectSuccess(afterLevelOne);

    const result = developIndustryTiles(afterLevelOne.inventory, [
      "manufacturer-2-a",
      "manufacturer-2-b",
    ]);
    expectSuccess(result);
    expect(result).toMatchObject({
      removedTileIds: ["manufacturer-2-a", "manufacturer-2-b"],
      ironUnitsRequired: 2,
    });
    expect(getLowestIndustryTileId(result.inventory, "manufacturer"))
      .toBe("manufacturer-3-a");
  });

  it("does not allow Develop to remove protected pottery faces", () => {
    const initial = createIndustryInventory();
    const potteryOne = developIndustryTiles(initial, ["pottery-1-a"]);
    expectFailure(potteryOne, "TILE_NOT_DEVELOPABLE");
    expect(potteryOne.inventory).toBe(initial);

    const afterPotteryOne = removeBuiltIndustryTile(
      initial,
      "pottery-1-a",
      "canal",
    );
    expectSuccess(afterPotteryOne);
    const snapshot = structuredClone(afterPotteryOne.inventory);
    const crossesProtectedFace = developIndustryTiles(afterPotteryOne.inventory, [
      "pottery-2-a",
      "pottery-3-a",
    ]);
    expectFailure(crossesProtectedFace, "TILE_NOT_DEVELOPABLE");
    expect(crossesProtectedFace.error.selectionIndex).toBe(1);
    expect(crossesProtectedFace.inventory).toBe(afterPotteryOne.inventory);
    expect(crossesProtectedFace.inventory).toEqual(snapshot);

    const afterPotteryTwo = developIndustryTiles(afterPotteryOne.inventory, [
      "pottery-2-a",
    ]);
    expectSuccess(afterPotteryTwo);
    const potteryThree = developIndustryTiles(afterPotteryTwo.inventory, [
      "pottery-3-a",
    ]);
    expectFailure(potteryThree, "TILE_NOT_DEVELOPABLE");
  });

  it("rejects invalid counts, unknown, unavailable, non-top, and era-invalid tiles atomically", () => {
    const initial = createIndustryInventory();
    const snapshot = structuredClone(initial);

    for (const selections of [[], ["coal-1-a", "iron-1-a", "cotton-1-a"]]) {
      const result = developIndustryTiles(initial, selections);
      expectFailure(result, "INVALID_DEVELOP_COUNT");
      expect(result.inventory).toBe(initial);
    }

    const unknown = developIndustryTiles(initial, ["not-a-tile"]);
    expectFailure(unknown, "UNKNOWN_TILE");
    expect(unknown.inventory).toBe(initial);

    const nonTop = removeBuiltIndustryTile(initial, "manufacturer-2-a", "canal");
    expectFailure(nonTop, "TILE_NOT_ON_TOP");
    expect(nonTop.inventory).toBe(initial);

    const wrongEra = removeBuiltIndustryTile(initial, "manufacturer-1-a", "rail");
    expectFailure(wrongEra, "TILE_NOT_BUILDABLE_IN_ERA");
    expect(wrongEra.inventory).toBe(initial);

    const once = developIndustryTiles(initial, ["manufacturer-1-a"]);
    expectSuccess(once);
    const unavailable = removeBuiltIndustryTile(
      once.inventory,
      "manufacturer-1-a",
      "canal",
    );
    expectFailure(unavailable, "TILE_NOT_AVAILABLE");

    expect(initial).toEqual(snapshot);
  });

  it("rejects duplicate physical Develop removals without committing the first", () => {
    const inventory = buildEarlierTiles(
      createIndustryInventory(),
      "manufacturer",
      "manufacturer-2-a",
    );
    const snapshot = structuredClone(inventory);
    const result = developIndustryTiles(inventory, [
      "manufacturer-2-a",
      "manufacturer-2-a",
    ]);

    expectFailure(result, "TILE_NOT_AVAILABLE");
    expect(result.error.selectionIndex).toBe(1);
    expect(result.inventory).toBe(inventory);
    expect(result.inventory).toEqual(snapshot);
  });

  it("preserves all other stack references while changing only the selected stack", () => {
    const inventory = createIndustryInventory();
    const result = developIndustryTiles(inventory, ["coal-1-a"]);
    expectSuccess(result);

    for (const industry of INDUSTRY_TILE_KIND_ORDER) {
      if (industry === "coal") {
        expect(result.inventory.stacks[industry])
          .not.toBe(inventory.stacks[industry]);
      } else {
        expect(result.inventory.stacks[industry]).toBe(inventory.stacks[industry]);
      }
    }
    expect(result.inventory.stacks.coal).toEqual(
      INDUSTRY_TILE_STACKS.coal.slice(1).map((tile) => tile.id),
    );
    expect(
      Object.values(result.inventory.stacks).flat().length +
      result.removedTileIds.length,
    ).toBe(45);
  });

  it("keeps selected IDs aligned with their generated catalog entries", () => {
    const inventory = createIndustryInventory();
    for (const [industry, stack] of Object.entries(inventory.stacks)) {
      for (const tileId of stack) {
        expect(INDUSTRY_TILE_BY_ID[tileId].industry).toBe(industry);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  BOARD_V2,
  BOARD_V2_COUNTS,
} from "@/engine/rules/generated/board-v2";

const LOCATION_IDS = Object.keys(BOARD_V2.locations);
const LOCATIONS = Object.entries(BOARD_V2.locations);

const linksInEra = (era: "canal" | "rail") =>
  BOARD_V2.links.filter((link) =>
    (link.eras as readonly string[]).includes(era),
  );

describe("generated board data", () => {
  it("contains the complete retail board inventory", () => {
    expect(BOARD_V2_COUNTS).toEqual({
      locations: 27,
      cities: 20,
      farmBreweries: 2,
      merchants: 5,
      buildSpaces: 49,
      merchantSpaces: 9,
      links: 39,
      canalLinks: 31,
      railLinks: 38,
      bothEraLinks: 30,
      canalOnlyLinks: 1,
      railOnlyLinks: 8,
      hyperedges: 1,
    });

    expect(LOCATION_IDS).toHaveLength(BOARD_V2_COUNTS.locations);
    expect(
      LOCATIONS.filter(([, location]) => location.kind === "city"),
    ).toHaveLength(20);
    expect(
      LOCATIONS.filter(([, location]) => location.kind === "farm_brewery"),
    ).toHaveLength(2);
    expect(
      LOCATIONS.filter(([, location]) => location.kind === "merchant"),
    ).toHaveLength(5);
  });

  it("uses globally unique, stable entity IDs", () => {
    const entityIds = [
      ...LOCATION_IDS,
      ...LOCATIONS.flatMap(([, location]) =>
        "buildSpaces" in location
          ? location.buildSpaces.map((space) => space.id)
          : location.merchantSpaces,
      ),
      ...BOARD_V2.links.map((link) => link.id),
    ];

    expect(new Set(entityIds)).toHaveLength(entityIds.length);
    expect(entityIds.every((id) => /^[a-z][a-z0-9_]*$/.test(id))).toBe(true);
  });

  it("models every link against real locations without duplicate adjacencies", () => {
    const locationIds = new Set(LOCATION_IDS);
    const linkedLocations = new Set<string>();
    const adjacencyKeys = BOARD_V2.links.map((link) => {
      for (const locationId of link.adjacentLocations) {
        expect(locationIds.has(locationId)).toBe(true);
        linkedLocations.add(locationId);
      }
      return [...link.adjacentLocations].sort().join("::");
    });

    expect(new Set(adjacencyKeys)).toHaveLength(adjacencyKeys.length);
    expect(linkedLocations).toEqual(locationIds);
  });

  it("records the exact era-specific link spaces", () => {
    expect(linksInEra("canal")).toHaveLength(31);
    expect(linksInEra("rail")).toHaveLength(38);
    expect(
      BOARD_V2.links
        .filter((link) => link.eras.length === 1 && link.eras[0] === "canal")
        .map((link) => link.id),
    ).toEqual(["link_burton_on_trent_walsall"]);
    expect(
      BOARD_V2.links
        .filter((link) => link.eras.length === 1 && link.eras[0] === "rail")
        .map((link) => link.id),
    ).toEqual([
      "link_belper_leek",
      "link_birmingham_nuneaton",
      "link_birmingham_redditch",
      "link_burton_on_trent_cannock",
      "link_coventry_nuneaton",
      "link_derby_uttoxeter",
      "link_stone_uttoxeter",
      "link_tamworth_walsall",
    ]);
  });

  it("represents the southern farm brewery as the board's sole hyperedge", () => {
    const hyperedges = BOARD_V2.links.filter(
      (link) => link.adjacentLocations.length === 3,
    );

    expect(hyperedges).toEqual([
      expect.objectContaining({
        id: "link_kidderminster_worcester_farm_brewery",
        adjacentLocations: [
          "kidderminster",
          "worcester",
          "farm_brewery_kidderminster_worcester",
        ],
        eras: ["canal", "rail"],
      }),
    ]);
  });

  it("models both farm breweries as brewery-only build spaces", () => {
    const farms = LOCATIONS.filter(
      ([, location]) => location.kind === "farm_brewery",
    );

    for (const [, farm] of farms) {
      expect(farm).toMatchObject({
        baseLinkIcons: 0,
        buildCardRule: "industry_or_wild_industry_only",
        buildSpaces: [{ allows: ["brewery"] }],
      });
    }
  });

  it("records every merchant space, bonus, and permanent link icon", () => {
    const merchants = Object.fromEntries(
      LOCATIONS.filter(([, location]) => location.kind === "merchant"),
    );

    expect(merchants).toMatchObject({
      merchant_warrington: {
        baseLinkIcons: 2,
        coalMarketAccess: true,
        merchantBonus: { kind: "money", amount: 5 },
        merchantSpaces: ["merchant_warrington_1", "merchant_warrington_2"],
      },
      merchant_nottingham: {
        baseLinkIcons: 2,
        coalMarketAccess: true,
        merchantBonus: { kind: "victory_points", amount: 3 },
        merchantSpaces: ["merchant_nottingham_1", "merchant_nottingham_2"],
      },
      merchant_shrewsbury: {
        baseLinkIcons: 2,
        coalMarketAccess: true,
        merchantBonus: { kind: "victory_points", amount: 4 },
        merchantSpaces: ["merchant_shrewsbury_1"],
      },
      merchant_gloucester: {
        baseLinkIcons: 2,
        coalMarketAccess: true,
        merchantBonus: { kind: "free_develop", amount: 1 },
        merchantSpaces: ["merchant_gloucester_1", "merchant_gloucester_2"],
      },
      merchant_oxford: {
        baseLinkIcons: 2,
        coalMarketAccess: true,
        merchantBonus: { kind: "income_spaces", amount: 2 },
        merchantSpaces: ["merchant_oxford_1", "merchant_oxford_2"],
      },
    });
  });

  it("keeps board topology fixed while player count filters cards and merchants", () => {
    expect(BOARD_V2.playerCountRules).toEqual({
      2: {
        locationCardBanners: ["red", "gold", "purple"],
        merchantTileLocations: [
          "merchant_shrewsbury",
          "merchant_gloucester",
          "merchant_oxford",
        ],
        activeMerchantSpaces: 5,
      },
      3: {
        locationCardBanners: ["blue", "red", "gold", "purple"],
        merchantTileLocations: [
          "merchant_warrington",
          "merchant_shrewsbury",
          "merchant_gloucester",
          "merchant_oxford",
        ],
        activeMerchantSpaces: 7,
      },
      4: {
        locationCardBanners: ["teal", "blue", "red", "gold", "purple"],
        merchantTileLocations: [
          "merchant_warrington",
          "merchant_nottingham",
          "merchant_shrewsbury",
          "merchant_gloucester",
          "merchant_oxford",
        ],
        activeMerchantSpaces: 9,
      },
    });
  });

  it("retains source-level provenance for every verified board claim", () => {
    const sourceIds = new Set(BOARD_V2.provenance.sources.map((source) => source.id));

    expect(BOARD_V2.provenance.sources).toHaveLength(4);
    for (const claim of Object.values(BOARD_V2.provenance.claims)) {
      expect(claim.confidence).toBe("high");
      expect(claim.sources.length).toBeGreaterThan(0);
      expect(claim.sources.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
    }
  });
});

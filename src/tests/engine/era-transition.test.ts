import { describe, expect, it } from "vitest";
import {
  rankFinalStandings,
  replenishMerchantBeer,
  resolveEraEnd,
  scoreBuiltIndustries,
  scoreBuiltLinks,
  scoreEraAssets,
  type EraEndInput,
  type EraIndustryPlacement,
  type EraLinkPlacement,
  type EraMerchantSpace,
  type PlayerStandingInput,
} from "@/engine/scoring/era-transition";
import { createMerchantSetup } from "@/engine/setup-v2/create-merchant-setup";

const industries = [
  {
    id: "birmingham-manufacturer",
    ownerId: "alice",
    locationId: "birmingham",
    faceId: "manufacturer-1",
    flipped: true,
  },
  {
    id: "birmingham-cotton",
    ownerId: "bob",
    locationId: "birmingham",
    faceId: "cotton-4",
    flipped: false,
  },
  {
    id: "worcester-iron",
    ownerId: "alice",
    locationId: "worcester",
    faceId: "iron-3",
    flipped: true,
  },
] as const satisfies readonly EraIndustryPlacement[];

const links = [
  {
    linkId: "link_birmingham_oxford",
    ownerId: "alice",
    era: "canal",
  },
  {
    linkId: "link_birmingham_worcester",
    ownerId: "bob",
    era: "canal",
  },
] as const satisfies readonly EraLinkPlacement[];

const merchants = [
  {
    merchantSpaceId: "active-demand",
    active: true,
    demandIndustries: ["cotton_mill"],
    beer: 0,
  },
  {
    merchantSpaceId: "active-blank",
    active: true,
    demandIndustries: [],
    beer: 0,
  },
  {
    merchantSpaceId: "inactive",
    active: false,
    demandIndustries: ["pottery"],
    beer: 0,
  },
] as const satisfies readonly EraMerchantSpace[];

describe("era scoring", () => {
  it("scores permanent Merchant icons plus every adjacent built Industry icon", () => {
    const result = scoreBuiltLinks(links, industries);

    expect(result.links[0]).toEqual({
      linkId: "link_birmingham_oxford",
      ownerId: "alice",
      points: 5,
      locations: [
        {
          locationId: "birmingham",
          permanentIcons: 0,
          industryIcons: 3,
          totalIcons: 3,
        },
        {
          locationId: "merchant_oxford",
          permanentIcons: 2,
          industryIcons: 0,
          totalIcons: 2,
        },
      ],
    });
    expect(result.links[1].points).toBe(4);
    expect(result.totalByOwner).toEqual({ alice: 5, bob: 4 });
  });

  it("counts unflipped Industry link icons for every player's links", () => {
    const result = scoreBuiltLinks(
      [
        {
          linkId: "link_birmingham_coventry",
          ownerId: "charlie",
          era: "rail",
        },
      ],
      industries,
    );

    expect(result.links[0].locations[0].industryIcons).toBe(3);
    expect(result.totalByOwner).toEqual({ charlie: 3 });
  });

  it("scores all three locations on the farm hyperedge", () => {
    const result = scoreBuiltLinks(
      [
        {
          linkId: "link_kidderminster_worcester_farm_brewery",
          ownerId: "alice",
          era: "canal",
        },
      ],
      [
        {
          id: "kidderminster-cotton",
          ownerId: "bob",
          locationId: "kidderminster",
          faceId: "cotton-2",
          flipped: false,
        },
        {
          id: "worcester-iron",
          ownerId: "alice",
          locationId: "worcester",
          faceId: "iron-4",
          flipped: false,
        },
        {
          id: "farm-brewery",
          ownerId: "charlie",
          locationId: "farm_brewery_kidderminster_worcester",
          faceId: "brewery-3",
          flipped: false,
        },
      ],
    );

    expect(result.links[0].locations.map((location) => location.locationId)).toEqual([
      "kidderminster",
      "worcester",
      "farm_brewery_kidderminster_worcester",
    ]);
    expect(result.links[0].locations.map((location) => location.industryIcons)).toEqual([
      2,
      1,
      2,
    ]);
    expect(result.links[0].points).toBe(5);
  });

  it("awards printed VP only for flipped Industries", () => {
    const result = scoreBuiltIndustries(industries);

    expect(result.industries).toEqual([
      expect.objectContaining({
        industryId: "birmingham-manufacturer",
        flipped: true,
        points: 3,
      }),
      expect.objectContaining({
        industryId: "birmingham-cotton",
        flipped: false,
        points: 0,
      }),
      expect.objectContaining({
        industryId: "worcester-iron",
        flipped: true,
        points: 7,
      }),
    ]);
    expect(result.totalByOwner).toEqual({ alice: 10, bob: 0 });
  });

  it("combines link and Industry points by their respective owners", () => {
    const result = scoreEraAssets(links, industries);

    expect(result.linkPointsByOwner).toEqual({ alice: 5, bob: 4 });
    expect(result.industryPointsByOwner).toEqual({ alice: 10, bob: 0 });
    expect(result.totalByOwner).toEqual({ alice: 15, bob: 4 });
  });

  it("scores empty asset collections as empty JSON records", () => {
    expect(scoreEraAssets([], [])).toEqual({
      totalByOwner: {},
      linkPointsByOwner: {},
      industryPointsByOwner: {},
      links: [],
      industries: [],
    });
  });
});

describe("Canal-to-Rail transition", () => {
  it("scores before removing every Canal link and every level-1 Industry", () => {
    const resolution = resolveEraEnd({
      completedEra: "canal",
      links,
      industries,
      merchantSpaces: merchants,
    });

    expect(resolution).toMatchObject({
      completedEra: "canal",
      nextEra: "rail",
      gameEnded: false,
      removedLinkIds: [
        "link_birmingham_oxford",
        "link_birmingham_worcester",
      ],
      removedIndustryIds: ["birmingham-manufacturer"],
      links: [],
    });
    expect(resolution.scoring.totalByOwner).toEqual({ alice: 15, bob: 4 });
    expect(resolution.industries.map((industry) => industry.id)).toEqual([
      "birmingham-cotton",
      "worcester-iron",
    ]);
  });

  it("removes level-1 Industries whether flipped or unflipped", () => {
    const resolution = resolveEraEnd({
      completedEra: "canal",
      links: [],
      industries: [
        {
          id: "flipped-one",
          ownerId: "alice",
          locationId: "coalbrookdale",
          faceId: "iron-1",
          flipped: true,
        },
        {
          id: "unflipped-one",
          ownerId: "bob",
          locationId: "cannock",
          faceId: "coal-1",
          flipped: false,
        },
        {
          id: "level-two",
          ownerId: "alice",
          locationId: "birmingham",
          faceId: "manufacturer-2",
          flipped: false,
        },
      ],
      merchantSpaces: [],
    });

    expect(resolution.removedIndustryIds).toEqual([
      "flipped-one",
      "unflipped-one",
    ]);
    expect(resolution.industries.map((industry) => industry.id)).toEqual([
      "level-two",
    ]);
    expect(resolution.scoring.industryPointsByOwner).toEqual({ alice: 3, bob: 0 });
  });

  it("replenishes active nonblank Merchants and keeps blank/inactive spaces empty", () => {
    expect(replenishMerchantBeer(merchants)).toEqual([
      { ...merchants[0], demandIndustries: ["cotton_mill"], beer: 1 },
      { ...merchants[1], demandIndustries: [], beer: 0 },
      { ...merchants[2], demandIndustries: ["pottery"], beer: 0 },
    ]);

    const resolution = resolveEraEnd({
      completedEra: "canal",
      links: [],
      industries: [],
      merchantSpaces: [
        { ...merchants[0], beer: 1 },
        merchants[1],
        merchants[2],
      ],
    });
    expect(resolution.merchantSpaces.map((space) => space.beer)).toEqual([
      1, 0, 0,
    ]);
  });

  it("accepts setup-v2 Merchant spaces directly and preserves their metadata", () => {
    const setup = createMerchantSetup(2, "era-transition-merchant-seed");
    const consumed = setup.spaces.map((space) => ({ ...space, beer: 0 as const }));
    const replenished = replenishMerchantBeer(consumed);

    expect(
      replenished.map(({ locationId, merchantSpaceId, tileId }) => ({
        locationId,
        merchantSpaceId,
        tileId,
      })),
    ).toEqual(
      setup.spaces.map(({ locationId, merchantSpaceId, tileId }) => ({
        locationId,
        merchantSpaceId,
        tileId,
      })),
    );
    for (const space of replenished) {
      expect(space.beer).toBe(
        space.active && space.demandIndustries.length > 0 ? 1 : 0,
      );
    }
  });

  it("rejects cross-era links instead of scoring or preserving impossible assets", () => {
    expect(() =>
      resolveEraEnd({
        completedEra: "canal",
        links: [
          links[0],
          {
            linkId: "link_belper_leek",
            ownerId: "bob",
            era: "rail",
          },
        ],
        industries: [],
        merchantSpaces: [],
      }),
    ).toThrow(/rail link during canal scoring/);
  });
});

describe("final Rail scoring", () => {
  it("scores and preserves Rail assets instead of applying Canal cleanup", () => {
    const railLinks = links.map((link) => ({ ...link, era: "rail" as const }));
    const input: EraEndInput = {
      completedEra: "rail",
      links: railLinks,
      industries,
      merchantSpaces: merchants,
    };
    const resolution = resolveEraEnd(input);

    expect(resolution).toMatchObject({
      completedEra: "rail",
      nextEra: null,
      gameEnded: true,
      removedLinkIds: [],
      removedIndustryIds: [],
      scoring: { totalByOwner: { alice: 15, bob: 4 } },
    });
    expect(resolution.links).toEqual(railLinks);
    expect(resolution.industries).toEqual(industries);
    expect(resolution.merchantSpaces).toEqual(merchants);
    expect(resolution.links).not.toBe(railLinks);
    expect(resolution.industries).not.toBe(industries);
    expect(resolution.merchantSpaces).not.toBe(merchants);
  });

  it("leaves consumed Merchant beer consumed at final game end", () => {
    const resolution = resolveEraEnd({
      completedEra: "rail",
      links: [],
      industries: [],
      merchantSpaces: merchants,
    });

    expect(resolution.merchantSpaces[0].beer).toBe(0);
  });
});

describe("final standings", () => {
  it("ranks by VP, then income level, then cash", () => {
    const standings = rankFinalStandings([
      { playerId: "cash", victoryPoints: 100, incomeLevel: 8, cash: 40 },
      { playerId: "vp", victoryPoints: 101, incomeLevel: -10, cash: 0 },
      { playerId: "income", victoryPoints: 100, incomeLevel: 9, cash: 0 },
      { playerId: "last", victoryPoints: 99, incomeLevel: 30, cash: 999 },
    ]);

    expect(standings.map(({ playerId, rank }) => ({ playerId, rank }))).toEqual([
      { playerId: "vp", rank: 1 },
      { playerId: "income", rank: 2 },
      { playerId: "cash", rank: 3 },
      { playerId: "last", rank: 4 },
    ]);
    expect(standings.every((standing) => !standing.tied)).toBe(true);
  });

  it("keeps complete ties explicit, stable, and at a shared competition rank", () => {
    const standings = rankFinalStandings([
      { playerId: "winner", victoryPoints: 20, incomeLevel: 0, cash: 0 },
      { playerId: "tie-b", victoryPoints: 10, incomeLevel: 2, cash: 7 },
      { playerId: "tie-a", victoryPoints: 10, incomeLevel: 2, cash: 7 },
      { playerId: "fourth", victoryPoints: 5, incomeLevel: 30, cash: 100 },
    ]);

    expect(standings.map(({ playerId, rank, tied }) => ({ playerId, rank, tied }))).toEqual([
      { playerId: "winner", rank: 1, tied: false },
      { playerId: "tie-b", rank: 2, tied: true },
      { playerId: "tie-a", rank: 2, tied: true },
      { playerId: "fourth", rank: 4, tied: false },
    ]);
  });

  it("allows a tied victory after exhausting every tie-break", () => {
    expect(
      rankFinalStandings([
        { playerId: "a", victoryPoints: 50, incomeLevel: 3, cash: 12 },
        { playerId: "b", victoryPoints: 50, incomeLevel: 3, cash: 12 },
      ]),
    ).toEqual([
      {
        playerId: "a",
        victoryPoints: 50,
        incomeLevel: 3,
        cash: 12,
        rank: 1,
        tied: true,
      },
      {
        playerId: "b",
        victoryPoints: 50,
        incomeLevel: 3,
        cash: 12,
        rank: 1,
        tied: true,
      },
    ]);
  });
});

describe("era helper validation and immutability", () => {
  it("returns JSON-only copies and never mutates frozen inputs", () => {
    const input = Object.freeze({
      completedEra: "canal" as const,
      links: Object.freeze(links.map((link) => Object.freeze({ ...link }))),
      industries: Object.freeze(
        industries.map((industry) => Object.freeze({ ...industry })),
      ),
      merchantSpaces: Object.freeze(
        merchants.map((merchant) =>
          Object.freeze({
            ...merchant,
            demandIndustries: Object.freeze([...merchant.demandIndustries]),
          }),
        ),
      ),
    });
    const before = JSON.stringify(input);
    const result = resolveEraEnd(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it.each([
    [
      "unknown link",
      {
        ...links[0],
        linkId: "not-a-link",
      },
    ],
    [
      "duplicate link",
      links[0],
    ],
    [
      "wrong-era link",
      {
        linkId: "link_burton_on_trent_walsall",
        ownerId: "alice",
        era: "rail",
      },
    ],
  ])("rejects %s state", (_label, invalidLink) => {
    const candidateLinks =
      _label === "duplicate link"
        ? [links[0], invalidLink]
        : [invalidLink];
    expect(() =>
      scoreBuiltLinks(
        candidateLinks as unknown as readonly EraLinkPlacement[],
        [],
      ),
    ).toThrow();
  });

  it.each([
    { ...industries[0], id: "" },
    { ...industries[0], locationId: "not-a-location" },
    { ...industries[0], locationId: "merchant_oxford" },
    { ...industries[0], faceId: "not-a-face" },
    { ...industries[0], flipped: 1 },
  ])("rejects invalid Industry state %#", (industry) => {
    expect(() =>
      scoreBuiltIndustries([
        industry as unknown as EraIndustryPlacement,
      ]),
    ).toThrow();
  });

  it("rejects duplicate Industries and Merchant spaces", () => {
    expect(() => scoreBuiltIndustries([industries[0], industries[0]])).toThrow(
      /Duplicate industry/,
    );
    expect(() => replenishMerchantBeer([merchants[0], merchants[0]])).toThrow(
      /Duplicate Merchant/,
    );
  });

  it.each([
    { ...merchants[0], beer: 2 },
    { ...merchants[0], active: "yes" },
    { ...merchants[0], demandIndustries: [""] },
    { ...merchants[0], demandIndustries: ["pottery", "pottery"] },
  ])("rejects invalid Merchant state %#", (merchant) => {
    expect(() =>
      replenishMerchantBeer([
        merchant as unknown as EraMerchantSpace,
      ]),
    ).toThrow();
  });

  it.each<readonly [readonly PlayerStandingInput[]]>([
    [[]],
    [[{ playerId: "solo", victoryPoints: 1, incomeLevel: 0, cash: 0 }]],
    [
      Array.from({ length: 5 }, (_, index) => ({
        playerId: `p${index}`,
        victoryPoints: 0,
        incomeLevel: 0,
        cash: 0,
      })),
    ],
  ])("rejects unsupported standings collection %#", (players) => {
    expect(() => rankFinalStandings(players)).toThrow(/2–4/);
  });

  it.each([
    ["duplicate player", [
      { playerId: "a", victoryPoints: 0, incomeLevel: 0, cash: 0 },
      { playerId: "a", victoryPoints: 0, incomeLevel: 0, cash: 0 },
    ]],
    ["negative VP", [
      { playerId: "a", victoryPoints: -1, incomeLevel: 0, cash: 0 },
      { playerId: "b", victoryPoints: 0, incomeLevel: 0, cash: 0 },
    ]],
    ["invalid income", [
      { playerId: "a", victoryPoints: 0, incomeLevel: 31, cash: 0 },
      { playerId: "b", victoryPoints: 0, incomeLevel: 0, cash: 0 },
    ]],
    ["negative cash", [
      { playerId: "a", victoryPoints: 0, incomeLevel: 0, cash: -1 },
      { playerId: "b", victoryPoints: 0, incomeLevel: 0, cash: 0 },
    ]],
  ])("rejects %s standings", (_label, players) => {
    expect(() =>
      rankFinalStandings(
        players as unknown as readonly PlayerStandingInput[],
      ),
    ).toThrow();
  });
});

import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "docs", "rules-data", "board-v2.yaml");
const OUTPUT = path.join(
  ROOT,
  "src",
  "engine",
  "rules",
  "generated",
  "board-v2.ts",
);
const CHECK = process.argv.includes("--check");

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const ALLOWED_INDUSTRIES = new Set([
  "cotton_mill",
  "coal_mine",
  "iron_works",
  "manufacturer",
  "pottery",
  "brewery",
]);
const ALLOWED_LOCATION_KINDS = new Set(["city", "farm_brewery", "merchant"]);
const ALLOWED_BANNERS = new Set(["teal", "blue", "red", "gold", "purple"]);
const ALLOWED_ERAS = new Set(["canal", "rail"]);
const ALLOWED_BONUSES = new Set([
  "money",
  "victory_points",
  "free_develop",
  "income_spaces",
]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);
const EXPECTED_COUNTS = {
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
};
const EXPECTED_ACTIVE_MERCHANT_SPACES = { 2: 5, 3: 7, 4: 9 };

function fail(message) {
  throw new Error(`board-v2.yaml: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value, label) {
  if (!isObject(value)) fail(`${label} must be an object.`);
  return value;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertId(value, label) {
  const id = assertString(value, label);
  if (!ID_PATTERN.test(id)) {
    fail(`${label} must match ${ID_PATTERN}.`);
  }
  return id;
}

function assertInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${label} must be an integer >= ${minimum}.`);
  }
  return value;
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
  return value;
}

function assertArray(value, label, minimumLength = 0) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    fail(`${label} must be an array with at least ${minimumLength} entries.`);
  }
  return value;
}

function assertAllowed(value, allowed, label) {
  const text = assertString(value, label);
  if (!allowed.has(text)) fail(`${label} has unsupported value ${text}.`);
  return text;
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`${label} contains duplicate value ${value}.`);
    seen.add(value);
  }
  return values;
}

function assertExactCount(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${expected}; received ${actual}.`);
}

function registerGlobalId(id, category, globalIds) {
  const prior = globalIds.get(id);
  if (prior) fail(`${category} ID ${id} duplicates ${prior}.`);
  globalIds.set(id, category);
}

function normalizeProvenance(value) {
  const provenance = assertObject(value, "provenance");
  const sourceIds = new Set();
  const sources = assertArray(provenance.sources, "provenance.sources", 1).map(
    (rawSource, index) => {
      const source = assertObject(rawSource, `provenance.sources[${index}]`);
      const id = assertId(source.id, `provenance.sources[${index}].id`);
      if (sourceIds.has(id)) fail(`provenance source ID ${id} is duplicated.`);
      sourceIds.add(id);
      const url = assertString(source.url, `provenance.sources[${index}].url`);
      if (!url.startsWith("https://")) {
        fail(`provenance.sources[${index}].url must use https.`);
      }
      return {
        id,
        kind: assertId(source.kind, `provenance.sources[${index}].kind`),
        title: assertString(source.title, `provenance.sources[${index}].title`),
        url,
      };
    },
  );

  const rawClaims = assertObject(provenance.claims, "provenance.claims");
  const claims = {};
  for (const [claimId, rawClaim] of Object.entries(rawClaims)) {
    assertId(claimId, `provenance claim ID ${claimId}`);
    const claim = assertObject(rawClaim, `provenance.claims.${claimId}`);
    const claimSources = assertUnique(
      assertArray(claim.sources, `provenance.claims.${claimId}.sources`, 1).map(
        (sourceId, index) =>
          assertId(sourceId, `provenance.claims.${claimId}.sources[${index}]`),
      ),
      `provenance.claims.${claimId}.sources`,
    );
    for (const sourceId of claimSources) {
      if (!sourceIds.has(sourceId)) {
        fail(`provenance claim ${claimId} references unknown source ${sourceId}.`);
      }
    }
    claims[claimId] = {
      confidence: assertAllowed(
        claim.confidence,
        ALLOWED_CONFIDENCE,
        `provenance.claims.${claimId}.confidence`,
      ),
      sources: claimSources,
    };
  }
  if (Object.keys(claims).length === 0) fail("provenance.claims cannot be empty.");

  return { sources, claims };
}

function normalizeBoard(parsed) {
  const root = assertObject(parsed, "root");
  const meta = assertObject(root.meta, "meta");
  const schemaVersion = assertInteger(meta.schema_version, "meta.schema_version", 1);
  const rulesetId = assertId(meta.ruleset_id, "meta.ruleset_id");
  const verifiedOn = assertString(meta.verified_on, "meta.verified_on");
  const notes = assertArray(meta.notes, "meta.notes", 1).map((note, index) =>
    assertString(note, `meta.notes[${index}]`),
  );
  const provenance = normalizeProvenance(root.provenance);

  const industryKinds = assertUnique(
    assertArray(root.industry_kinds, "industry_kinds", 1).map((kind, index) =>
      assertAllowed(kind, ALLOWED_INDUSTRIES, `industry_kinds[${index}]`),
    ),
    "industry_kinds",
  );
  assertExactCount(industryKinds.length, ALLOWED_INDUSTRIES.size, "industry kind count");
  for (const kind of ALLOWED_INDUSTRIES) {
    if (!industryKinds.includes(kind)) fail(`industry_kinds is missing ${kind}.`);
  }

  const globalIds = new Map();
  const rawLocations = assertObject(root.locations, "locations");
  const locations = {};
  const locationIds = new Set();
  const buildSpaceIds = new Set();
  const merchantSpaceIds = new Set();
  const labelSet = new Set();
  const kindCounts = { city: 0, farm_brewery: 0, merchant: 0 };

  for (const [locationId, rawLocation] of Object.entries(rawLocations)) {
    assertId(locationId, `location ID ${locationId}`);
    registerGlobalId(locationId, "location", globalIds);
    locationIds.add(locationId);
    const location = assertObject(rawLocation, `locations.${locationId}`);
    const kind = assertAllowed(
      location.kind,
      ALLOWED_LOCATION_KINDS,
      `locations.${locationId}.kind`,
    );
    const label = assertString(location.label, `locations.${locationId}.label`);
    if (labelSet.has(label)) fail(`location label ${label} is duplicated.`);
    labelSet.add(label);
    const baseLinkIcons = assertInteger(
      location.base_link_icons,
      `locations.${locationId}.base_link_icons`,
    );
    kindCounts[kind] += 1;

    if (kind === "merchant") {
      if (baseLinkIcons !== 2) {
        fail(`merchant ${locationId} must have exactly 2 base link icons.`);
      }
      const merchantTileMinPlayers = assertInteger(
        location.merchant_tile_min_players,
        `locations.${locationId}.merchant_tile_min_players`,
        2,
      );
      if (merchantTileMinPlayers > 4) {
        fail(`locations.${locationId}.merchant_tile_min_players cannot exceed 4.`);
      }
      const bonus = assertObject(
        location.merchant_bonus,
        `locations.${locationId}.merchant_bonus`,
      );
      const merchantSpaces = assertUnique(
        assertArray(
          location.merchant_spaces,
          `locations.${locationId}.merchant_spaces`,
          1,
        ).map((spaceId, index) =>
          assertId(spaceId, `locations.${locationId}.merchant_spaces[${index}]`),
        ),
        `locations.${locationId}.merchant_spaces`,
      );
      for (const spaceId of merchantSpaces) {
        registerGlobalId(spaceId, "merchant space", globalIds);
        merchantSpaceIds.add(spaceId);
      }
      locations[locationId] = {
        kind,
        label,
        baseLinkIcons,
        coalMarketAccess: assertBoolean(
          location.coal_market_access,
          `locations.${locationId}.coal_market_access`,
        ),
        merchantTileMinPlayers,
        merchantBonus: {
          kind: assertAllowed(
            bonus.kind,
            ALLOWED_BONUSES,
            `locations.${locationId}.merchant_bonus.kind`,
          ),
          amount: assertInteger(
            bonus.amount,
            `locations.${locationId}.merchant_bonus.amount`,
            1,
          ),
        },
        merchantSpaces,
      };
      continue;
    }

    if (baseLinkIcons !== 0) {
      fail(`${kind} ${locationId} must have zero permanent link icons.`);
    }
    const buildSpaces = assertArray(
      location.build_spaces,
      `locations.${locationId}.build_spaces`,
      1,
    ).map((rawSpace, index) => {
      const space = assertObject(rawSpace, `locations.${locationId}.build_spaces[${index}]`);
      const id = assertId(space.id, `locations.${locationId}.build_spaces[${index}].id`);
      registerGlobalId(id, "build space", globalIds);
      buildSpaceIds.add(id);
      const allows = assertUnique(
        assertArray(
          space.allows,
          `locations.${locationId}.build_spaces[${index}].allows`,
          1,
        ).map((industry, industryIndex) =>
          assertAllowed(
            industry,
            ALLOWED_INDUSTRIES,
            `locations.${locationId}.build_spaces[${index}].allows[${industryIndex}]`,
          ),
        ),
        `locations.${locationId}.build_spaces[${index}].allows`,
      );
      if (allows.length > 2) {
        fail(`build space ${id} cannot allow more than 2 industries.`);
      }
      return { id, allows };
    });

    if (kind === "farm_brewery") {
      assertExactCount(buildSpaces.length, 1, `${locationId} build-space count`);
      if (buildSpaces[0].allows.length !== 1 || buildSpaces[0].allows[0] !== "brewery") {
        fail(`farm brewery ${locationId} must have one brewery-only build space.`);
      }
      const buildCardRule = assertString(
        location.build_card_rule,
        `locations.${locationId}.build_card_rule`,
      );
      if (buildCardRule !== "industry_or_wild_industry_only") {
        fail(`farm brewery ${locationId} has unsupported build-card rule.`);
      }
      locations[locationId] = { kind, label, baseLinkIcons, buildCardRule, buildSpaces };
      continue;
    }

    const banner = assertAllowed(
      location.banner,
      ALLOWED_BANNERS,
      `locations.${locationId}.banner`,
    );
    const locationCardMinPlayers = assertInteger(
      location.location_card_min_players,
      `locations.${locationId}.location_card_min_players`,
      2,
    );
    if (locationCardMinPlayers > 4) {
      fail(`locations.${locationId}.location_card_min_players cannot exceed 4.`);
    }
    locations[locationId] = {
      kind,
      label,
      banner,
      locationCardMinPlayers,
      baseLinkIcons,
      buildSpaces,
    };
  }

  const rawLinks = assertArray(root.links, "links", 1);
  const links = [];
  const linkIds = new Set();
  const adjacencyKeys = new Set();
  const locationLinkCounts = new Map([...locationIds].map((id) => [id, 0]));
  let canalLinks = 0;
  let railLinks = 0;
  let bothEraLinks = 0;
  let canalOnlyLinks = 0;
  let railOnlyLinks = 0;
  let hyperedgeCount = 0;

  for (const [index, rawLink] of rawLinks.entries()) {
    const link = assertObject(rawLink, `links[${index}]`);
    const id = assertId(link.id, `links[${index}].id`);
    registerGlobalId(id, "link", globalIds);
    linkIds.add(id);
    const adjacentLocations = assertUnique(
      assertArray(link.adjacent_locations, `links[${index}].adjacent_locations`, 2).map(
        (locationId, locationIndex) =>
          assertId(locationId, `links[${index}].adjacent_locations[${locationIndex}]`),
      ),
      `links[${index}].adjacent_locations`,
    );
    if (adjacentLocations.length > 3) fail(`link ${id} has more than 3 locations.`);
    if (adjacentLocations.length === 3) hyperedgeCount += 1;
    for (const locationId of adjacentLocations) {
      if (!locationIds.has(locationId)) fail(`link ${id} references unknown location ${locationId}.`);
      locationLinkCounts.set(locationId, locationLinkCounts.get(locationId) + 1);
    }
    const adjacencyKey = [...adjacentLocations].sort().join("::");
    if (adjacencyKeys.has(adjacencyKey)) {
      fail(`link ${id} duplicates physical adjacency ${adjacencyKey}.`);
    }
    adjacencyKeys.add(adjacencyKey);
    const eras = assertUnique(
      assertArray(link.eras, `links[${index}].eras`, 1).map((era, eraIndex) =>
        assertAllowed(era, ALLOWED_ERAS, `links[${index}].eras[${eraIndex}]`),
      ),
      `links[${index}].eras`,
    );
    if (eras.length > 2) fail(`link ${id} has more than 2 eras.`);
    const hasCanal = eras.includes("canal");
    const hasRail = eras.includes("rail");
    if (hasCanal) canalLinks += 1;
    if (hasRail) railLinks += 1;
    if (hasCanal && hasRail) bothEraLinks += 1;
    else if (hasCanal) canalOnlyLinks += 1;
    else railOnlyLinks += 1;
    links.push({ id, adjacentLocations, eras });
  }

  for (const [locationId, count] of locationLinkCounts) {
    if (count === 0) fail(`location ${locationId} is orphaned from the link graph.`);
  }

  const southernFarmLink = links.filter((link) => link.adjacentLocations.length === 3);
  assertExactCount(southernFarmLink.length, 1, "three-location link count");
  const requiredHyperedgeLocations = new Set([
    "kidderminster",
    "worcester",
    "farm_brewery_kidderminster_worcester",
  ]);
  if (
    southernFarmLink[0].adjacentLocations.length !== requiredHyperedgeLocations.size ||
    southernFarmLink[0].adjacentLocations.some((id) => !requiredHyperedgeLocations.has(id))
  ) {
    fail("the only three-location link must join Kidderminster, Worcester, and the southern farm brewery.");
  }

  const rawPlayerRules = assertObject(root.player_count_rules, "player_count_rules");
  const playerCountRules = {};
  const merchantEntries = Object.entries(locations).filter(([, location]) => location.kind === "merchant");
  for (const playerCount of [2, 3, 4]) {
    const rawRule = assertObject(
      rawPlayerRules[String(playerCount)],
      `player_count_rules.${playerCount}`,
    );
    const locationCardBanners = assertUnique(
      assertArray(
        rawRule.location_card_banners,
        `player_count_rules.${playerCount}.location_card_banners`,
        1,
      ).map((banner, index) =>
        assertAllowed(
          banner,
          ALLOWED_BANNERS,
          `player_count_rules.${playerCount}.location_card_banners[${index}]`,
        ),
      ),
      `player_count_rules.${playerCount}.location_card_banners`,
    );
    const merchantTileLocations = assertUnique(
      assertArray(
        rawRule.merchant_tile_locations,
        `player_count_rules.${playerCount}.merchant_tile_locations`,
        1,
      ).map((locationId, index) =>
        assertId(
          locationId,
          `player_count_rules.${playerCount}.merchant_tile_locations[${index}]`,
        ),
      ),
      `player_count_rules.${playerCount}.merchant_tile_locations`,
    );
    for (const locationId of merchantTileLocations) {
      if (locations[locationId]?.kind !== "merchant") {
        fail(`player-count rule ${playerCount} references non-merchant ${locationId}.`);
      }
    }

    const expectedBanners = new Set(
      Object.values(locations)
        .filter(
          (location) =>
            location.kind === "city" && location.locationCardMinPlayers <= playerCount,
        )
        .map((location) => location.banner),
    );
    if (
      expectedBanners.size !== locationCardBanners.length ||
      locationCardBanners.some((banner) => !expectedBanners.has(banner))
    ) {
      fail(`player-count rule ${playerCount} has incorrect Location-card banners.`);
    }

    const expectedMerchants = merchantEntries
      .filter(([, location]) => location.merchantTileMinPlayers <= playerCount)
      .map(([id]) => id);
    if (
      expectedMerchants.length !== merchantTileLocations.length ||
      merchantTileLocations.some((id) => !expectedMerchants.includes(id))
    ) {
      fail(`player-count rule ${playerCount} has incorrect Merchant locations.`);
    }
    const activeMerchantSpaces = merchantTileLocations.reduce(
      (total, locationId) => total + locations[locationId].merchantSpaces.length,
      0,
    );
    assertExactCount(
      activeMerchantSpaces,
      EXPECTED_ACTIVE_MERCHANT_SPACES[playerCount],
      `${playerCount}-player active Merchant-space count`,
    );
    playerCountRules[playerCount] = {
      locationCardBanners,
      merchantTileLocations,
      activeMerchantSpaces,
    };
  }
  const playerRuleKeys = Object.keys(rawPlayerRules).sort();
  if (playerRuleKeys.join(",") !== "2,3,4") {
    fail(`player_count_rules must contain exactly 2, 3, and 4; received ${playerRuleKeys.join(", ")}.`);
  }

  const counts = {
    locations: Object.keys(locations).length,
    cities: kindCounts.city,
    farmBreweries: kindCounts.farm_brewery,
    merchants: kindCounts.merchant,
    buildSpaces: buildSpaceIds.size,
    merchantSpaces: merchantSpaceIds.size,
    links: linkIds.size,
    canalLinks,
    railLinks,
    bothEraLinks,
    canalOnlyLinks,
    railOnlyLinks,
    hyperedges: hyperedgeCount,
  };
  for (const [countName, expected] of Object.entries(EXPECTED_COUNTS)) {
    assertExactCount(counts[countName], expected, countName);
  }

  return {
    schemaVersion,
    rulesetId,
    verifiedOn,
    notes,
    provenance,
    industryKinds,
    locations,
    links,
    playerCountRules,
    counts,
  };
}

async function main() {
  const raw = await fs.readFile(INPUT, "utf8");
  const board = normalizeBoard(parse(raw));
  const generated = `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Source: docs/rules-data/board-v2.yaml\n\nexport const BOARD_V2 = ${JSON.stringify(board, null, 2)} as const;\n\nexport const BOARD_V2_COUNTS = BOARD_V2.counts;\n`;

  if (CHECK) {
    const current = await fs.readFile(OUTPUT, "utf8").catch(() => "");
    if (current !== generated) {
      throw new Error(
        `${path.relative(ROOT, OUTPUT)} is stale. Run node scripts/rules/build-board-v2-data.mjs.`,
      );
    }
    console.log(`Verified ${path.relative(ROOT, OUTPUT)}`);
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, generated, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

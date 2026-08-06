import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "docs", "rules-data", "merchant-tiles.yaml");
const OUTPUT = path.join(
  ROOT,
  "src",
  "engine",
  "rules",
  "generated",
  "merchant-tiles.ts",
);

const PLAYER_COUNTS = [2, 3, 4];
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);
const DEMAND_INDUSTRIES = ["cotton_mill", "manufacturer", "pottery"];
const EXPECTED_ELIGIBLE_COUNTS = { 2: 5, 3: 7, 4: 9 };
const EXPECTED_MIN_PLAYER_COUNTS = { 2: 5, 3: 2, 4: 2 };
const EXPECTED_FACE_COUNTS = {
  blank: 3,
  cotton_mill: 2,
  manufacturer: 2,
  pottery: 1,
  universal: 1,
};
const EXPECTED_MIN_PLAYER_FACES = {
  2: ["blank", "blank", "cotton_mill", "manufacturer", "universal"],
  3: ["blank", "pottery"],
  4: ["cotton_mill", "manufacturer"],
};

function fail(message) {
  throw new Error(`merchant-tiles.yaml: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be a mapping.`);
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} must have exactly these keys: ${expected.join(", ")}.`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function assertId(value, label) {
  const id = assertString(value, label);
  if (!ID_PATTERN.test(id)) fail(`${label} must match ${ID_PATTERN}.`);
  return id;
}

function assertUrl(value, label) {
  const url = assertString(value, label);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:") fail(`${label} must use HTTPS.`);
  return url;
}

function assertInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${label} must be an integer >= ${minimum}.`);
  }
  return value;
}

function assertArray(value, label, minimumLength = 0) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    fail(`${label} must be an array with at least ${minimumLength} entries.`);
  }
  return value;
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    fail(`${label} must not contain duplicates.`);
  }
  return values;
}

function normalizeProvenance(rawProvenance) {
  const provenance = assertRecord(rawProvenance, "provenance");
  assertExactKeys(provenance, ["sources", "claims"], "provenance");

  const sourceIds = new Set();
  const sources = assertArray(provenance.sources, "provenance.sources", 2).map(
    (rawSource, index) => {
      const label = `provenance.sources[${index}]`;
      const source = assertRecord(rawSource, label);
      assertExactKeys(source, ["id", "kind", "title", "url"], label);
      const id = assertId(source.id, `${label}.id`);
      if (sourceIds.has(id)) fail(`duplicate provenance source ID ${id}.`);
      sourceIds.add(id);
      return {
        id,
        kind: assertId(source.kind, `${label}.kind`),
        title: assertString(source.title, `${label}.title`),
        url: assertUrl(source.url, `${label}.url`),
      };
    },
  );

  const claims = {};
  for (const [claimId, rawClaim] of Object.entries(
    assertRecord(provenance.claims, "provenance.claims"),
  )) {
    assertId(claimId, `provenance claim ID ${claimId}`);
    const label = `provenance.claims.${claimId}`;
    const claim = assertRecord(rawClaim, label);
    assertExactKeys(claim, ["confidence", "sources"], label);
    const confidence = assertString(claim.confidence, `${label}.confidence`);
    if (!CONFIDENCE_LEVELS.has(confidence)) {
      fail(`${label}.confidence must be low, medium, or high.`);
    }
    const claimSources = assertUnique(
      assertArray(claim.sources, `${label}.sources`, 1).map((sourceId, index) =>
        assertId(sourceId, `${label}.sources[${index}]`),
      ),
      `${label}.sources`,
    );
    for (const sourceId of claimSources) {
      if (!sourceIds.has(sourceId)) {
        fail(`${label} references unknown source ${sourceId}.`);
      }
    }
    claims[claimId] = { confidence, sources: claimSources };
  }
  if (Object.keys(claims).length === 0) fail("provenance.claims cannot be empty.");

  return { sources, claims };
}

function faceId(demandIndustries) {
  if (demandIndustries.length === 0) return "blank";
  if (demandIndustries.length === DEMAND_INDUSTRIES.length) return "universal";
  return demandIndustries[0];
}

function normalizeTiles(rawTiles) {
  const ids = new Set();
  const tiles = assertArray(rawTiles, "tiles", 1).map((rawTile, index) => {
    const label = `tiles[${index}]`;
    const tile = assertRecord(rawTile, label);
    assertExactKeys(tile, ["id", "min_players", "demand_industries"], label);
    const id = assertId(tile.id, `${label}.id`);
    if (ids.has(id)) fail(`duplicate Merchant tile ID ${id}.`);
    ids.add(id);

    const minPlayers = assertInteger(tile.min_players, `${label}.min_players`, 2);
    if (!PLAYER_COUNTS.includes(minPlayers)) {
      fail(`${label}.min_players must be 2, 3, or 4.`);
    }
    const demandIndustries = assertUnique(
      assertArray(tile.demand_industries, `${label}.demand_industries`).map(
        (industry, demandIndex) => {
          const normalized = assertId(
            industry,
            `${label}.demand_industries[${demandIndex}]`,
          );
          if (!DEMAND_INDUSTRIES.includes(normalized)) {
            fail(`${label} contains unsupported demand industry ${normalized}.`);
          }
          return normalized;
        },
      ),
      `${label}.demand_industries`,
    );
    if (demandIndustries.length === 2) {
      fail(`${label} cannot show exactly two demand industries.`);
    }
    if (
      demandIndustries.length === 3 &&
      JSON.stringify(demandIndustries) !== JSON.stringify(DEMAND_INDUSTRIES)
    ) {
      fail(`${label}'s universal face must use canonical industry order.`);
    }

    return {
      id,
      minPlayers,
      demandIndustries,
      includedAt: PLAYER_COUNTS.filter((count) => count >= minPlayers),
    };
  });

  if (tiles.length !== 9) fail("tiles must contain exactly 9 Merchant tiles.");

  for (const playerCount of PLAYER_COUNTS) {
    const exactMinCount = tiles.filter(
      (tile) => tile.minPlayers === playerCount,
    ).length;
    if (exactMinCount !== EXPECTED_MIN_PLAYER_COUNTS[playerCount]) {
      fail(
        `exactly ${EXPECTED_MIN_PLAYER_COUNTS[playerCount]} tiles must have min_players ${playerCount}.`,
      );
    }
    const eligibleCount = tiles.filter(
      (tile) => tile.minPlayers <= playerCount,
    ).length;
    if (eligibleCount !== EXPECTED_ELIGIBLE_COUNTS[playerCount]) {
      fail(
        `${playerCount}-player catalog has ${eligibleCount} eligible tiles; expected ${EXPECTED_ELIGIBLE_COUNTS[playerCount]}.`,
      );
    }
    const exactFaces = tiles
      .filter((tile) => tile.minPlayers === playerCount)
      .map((tile) => faceId(tile.demandIndustries))
      .sort();
    const expectedFaces = [...EXPECTED_MIN_PLAYER_FACES[playerCount]].sort();
    if (JSON.stringify(exactFaces) !== JSON.stringify(expectedFaces)) {
      fail(
        `min_players ${playerCount} faces must be ${expectedFaces.join(", ")}.`,
      );
    }
  }

  const actualFaceCounts = Object.fromEntries(
    Object.keys(EXPECTED_FACE_COUNTS).map((face) => [
      face,
      tiles.filter((tile) => faceId(tile.demandIndustries) === face).length,
    ]),
  );
  if (JSON.stringify(actualFaceCounts) !== JSON.stringify(EXPECTED_FACE_COUNTS)) {
    fail(`face distribution must be ${JSON.stringify(EXPECTED_FACE_COUNTS)}.`);
  }

  return tiles;
}

function validateAndNormalize(parsed) {
  const root = assertRecord(parsed, "document");
  assertExactKeys(
    root,
    ["meta", "provenance", "demand_industries", "tiles"],
    "document",
  );

  const meta = assertRecord(root.meta, "meta");
  assertExactKeys(
    meta,
    ["schema_version", "ruleset_id", "verified_on", "notes"],
    "meta",
  );
  if (meta.schema_version !== 1) fail("meta.schema_version must be 1.");

  const demandIndustries = assertUnique(
    assertArray(root.demand_industries, "demand_industries", 1).map(
      (industry, index) => assertId(industry, `demand_industries[${index}]`),
    ),
    "demand_industries",
  );
  if (JSON.stringify(demandIndustries) !== JSON.stringify(DEMAND_INDUSTRIES)) {
    fail(`demand_industries must be ${DEMAND_INDUSTRIES.join(", ")} in order.`);
  }

  return {
    meta: {
      schemaVersion: meta.schema_version,
      rulesetId: assertId(meta.ruleset_id, "meta.ruleset_id"),
      verifiedOn: assertString(meta.verified_on, "meta.verified_on"),
      notes: assertArray(meta.notes, "meta.notes", 1).map((note, index) =>
        assertString(note, `meta.notes[${index}]`),
      ),
    },
    provenance: normalizeProvenance(root.provenance),
    demandIndustries,
    tiles: normalizeTiles(root.tiles),
  };
}

function renderGenerated(data) {
  return `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/merchant-tiles.yaml

export const MERCHANT_TILE_DATA_META = ${JSON.stringify(data.meta, null, 2)} as const;

export const MERCHANT_TILE_DATA_PROVENANCE = ${JSON.stringify(data.provenance, null, 2)} as const;

export const MERCHANT_DEMAND_INDUSTRIES = ${JSON.stringify(data.demandIndustries, null, 2)} as const;

export const MERCHANT_TILE_COUNTS_BY_PLAYER_COUNT = ${JSON.stringify(EXPECTED_ELIGIBLE_COUNTS, null, 2)} as const;

export const MERCHANT_TILE_CATALOG = ${JSON.stringify(data.tiles, null, 2)} as const;

export type RulesMerchantDemandIndustry = typeof MERCHANT_DEMAND_INDUSTRIES[number];
export type RulesMerchantTile = typeof MERCHANT_TILE_CATALOG[number];
export type RulesMerchantTileId = RulesMerchantTile["id"];
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check") || args.length > 1) {
    throw new Error(
      "Usage: node scripts/rules/build-merchant-tile-data.mjs [--check]",
    );
  }

  const raw = await fs.readFile(INPUT, "utf8");
  const data = validateAndNormalize(parse(raw));
  const generated = renderGenerated(data);

  if (args.includes("--check")) {
    let existing;
    try {
      existing = await fs.readFile(OUTPUT, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw new Error(
          `${path.relative(ROOT, OUTPUT)} is missing; run the Merchant tile data generator.`,
        );
      }
      throw error;
    }
    if (existing !== generated) {
      throw new Error(
        `${path.relative(ROOT, OUTPUT)} is stale; run the Merchant tile data generator.`,
      );
    }
    console.log(`${path.relative(ROOT, OUTPUT)} is up to date.`);
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, generated, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

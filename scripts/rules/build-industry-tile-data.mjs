import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(
  ROOT,
  "docs",
  "rules-data",
  "industry-tiles-v2.yaml",
);
const OUTPUT = path.join(
  ROOT,
  "src",
  "engine",
  "rules",
  "generated",
  "industry-tiles-v2.ts",
);
const CHECK = process.argv.includes("--check");

const CANONICAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const FORBIDDEN_MARKER = /\b(?:todo|tbd|unknown|placeholder)\b/i;
const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);
const ERAS = new Set(["canal_only", "rail_only", "either"]);
const KIND_ORDER = [
  "manufacturer",
  "cotton",
  "brewery",
  "coal",
  "pottery",
  "iron",
];
const EXPECTED_KIND_COUNTS = {
  manufacturer: 11,
  cotton: 11,
  brewery: 7,
  coal: 7,
  pottery: 5,
  iron: 4,
};
const EXPECTED_MAX_LEVEL = {
  manufacturer: 8,
  cotton: 4,
  brewery: 4,
  coal: 4,
  pottery: 5,
  iron: 4,
};
const EXPECTED_CANAL_ONLY = new Set([
  "manufacturer-1",
  "cotton-1",
  "brewery-1",
  "coal-1",
  "iron-1",
]);
const EXPECTED_RAIL_ONLY = new Set(["brewery-4", "pottery-5"]);
const EXPECTED_NOT_DEVELOPABLE = new Set(["pottery-1", "pottery-3"]);

function fail(message) {
  throw new Error(`industry-tiles-v2.yaml: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) {
    fail(`${label} must be a mapping.`);
  }
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
  if (FORBIDDEN_MARKER.test(value)) {
    fail(`${label} contains an unresolved marker.`);
  }
  return value.trim();
}

function assertCanonicalId(value, label) {
  const id = assertString(value, label);
  if (!CANONICAL_ID.test(id)) {
    fail(`${label} must be a canonical kebab-case ID.`);
  }
  return id;
}

function assertSourceId(value, label) {
  const id = assertString(value, label);
  if (!SOURCE_ID.test(id)) {
    fail(`${label} must be a snake_case source ID.`);
  }
  return id;
}

function assertHttpsUrl(value, label) {
  const url = assertString(value, label);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:") {
    fail(`${label} must use HTTPS.`);
  }
  return url;
}

function assertIntegerInRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    fail(`${label} must be a boolean.`);
  }
  return value;
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`);
  }
  return value;
}

function assertStringArray(value, label, { allowEmpty = false } = {}) {
  const values = assertArray(value, label).map((entry, index) =>
    assertCanonicalId(entry, `${label}[${index}]`),
  );
  if (!allowEmpty && values.length === 0) {
    fail(`${label} must not be empty.`);
  }
  if (new Set(values).size !== values.length) {
    fail(`${label} must not contain duplicates.`);
  }
  return values;
}

function validateMetadata(value) {
  const metadata = assertRecord(value, "metadata");
  assertExactKeys(
    metadata,
    ["ruleset", "title", "per_player_tile_count", "source_note"],
    "metadata",
  );
  const normalized = {
    ruleset: assertString(metadata.ruleset, "metadata.ruleset"),
    title: assertString(metadata.title, "metadata.title"),
    perPlayerTileCount: assertIntegerInRange(
      metadata.per_player_tile_count,
      45,
      45,
      "metadata.per_player_tile_count",
    ),
    sourceNote: assertString(metadata.source_note, "metadata.source_note"),
  };
  return normalized;
}

function validateSources(value) {
  const sources = assertRecord(value, "sources");
  if (Object.keys(sources).length < 2) {
    fail("sources must contain primary evidence and an independent cross-check.");
  }
  return Object.fromEntries(
    Object.entries(sources).map(([rawId, rawSource]) => {
      assertSourceId(rawId, `sources.${rawId}`);
      const source = assertRecord(rawSource, `sources.${rawId}`);
      assertExactKeys(source, ["url", "role"], `sources.${rawId}`);
      return [
        rawId,
        {
          url: assertHttpsUrl(source.url, `sources.${rawId}.url`),
          role: assertString(source.role, `sources.${rawId}.role`),
        },
      ];
    }),
  );
}

function validateKindMetadata(kindOrderValue, countValue) {
  const kindOrder = assertArray(kindOrderValue, "kind_order").map(
    (kind, index) => assertCanonicalId(kind, `kind_order[${index}]`),
  );
  if (JSON.stringify(kindOrder) !== JSON.stringify(KIND_ORDER)) {
    fail(`kind_order must be ${KIND_ORDER.join(", ")} in that order.`);
  }

  const expectedCounts = assertRecord(countValue, "expected_kind_counts");
  assertExactKeys(expectedCounts, KIND_ORDER, "expected_kind_counts");
  for (const kind of KIND_ORDER) {
    if (expectedCounts[kind] !== EXPECTED_KIND_COUNTS[kind]) {
      fail(
        `expected_kind_counts.${kind} must be ${EXPECTED_KIND_COUNTS[kind]}.`,
      );
    }
  }
}

function validateBuild(value, label) {
  const build = assertRecord(value, label);
  assertExactKeys(build, ["money", "coal", "iron", "era"], label);
  const era = assertString(build.era, `${label}.era`);
  if (!ERAS.has(era)) {
    fail(`${label}.era must be canal_only, rail_only, or either.`);
  }
  return {
    money: assertIntegerInRange(build.money, 0, 30, `${label}.money`),
    coal: assertIntegerInRange(build.coal, 0, 3, `${label}.coal`),
    iron: assertIntegerInRange(build.iron, 0, 3, `${label}.iron`),
    era,
  };
}

function validateProduction(value, label) {
  const production = assertRecord(value, label);
  assertExactKeys(production, ["coal", "iron", "beer"], label);
  const beer = assertRecord(production.beer, `${label}.beer`);
  assertExactKeys(beer, ["canal", "rail"], `${label}.beer`);
  return {
    coal: assertIntegerInRange(production.coal, 0, 8, `${label}.coal`),
    iron: assertIntegerInRange(production.iron, 0, 8, `${label}.iron`),
    beer: {
      canal: assertIntegerInRange(beer.canal, 0, 2, `${label}.beer.canal`),
      rail: assertIntegerInRange(beer.rail, 0, 2, `${label}.beer.rail`),
    },
  };
}

function validateProvenance(value, label, sourceIds) {
  const provenance = assertRecord(value, label);
  assertExactKeys(
    provenance,
    ["value_sources", "cross_checks", "confidence"],
    label,
  );
  const valueSources = assertArray(
    provenance.value_sources,
    `${label}.value_sources`,
  ).map((sourceId, index) =>
    assertSourceId(sourceId, `${label}.value_sources[${index}]`),
  );
  const crossChecks = assertArray(
    provenance.cross_checks,
    `${label}.cross_checks`,
  ).map((sourceId, index) =>
    assertSourceId(sourceId, `${label}.cross_checks[${index}]`),
  );
  if (valueSources.length === 0 || crossChecks.length === 0) {
    fail(`${label} must include value sources and independent cross-checks.`);
  }
  if (
    new Set(valueSources).size !== valueSources.length ||
    new Set(crossChecks).size !== crossChecks.length
  ) {
    fail(`${label} source lists must not contain duplicates.`);
  }
  for (const sourceId of [...valueSources, ...crossChecks]) {
    if (!sourceIds.has(sourceId)) {
      fail(`${label} references unregistered source ${sourceId}.`);
    }
  }
  if (valueSources.some((sourceId) => crossChecks.includes(sourceId))) {
    fail(`${label} must keep value sources and cross-checks distinct.`);
  }
  const confidence = assertString(provenance.confidence, `${label}.confidence`);
  if (!CONFIDENCE_LEVELS.has(confidence)) {
    fail(`${label}.confidence must be low, medium, or high.`);
  }
  return { valueSources, crossChecks, confidence };
}

function validateIndustryProduction(face, label) {
  const { industry, production, beerToSell } = face;
  if (industry === "brewery") {
    if (
      production.coal !== 0 ||
      production.iron !== 0 ||
      production.beer.canal !== 1 ||
      production.beer.rail !== 2 ||
      beerToSell !== 0
    ) {
      fail(`${label} must produce one Canal-era and two Rail-era beer.`);
    }
    return;
  }
  if (industry === "coal") {
    if (
      production.coal === 0 ||
      production.iron !== 0 ||
      production.beer.canal !== 0 ||
      production.beer.rail !== 0 ||
      beerToSell !== 0
    ) {
      fail(`${label} must produce coal only.`);
    }
    return;
  }
  if (industry === "iron") {
    if (
      production.iron === 0 ||
      production.coal !== 0 ||
      production.beer.canal !== 0 ||
      production.beer.rail !== 0 ||
      beerToSell !== 0
    ) {
      fail(`${label} must produce iron only.`);
    }
    return;
  }
  if (
    production.coal !== 0 ||
    production.iron !== 0 ||
    production.beer.canal !== 0 ||
    production.beer.rail !== 0
  ) {
    fail(`${label} is a sale industry and must not produce resources.`);
  }
}

function validateFaces(value, sources) {
  const rawFaces = assertArray(value, "faces");
  const seenFaceIds = new Set();
  const seenPhysicalIds = new Set();
  const sourceIds = new Set(Object.keys(sources));

  const faces = rawFaces.map((rawFace, index) => {
    const label = `faces[${index}]`;
    const face = assertRecord(rawFace, label);
    assertExactKeys(
      face,
      [
        "face_id",
        "industry",
        "level",
        "stack_order",
        "copies",
        "physical_ids",
        "build",
        "production",
        "beer_to_sell",
        "income_steps",
        "victory_points",
        "link_icons",
        "developable",
        "provenance",
      ],
      label,
    );

    const faceId = assertCanonicalId(face.face_id, `${label}.face_id`);
    if (seenFaceIds.has(faceId)) {
      fail(`duplicate face ID ${faceId}.`);
    }
    seenFaceIds.add(faceId);

    const industry = assertCanonicalId(face.industry, `${label}.industry`);
    if (!KIND_ORDER.includes(industry)) {
      fail(`${label}.industry is not supported.`);
    }
    const level = assertIntegerInRange(
      face.level,
      1,
      EXPECTED_MAX_LEVEL[industry],
      `${label}.level`,
    );
    if (faceId !== `${industry}-${level}`) {
      fail(`${label}.face_id must be ${industry}-${level}.`);
    }
    const stackOrder = assertIntegerInRange(
      face.stack_order,
      1,
      EXPECTED_MAX_LEVEL[industry],
      `${label}.stack_order`,
    );
    if (stackOrder !== level) {
      fail(`${label}.stack_order must equal its printed level.`);
    }

    const copies = assertIntegerInRange(face.copies, 1, 3, `${label}.copies`);
    const physicalIds = assertStringArray(
      face.physical_ids,
      `${label}.physical_ids`,
    );
    if (physicalIds.length !== copies) {
      fail(`${label}.physical_ids must contain exactly ${copies} IDs.`);
    }
    const expectedPhysicalIds = Array.from(
      { length: copies },
      (_, copyIndex) => `${faceId}-${String.fromCharCode(97 + copyIndex)}`,
    );
    if (JSON.stringify(physicalIds) !== JSON.stringify(expectedPhysicalIds)) {
      fail(`${label}.physical_ids must be ${expectedPhysicalIds.join(", ")}.`);
    }
    for (const physicalId of physicalIds) {
      if (seenPhysicalIds.has(physicalId)) {
        fail(`duplicate physical tile ID ${physicalId}.`);
      }
      seenPhysicalIds.add(physicalId);
    }

    const normalized = {
      faceId,
      industry,
      level,
      stackOrder,
      copies,
      physicalIds,
      build: validateBuild(face.build, `${label}.build`),
      production: validateProduction(face.production, `${label}.production`),
      beerToSell: assertIntegerInRange(
        face.beer_to_sell,
        0,
        2,
        `${label}.beer_to_sell`,
      ),
      incomeSteps: assertIntegerInRange(
        face.income_steps,
        0,
        10,
        `${label}.income_steps`,
      ),
      victoryPoints: assertIntegerInRange(
        face.victory_points,
        0,
        25,
        `${label}.victory_points`,
      ),
      linkIcons: assertIntegerInRange(
        face.link_icons,
        0,
        2,
        `${label}.link_icons`,
      ),
      developable: assertBoolean(face.developable, `${label}.developable`),
      provenance: validateProvenance(
        face.provenance,
        `${label}.provenance`,
        sourceIds,
      ),
    };
    validateIndustryProduction(normalized, label);
    return normalized;
  });

  const actualOrder = faces.map((face) => face.industry);
  const expectedOrder = KIND_ORDER.flatMap((kind) =>
    Array.from(
      { length: EXPECTED_MAX_LEVEL[kind] },
      () => kind,
    ),
  );
  if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
    fail("faces must be grouped in kind_order and ascending stack order.");
  }

  for (const kind of KIND_ORDER) {
    const kindFaces = faces.filter((face) => face.industry === kind);
    const expectedLevels = Array.from(
      { length: EXPECTED_MAX_LEVEL[kind] },
      (_, index) => index + 1,
    );
    if (
      JSON.stringify(kindFaces.map((face) => face.level)) !==
      JSON.stringify(expectedLevels)
    ) {
      fail(`${kind} faces must contain each level once in ascending order.`);
    }
    const physicalCount = kindFaces.reduce((sum, face) => sum + face.copies, 0);
    if (physicalCount !== EXPECTED_KIND_COUNTS[kind]) {
      fail(`${kind} must contain ${EXPECTED_KIND_COUNTS[kind]} physical tiles.`);
    }
  }

  if (seenPhysicalIds.size !== 45) {
    fail(`the per-player manifest must contain 45 physical tiles, got ${seenPhysicalIds.size}.`);
  }

  const canalOnly = new Set(
    faces.filter((face) => face.build.era === "canal_only").map((face) => face.faceId),
  );
  const railOnly = new Set(
    faces.filter((face) => face.build.era === "rail_only").map((face) => face.faceId),
  );
  const notDevelopable = new Set(
    faces.filter((face) => !face.developable).map((face) => face.faceId),
  );
  for (const [actual, expected, label] of [
    [canalOnly, EXPECTED_CANAL_ONLY, "Canal-only faces"],
    [railOnly, EXPECTED_RAIL_ONLY, "Rail-only faces"],
    [notDevelopable, EXPECTED_NOT_DEVELOPABLE, "non-developable faces"],
  ]) {
    if (
      JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())
    ) {
      fail(`${label} do not match the authoritative rules.`);
    }
  }

  return faces;
}

function renderExport(name, value) {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
}

function renderGenerated(metadata, sources, faces) {
  const tiles = faces.flatMap((face) =>
    face.physicalIds.map((physicalId, copyIndex) => ({
      id: physicalId,
      physicalId,
      faceId: face.faceId,
      industry: face.industry,
      level: face.level,
      stackOrder: face.stackOrder,
      copyIndex,
      build: face.build,
      production: face.production,
      beerToSell: face.beerToSell,
      incomeSteps: face.incomeSteps,
      victoryPoints: face.victoryPoints,
      linkIcons: face.linkIcons,
      developable: face.developable,
    })),
  );
  const faceIndexEntries = faces
    .map(
      (face, index) =>
        `  ${JSON.stringify(face.faceId)}: INDUSTRY_TILE_FACES[${index}],`,
    )
    .join("\n");
  const tileIndexEntries = tiles
    .map(
      (tile, index) =>
        `  ${JSON.stringify(tile.id)}: INDUSTRY_TILES[${index}],`,
    )
    .join("\n");
  const stackEntries = KIND_ORDER.map(
    (kind) =>
      `  ${JSON.stringify(kind)}: INDUSTRY_TILES.filter((tile) => tile.industry === ${JSON.stringify(kind)}),`,
  ).join("\n");

  return [
    "// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n",
    "// Source: docs/rules-data/industry-tiles-v2.yaml\n\n",
    "export const INDUSTRY_TILE_DATA_VERSION = 2 as const;\n\n",
    renderExport("INDUSTRY_TILE_METADATA", metadata),
    "\n",
    renderExport("INDUSTRY_TILE_SOURCES", sources),
    "\n",
    renderExport("INDUSTRY_TILE_KIND_ORDER", KIND_ORDER),
    "\n",
    renderExport("INDUSTRY_TILE_EXPECTED_KIND_COUNTS", EXPECTED_KIND_COUNTS),
    "\n",
    renderExport("INDUSTRY_TILE_FACES", faces),
    "\n",
    "export type IndustryTileFace = (typeof INDUSTRY_TILE_FACES)[number];\n",
    "export type IndustryTileFaceId = IndustryTileFace[\"faceId\"];\n\n",
    "export const INDUSTRY_TILE_FACE_BY_ID = {\n",
    faceIndexEntries,
    "\n} as const satisfies Record<IndustryTileFaceId, IndustryTileFace>;\n",
    "\n",
    renderExport("INDUSTRY_TILES", tiles),
    "\n",
    "export type IndustryTile = (typeof INDUSTRY_TILES)[number];\n",
    "export type IndustryTileId = IndustryTile[\"id\"];\n",
    "export type IndustryTileKind = (typeof INDUSTRY_TILE_KIND_ORDER)[number];\n\n",
    "export const INDUSTRY_TILE_BY_ID = {\n",
    tileIndexEntries,
    "\n} as const satisfies Record<IndustryTileId, IndustryTile>;\n",
    "\n",
    "export const INDUSTRY_TILE_STACKS = {\n",
    stackEntries,
    "\n} satisfies Record<IndustryTileKind, readonly IndustryTile[]>;\n",
  ].join("");
}

async function main() {
  const raw = await fs.readFile(INPUT, "utf8");
  if (FORBIDDEN_MARKER.test(raw)) {
    fail("source contains an unresolved marker.");
  }
  const parsed = assertRecord(parse(raw), "document");
  assertExactKeys(
    parsed,
    [
      "schema_version",
      "metadata",
      "sources",
      "kind_order",
      "expected_kind_counts",
      "faces",
    ],
    "document",
  );
  if (parsed.schema_version !== 2) {
    fail("schema_version must be 2.");
  }

  const metadata = validateMetadata(parsed.metadata);
  const sources = validateSources(parsed.sources);
  validateKindMetadata(parsed.kind_order, parsed.expected_kind_counts);
  const faces = validateFaces(parsed.faces, sources);
  const generated = renderGenerated(metadata, sources, faces);

  if (CHECK) {
    const current = await fs.readFile(OUTPUT, "utf8").catch(() => "");
    if (current !== generated) {
      throw new Error(
        `${path.relative(ROOT, OUTPUT)} is stale. Run node scripts/rules/build-industry-tile-data.mjs.`,
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

import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "docs", "rules-data", "cards.yaml");
const OUTPUT = path.join(
  ROOT,
  "src",
  "engine",
  "rules",
  "generated",
  "cards.ts",
);

const PLAYER_COUNTS = [2, 3, 4];
const EXPECTED_DECK_SIZES = { 2: 40, 3: 54, 4: 64 };
const CANONICAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);
const SUPPORTED_INDUSTRIES = new Set([
  "brewery",
  "coal",
  "cotton",
  "iron",
  "manufactured",
  "pottery",
]);

const EXPECTED_LOCATION_IDS = [
  "belper",
  "birmingham",
  "burton-on-trent",
  "cannock",
  "coalbrookdale",
  "coventry",
  "derby",
  "dudley",
  "kidderminster",
  "leek",
  "nuneaton",
  "redditch",
  "stafford",
  "stoke-on-trent",
  "stone",
  "tamworth",
  "uttoxeter",
  "walsall",
  "wolverhampton",
  "worcester",
];

const EXPECTED_INDUSTRY_TEMPLATES = new Map([
  ["industry-brewery", ["brewery"]],
  ["industry-coal-mine", ["coal"]],
  ["industry-iron-works", ["iron"]],
  [
    "industry-manufactured-goods-cotton-mill",
    ["manufactured", "cotton"],
  ],
  ["industry-pottery", ["pottery"]],
]);

function fail(message) {
  throw new Error(`cards.yaml: ${message}`);
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
  return value.trim();
}

function assertCanonicalId(value, label) {
  const id = assertString(value, label);
  if (!CANONICAL_ID.test(id)) {
    fail(`${label} must be a canonical kebab-case ID.`);
  }
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
  if (parsed.protocol !== "https:") {
    fail(`${label} must use HTTPS.`);
  }
  return url;
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer.`);
  }
  return value;
}

function validateCopies(value, label) {
  const copies = assertRecord(value, `${label}.copies`);
  assertExactKeys(copies, PLAYER_COUNTS.map(String), `${label}.copies`);

  const normalized = Object.fromEntries(
    PLAYER_COUNTS.map((playerCount) => [
      playerCount,
      assertNonNegativeInteger(
        copies[playerCount],
        `${label}.copies.${playerCount}`,
      ),
    ]),
  );

  if (!(normalized[2] <= normalized[3] && normalized[3] <= normalized[4])) {
    fail(`${label}.copies must be monotonic for 2, 3, and 4 players.`);
  }
  if (normalized[4] === 0) {
    fail(`${label} must contribute at least one card at 4 players.`);
  }
  return normalized;
}

function validateProvenance(value) {
  const provenance = assertRecord(value, "meta.provenance");
  assertExactKeys(
    provenance,
    ["primary_rules", "component_reference", "source_note", "confidence"],
    "meta.provenance",
  );
  const confidence = assertString(
    provenance.confidence,
    "meta.provenance.confidence",
  );
  if (!CONFIDENCE_LEVELS.has(confidence)) {
    fail("meta.provenance.confidence must be low, medium, or high.");
  }
  return {
    primaryRules: assertUrl(
      provenance.primary_rules,
      "meta.provenance.primary_rules",
    ),
    componentReference: assertUrl(
      provenance.component_reference,
      "meta.provenance.component_reference",
    ),
    sourceNote: assertString(
      provenance.source_note,
      "meta.provenance.source_note",
    ),
    confidence,
  };
}

function validateWildSupply(value) {
  const wildSupply = assertRecord(value, "wild_supply");
  assertExactKeys(wildSupply, ["location", "industry"], "wild_supply");
  const normalized = {
    location: assertNonNegativeInteger(
      wildSupply.location,
      "wild_supply.location",
    ),
    industry: assertNonNegativeInteger(
      wildSupply.industry,
      "wild_supply.industry",
    ),
  };
  if (normalized.location !== 4 || normalized.industry !== 4) {
    fail("wild_supply must contain exactly 4 location and 4 industry cards.");
  }
  return normalized;
}

function validateLocationTemplate(template, index, id, copies) {
  const label = `templates[${index}]`;
  assertExactKeys(template, ["id", "kind", "location", "copies"], label);
  const location = assertCanonicalId(template.location, `${label}.location`);
  if (id !== `location-${location}`) {
    fail(`${label}.id must be location-${location}.`);
  }
  return { id, kind: "location", location, copies };
}

function validateIndustryTemplate(template, index, id, copies) {
  const label = `templates[${index}]`;
  assertExactKeys(template, ["id", "kind", "industries", "copies"], label);
  if (!Array.isArray(template.industries) || template.industries.length === 0) {
    fail(`${label}.industries must be a non-empty array.`);
  }
  const industries = template.industries.map((industry, industryIndex) => {
    const normalized = assertCanonicalId(
      industry,
      `${label}.industries[${industryIndex}]`,
    );
    if (!SUPPORTED_INDUSTRIES.has(normalized)) {
      fail(`${label}.industries contains unsupported industry ${normalized}.`);
    }
    return normalized;
  });
  if (new Set(industries).size !== industries.length) {
    fail(`${label}.industries must not contain duplicates.`);
  }

  const expectedIndustries = EXPECTED_INDUSTRY_TEMPLATES.get(id);
  if (!expectedIndustries) {
    fail(`${label}.id is not an expected industry card template.`);
  }
  if (JSON.stringify(industries) !== JSON.stringify(expectedIndustries)) {
    fail(
      `${label}.industries must be ${expectedIndustries.join(", ")} in that order.`,
    );
  }
  return { id, kind: "industry", industries, copies };
}

function validateTemplates(value) {
  if (!Array.isArray(value)) {
    fail("templates must be an array.");
  }

  const seenIds = new Set();
  const templates = value.map((rawTemplate, index) => {
    const label = `templates[${index}]`;
    const template = assertRecord(rawTemplate, label);
    const id = assertCanonicalId(template.id, `${label}.id`);
    if (seenIds.has(id)) {
      fail(`duplicate template ID ${id}.`);
    }
    seenIds.add(id);

    const kind = assertString(template.kind, `${label}.kind`);
    const copies = validateCopies(template.copies, label);
    if (kind === "location") {
      return validateLocationTemplate(template, index, id, copies);
    }
    if (kind === "industry") {
      return validateIndustryTemplate(template, index, id, copies);
    }
    fail(`${label}.kind must be location or industry.`);
  });

  const expectedTemplateIds = [
    ...EXPECTED_LOCATION_IDS.map((location) => `location-${location}`),
    ...EXPECTED_INDUSTRY_TEMPLATES.keys(),
  ].sort();
  const actualTemplateIds = [...seenIds].sort();
  if (JSON.stringify(actualTemplateIds) !== JSON.stringify(expectedTemplateIds)) {
    fail("templates must contain the complete 20-location and 5-industry catalog.");
  }

  const multiIconTemplates = templates.filter(
    (template) =>
      template.kind === "industry" && template.industries.length > 1,
  );
  if (
    multiIconTemplates.length !== 1 ||
    multiIconTemplates[0].id !==
      "industry-manufactured-goods-cotton-mill"
  ) {
    fail(
      "only industry-manufactured-goods-cotton-mill may have multiple icons.",
    );
  }

  return templates.sort((a, b) => a.id.localeCompare(b.id));
}

function expandPhysicalCards(templates) {
  const cards = [];
  for (const template of templates) {
    for (let copy = 1; copy <= template.copies[4]; copy += 1) {
      const includedAt = PLAYER_COUNTS.filter(
        (playerCount) => copy <= template.copies[playerCount],
      );
      cards.push({
        id: `${template.id}-${String(copy).padStart(2, "0")}`,
        templateId: template.id,
        kind: template.kind,
        ...(template.kind === "location"
          ? { location: template.location }
          : { industries: template.industries }),
        includedAt,
      });
    }
  }

  const ids = cards.map((card) => card.id);
  if (new Set(ids).size !== ids.length) {
    fail("physical card expansion produced duplicate IDs.");
  }
  if (cards.length !== EXPECTED_DECK_SIZES[4]) {
    fail(`physical card catalog must contain ${EXPECTED_DECK_SIZES[4]} cards.`);
  }

  for (const playerCount of PLAYER_COUNTS) {
    const actual = cards.filter((card) =>
      card.includedAt.includes(playerCount),
    ).length;
    if (actual !== EXPECTED_DECK_SIZES[playerCount]) {
      fail(
        `${playerCount}-player deck contains ${actual} cards; expected ${EXPECTED_DECK_SIZES[playerCount]}.`,
      );
    }
  }
  return cards;
}

function validateAndNormalize(parsed) {
  const root = assertRecord(parsed, "document");
  assertExactKeys(root, ["meta", "wild_supply", "templates"], "document");

  const meta = assertRecord(root.meta, "meta");
  assertExactKeys(meta, ["schema_version", "ruleset", "provenance"], "meta");
  if (meta.schema_version !== 1) {
    fail("meta.schema_version must be 1.");
  }

  const templates = validateTemplates(root.templates);
  return {
    ruleset: assertString(meta.ruleset, "meta.ruleset"),
    provenance: validateProvenance(meta.provenance),
    wildSupply: validateWildSupply(root.wild_supply),
    templates,
    cards: expandPhysicalCards(templates),
  };
}

function renderGenerated(data) {
  return `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Source: docs/rules-data/cards.yaml

export const CARD_DATA_RULESET = ${JSON.stringify(data.ruleset)} as const;

export const CARD_DATA_PROVENANCE = ${JSON.stringify(data.provenance, null, 2)} as const;

export const WILD_CARD_SUPPLY = ${JSON.stringify(data.wildSupply, null, 2)} as const;

export const DRAW_DECK_SIZE_BY_PLAYER_COUNT = ${JSON.stringify(EXPECTED_DECK_SIZES, null, 2)} as const;

export const CARD_TEMPLATES = ${JSON.stringify(data.templates, null, 2)} as const;

export const CARD_CATALOG = ${JSON.stringify(data.cards, null, 2)} as const;

export type RulesCardTemplate = typeof CARD_TEMPLATES[number];
export type RulesPhysicalCard = typeof CARD_CATALOG[number];
export type RulesPhysicalCardId = RulesPhysicalCard["id"];
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check") || args.length > 1) {
    throw new Error("Usage: node scripts/rules/build-card-data.mjs [--check]");
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
          `${path.relative(ROOT, OUTPUT)} is missing; run the card data generator.`,
        );
      }
      throw error;
    }
    if (existing !== generated) {
      throw new Error(
        `${path.relative(ROOT, OUTPUT)} is stale; run the card data generator.`,
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

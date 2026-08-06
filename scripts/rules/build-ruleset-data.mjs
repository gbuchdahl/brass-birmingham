import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "docs", "rules-data");
const OUTPUT = path.join(
  ROOT,
  "src",
  "engine",
  "rules",
  "generated",
  "ruleset.ts",
);
const CHECK = process.argv.includes("--check");
const PLAYER_COUNTS = [2, 3, 4];

async function readYaml(name) {
  return parse(await fs.readFile(path.join(DATA_DIR, name), "utf8"));
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (/placeholder|unknown|todo/i.test(value)) {
    throw new Error(`${label} contains an unresolved value.`);
  }
  return value;
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }
  return value;
}

function validateProvenance(document, sources, label) {
  const provenance = assertObject(document.provenance, `${label}.provenance`);
  const sourceIds = assertStringArray(
    provenance.sources,
    `${label}.provenance.sources`,
  );
  if (sourceIds.length === 0) {
    throw new Error(`${label}.provenance.sources must not be empty.`);
  }
  for (const sourceId of sourceIds) {
    if (!sources[sourceId]) {
      throw new Error(`${label} references unknown source ${sourceId}.`);
    }
  }
  return {
    sources: sourceIds,
    detail: assertString(provenance.detail, `${label}.provenance.detail`),
  };
}

function validateMarket(value, label) {
  const market = assertObject(value, label);
  const prices = market.fill_order_prices;
  if (
    !Array.isArray(prices) ||
    prices.length === 0 ||
    prices.some((price) => !Number.isInteger(price) || price <= 0)
  ) {
    throw new Error(`${label}.fill_order_prices must contain positive integers.`);
  }
  for (let index = 1; index < prices.length; index += 1) {
    if (prices[index] > prices[index - 1]) {
      throw new Error(`${label}.fill_order_prices must be non-increasing.`);
    }
  }

  const initialUnits = assertPositiveInteger(
    market.initial_units,
    `${label}.initial_units`,
  );
  if (initialUnits > prices.length) {
    throw new Error(`${label}.initial_units exceeds market capacity.`);
  }
  const fallbackPrice = assertPositiveInteger(
    market.fallback_price,
    `${label}.fallback_price`,
  );
  if (fallbackPrice <= prices[0]) {
    throw new Error(`${label}.fallback_price must exceed printed market prices.`);
  }

  return { fillOrderPrices: prices, initialUnits, fallbackPrice };
}

async function main() {
  const [ruleset, marketsDocument, setupDocument] = await Promise.all([
    readYaml("ruleset.yaml"),
    readYaml("markets.yaml"),
    readYaml("setup.yaml"),
  ]);

  const sourcesDocument = assertObject(ruleset.sources, "ruleset.sources");
  const sources = {};
  for (const [sourceId, value] of Object.entries(sourcesDocument)) {
    const source = assertObject(value, `ruleset.sources.${sourceId}`);
    sources[sourceId] = {
      role: assertString(source.role, `ruleset.sources.${sourceId}.role`),
      url: assertString(source.url, `ruleset.sources.${sourceId}.url`),
    };
  }

  const meta = {
    schemaVersion: assertPositiveInteger(
      ruleset.schema_version,
      "ruleset.schema_version",
    ),
    id: assertString(ruleset.id, "ruleset.id"),
    version: assertString(ruleset.version, "ruleset.version"),
    sources,
  };

  const marketsBlock = assertObject(marketsDocument.markets, "markets.markets");
  const markets = {
    coal: validateMarket(marketsBlock.coal, "markets.coal"),
    iron: validateMarket(marketsBlock.iron, "markets.iron"),
  };
  const marketsProvenance = validateProvenance(
    marketsDocument,
    sources,
    "markets",
  );

  const sharedDocument = assertObject(setupDocument.shared, "setup.shared");
  const shared = {
    handSize: assertPositiveInteger(sharedDocument.hand_size, "setup.shared.hand_size"),
    initialDiscardPerPlayer: assertPositiveInteger(
      sharedDocument.initial_discard_per_player,
      "setup.shared.initial_discard_per_player",
    ),
    startingMoney: assertPositiveInteger(
      sharedDocument.starting_money,
      "setup.shared.starting_money",
    ),
    startingIncomeSpace: assertPositiveInteger(
      sharedDocument.starting_income_space,
      "setup.shared.starting_income_space",
    ),
    linksPerPlayer: assertPositiveInteger(
      sharedDocument.links_per_player,
      "setup.shared.links_per_player",
    ),
    industryTilesPerPlayer: assertPositiveInteger(
      sharedDocument.industry_tiles_per_player,
      "setup.shared.industry_tiles_per_player",
    ),
    wildLocationCards: assertPositiveInteger(
      sharedDocument.wild_location_cards,
      "setup.shared.wild_location_cards",
    ),
    wildIndustryCards: assertPositiveInteger(
      sharedDocument.wild_industry_cards,
      "setup.shared.wild_industry_cards",
    ),
  };

  const playerCountDocument = assertObject(
    setupDocument.player_counts,
    "setup.player_counts",
  );
  const eraDocument = assertObject(setupDocument.eras, "setup.eras");
  const eras = {};
  for (const era of ["canal", "rail"]) {
    const value = assertObject(eraDocument[era], `setup.eras.${era}`);
    eras[era] = {
      firstRoundActions: assertPositiveInteger(
        value.first_round_actions,
        `setup.eras.${era}.first_round_actions`,
      ),
      laterRoundActions: assertPositiveInteger(
        value.later_round_actions,
        `setup.eras.${era}.later_round_actions`,
      ),
    };
  }
  const playerCounts = {};
  for (const playerCount of PLAYER_COUNTS) {
    const label = `setup.player_counts.${playerCount}`;
    const value = assertObject(playerCountDocument[String(playerCount)], label);
    const roundsPerEra = assertPositiveInteger(
      value.rounds_per_era,
      `${label}.rounds_per_era`,
    );
    const regularCards = assertPositiveInteger(
      value.regular_cards,
      `${label}.regular_cards`,
    );
    const expectedCards = playerCount * roundsPerEra * 2;
    if (regularCards !== expectedCards) {
      throw new Error(
        `${label}.regular_cards must equal player count × rounds × 2 (${expectedCards}).`,
      );
    }
    const canalCardsUsed =
      playerCount * (1 + (roundsPerEra - 1) * 2) +
      playerCount * shared.initialDiscardPerPlayer;
    if (regularCards !== canalCardsUsed) {
      throw new Error(`${label}.regular_cards does not support Canal setup.`);
    }
    playerCounts[playerCount] = {
      roundsPerEra,
      regularCards,
      activeMerchantSlots: assertPositiveInteger(
        value.active_merchant_slots,
        `${label}.active_merchant_slots`,
      ),
      merchantLocations: assertStringArray(
        value.merchant_locations,
        `${label}.merchant_locations`,
      ),
      excludedLocationBannerColors: assertStringArray(
        value.excluded_location_banner_colors,
        `${label}.excluded_location_banner_colors`,
      ),
    };
  }

  const setup = {
    provenance: validateProvenance(setupDocument, sources, "setup"),
    shared,
    eras,
    playerCounts,
  };

  const generated = `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Sources: docs/rules-data/ruleset.yaml, markets.yaml, setup.yaml\n\nexport const RULESET_META = ${JSON.stringify(meta, null, 2)} as const;\n\nexport const MARKET_DATA = ${JSON.stringify({ provenance: marketsProvenance, ...markets }, null, 2)} as const;\n\nexport const SETUP_DATA = ${JSON.stringify(setup, null, 2)} as const;\n`;

  if (CHECK) {
    const current = await fs.readFile(OUTPUT, "utf8").catch(() => "");
    if (current !== generated) {
      throw new Error(
        `${path.relative(ROOT, OUTPUT)} is stale. Run pnpm rules:generate:ruleset.`,
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

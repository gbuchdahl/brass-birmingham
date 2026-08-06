import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "docs", "rules-data", "income-track.yaml");
const OUTPUT = path.join(
  ROOT,
  "src",
  "engine",
  "rules",
  "generated",
  "income-track.ts",
);
const args = process.argv.slice(2);
const CHECK = args.includes("--check");

if (args.some((argument) => argument !== "--check")) {
  throw new Error(`Unknown argument(s): ${args.filter((argument) => argument !== "--check").join(", ")}`);
}
if (args.filter((argument) => argument === "--check").length > 1) {
  throw new Error("--check may only be provided once.");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must have exactly these keys: ${expected.join(", ")}.`);
  }
}

function assertInteger(value, label) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value;
}

function assertPositiveInteger(value, label) {
  const result = assertInteger(value, label);
  if (result <= 0) {
    throw new Error(`${label} must be positive.`);
  }
  return result;
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

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function assertLiteral(value, expected, label) {
  if (value !== expected) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}.`);
  }
  return value;
}

function validateProvenance(value) {
  const provenance = assertObject(value, "provenance");
  assertExactKeys(provenance, ["confidence", "detail", "sources"], "provenance");
  const confidence = assertLiteral(provenance.confidence, "high", "provenance.confidence");
  const detail = assertString(provenance.detail, "provenance.detail");
  if (!Array.isArray(provenance.sources) || provenance.sources.length < 2) {
    throw new Error("provenance.sources must contain at least two sources.");
  }

  const sourceIds = new Set();
  const sources = provenance.sources.map((rawSource, index) => {
    const label = `provenance.sources[${index}]`;
    const source = assertObject(rawSource, label);
    assertExactKeys(source, ["claims", "id", "role", "url"], label);
    const id = assertString(source.id, `${label}.id`);
    if (sourceIds.has(id)) {
      throw new Error(`${label}.id duplicates ${id}.`);
    }
    sourceIds.add(id);
    const role = assertString(source.role, `${label}.role`);
    const url = assertString(source.url, `${label}.url`);
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`${label}.url must be a valid URL.`);
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error(`${label}.url must use HTTPS.`);
    }
    if (!Array.isArray(source.claims) || source.claims.length === 0) {
      throw new Error(`${label}.claims must be a non-empty array.`);
    }
    const claims = source.claims.map((claim, claimIndex) =>
      assertString(claim, `${label}.claims[${claimIndex}]`),
    );
    if (new Set(claims).size !== claims.length) {
      throw new Error(`${label}.claims must not contain duplicates.`);
    }
    return { id, role, url, claims };
  });

  return { confidence, detail, sources };
}

function expectedBandWidth(incomeLevel) {
  if (incomeLevel <= 0) return 1;
  if (incomeLevel <= 10) return 2;
  if (incomeLevel <= 20) return 3;
  return 4;
}

function validateTrack(value) {
  const track = assertObject(value, "track");
  assertExactKeys(
    track,
    [
      "bands",
      "first_space",
      "last_space",
      "maximum_income_level",
      "minimum_income_level",
      "starting_space",
    ],
    "track",
  );
  const firstSpace = assertLiteral(track.first_space, 0, "track.first_space");
  const lastSpace = assertLiteral(track.last_space, 100, "track.last_space");
  const startingSpace = assertLiteral(track.starting_space, 10, "track.starting_space");
  const minimumIncomeLevel = assertLiteral(
    track.minimum_income_level,
    -10,
    "track.minimum_income_level",
  );
  const maximumIncomeLevel = assertLiteral(
    track.maximum_income_level,
    30,
    "track.maximum_income_level",
  );
  if (!Array.isArray(track.bands)) {
    throw new Error("track.bands must be an array.");
  }
  const expectedBandCount = maximumIncomeLevel - minimumIncomeLevel + 1;
  if (track.bands.length !== expectedBandCount) {
    throw new Error(`track.bands must contain ${expectedBandCount} income levels.`);
  }

  let nextSpace = firstSpace;
  const bands = track.bands.map((rawBand, index) => {
    const label = `track.bands[${index}]`;
    const band = assertObject(rawBand, label);
    assertExactKeys(band, ["first_space", "income_level", "last_space"], label);
    const incomeLevel = assertInteger(band.income_level, `${label}.income_level`);
    const expectedIncomeLevel = minimumIncomeLevel + index;
    if (incomeLevel !== expectedIncomeLevel) {
      throw new Error(`${label}.income_level must be ${expectedIncomeLevel}.`);
    }
    const bandFirstSpace = assertInteger(band.first_space, `${label}.first_space`);
    const bandLastSpace = assertInteger(band.last_space, `${label}.last_space`);
    if (bandFirstSpace !== nextSpace) {
      throw new Error(`${label}.first_space must be contiguous at ${nextSpace}.`);
    }
    if (bandLastSpace < bandFirstSpace) {
      throw new Error(`${label}.last_space must not precede first_space.`);
    }
    const width = bandLastSpace - bandFirstSpace + 1;
    const expectedWidth = expectedBandWidth(incomeLevel);
    if (width !== expectedWidth) {
      throw new Error(`${label} must contain ${expectedWidth} printed space(s).`);
    }
    nextSpace = bandLastSpace + 1;
    return { incomeLevel, firstSpace: bandFirstSpace, lastSpace: bandLastSpace };
  });
  if (nextSpace !== lastSpace + 1) {
    throw new Error(`track.bands must end at space ${lastSpace}.`);
  }

  const spaces = bands.flatMap((band) =>
    Array.from(
      { length: band.lastSpace - band.firstSpace + 1 },
      (_, offset) => ({
        space: band.firstSpace + offset,
        incomeLevel: band.incomeLevel,
      }),
    ),
  );
  if (spaces.length !== 101 || spaces[startingSpace].incomeLevel !== 0) {
    throw new Error("The printed track must contain spaces 0..100 and start at income level 0.");
  }

  return {
    firstSpace,
    lastSpace,
    startingSpace,
    minimumIncomeLevel,
    maximumIncomeLevel,
    bands,
    spaces,
  };
}

function validateRules(value) {
  const rules = assertObject(value, "rules");
  assertExactKeys(rules, ["advance", "end_of_round", "loan"], "rules");

  const advance = assertObject(rules.advance, "rules.advance");
  assertExactKeys(advance, ["ceiling_income_level", "unit"], "rules.advance");
  const validatedAdvance = {
    unit: assertLiteral(advance.unit, "spaces", "rules.advance.unit"),
    ceilingIncomeLevel: assertLiteral(
      advance.ceiling_income_level,
      30,
      "rules.advance.ceiling_income_level",
    ),
  };

  const loan = assertObject(rules.loan, "rules.loan");
  assertExactKeys(
    loan,
    ["income_levels_back", "minimum_target_income_level", "money_received", "target_space"],
    "rules.loan",
  );
  const validatedLoan = {
    moneyReceived: assertLiteral(loan.money_received, 30, "rules.loan.money_received"),
    incomeLevelsBack: assertLiteral(
      loan.income_levels_back,
      3,
      "rules.loan.income_levels_back",
    ),
    minimumTargetIncomeLevel: assertLiteral(
      loan.minimum_target_income_level,
      -10,
      "rules.loan.minimum_target_income_level",
    ),
    targetSpace: assertLiteral(
      loan.target_space,
      "highest-space-in-target-level",
      "rules.loan.target_space",
    ),
  };

  const endOfRound = assertObject(rules.end_of_round, "rules.end_of_round");
  assertExactKeys(
    endOfRound,
    [
      "negative_income_tile_value",
      "remaining_shortfall_vp_loss_per_pound",
      "skip_on_final_round_of_game",
      "tile_removal_stop",
    ],
    "rules.end_of_round",
  );
  const validatedEndOfRound = {
    skipOnFinalRoundOfGame: assertLiteral(
      assertBoolean(
        endOfRound.skip_on_final_round_of_game,
        "rules.end_of_round.skip_on_final_round_of_game",
      ),
      true,
      "rules.end_of_round.skip_on_final_round_of_game",
    ),
    negativeIncomeTileValue: assertLiteral(
      endOfRound.negative_income_tile_value,
      "half-build-cost-rounded-down",
      "rules.end_of_round.negative_income_tile_value",
    ),
    tileRemovalStop: assertLiteral(
      endOfRound.tile_removal_stop,
      "as-soon-as-shortfall-is-covered",
      "rules.end_of_round.tile_removal_stop",
    ),
    remainingShortfallVpLossPerPound: assertLiteral(
      assertPositiveInteger(
        endOfRound.remaining_shortfall_vp_loss_per_pound,
        "rules.end_of_round.remaining_shortfall_vp_loss_per_pound",
      ),
      1,
      "rules.end_of_round.remaining_shortfall_vp_loss_per_pound",
    ),
  };

  return { advance: validatedAdvance, loan: validatedLoan, endOfRound: validatedEndOfRound };
}

async function main() {
  const document = assertObject(parse(await fs.readFile(INPUT, "utf8")), "document");
  assertExactKeys(document, ["provenance", "rules", "schema_version", "track"], "document");
  const schemaVersion = assertLiteral(document.schema_version, 1, "schema_version");
  const generatedData = {
    schemaVersion,
    provenance: validateProvenance(document.provenance),
    track: validateTrack(document.track),
    rules: validateRules(document.rules),
  };
  const generated = `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Source: docs/rules-data/income-track.yaml\n\nexport const INCOME_TRACK_DATA = ${JSON.stringify(generatedData, null, 2)} as const;\n`;

  if (CHECK) {
    const current = await fs.readFile(OUTPUT, "utf8").catch(() => "");
    if (current !== generated) {
      throw new Error(
        `${path.relative(ROOT, OUTPUT)} is stale. Run node scripts/rules/build-income-track-data.mjs.`,
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

import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "docs", "rules-data", "industry-values.yaml");
const OUTPUT = path.join(ROOT, "src", "engine", "rules", "generated", "industry-values.ts");

function assertInteger(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value;
}

function assertSourceNote(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} source_note is required.`);
  }
  if (value.trim().toUpperCase() === "UNKNOWN") {
    throw new Error(`${label} source_note cannot be UNKNOWN.`);
  }
  return value;
}

async function main() {
  const raw = await fs.readFile(INPUT, "utf8");
  const parsed = parse(raw);
  const industries = parsed.industries;
  if (!industries || typeof industries !== "object") {
    throw new Error("industry-values.yaml must include industries.");
  }

  const output = {};

  for (const [industry, industryBlock] of Object.entries(industries)) {
    const levels = industryBlock.levels;
    if (!levels || Object.keys(levels).length === 0) {
      throw new Error(`Industry ${industry} must include levels.`);
    }
    output[industry] = {};
    for (const [levelKey, level] of Object.entries(levels)) {
      const levelNum = Number(levelKey);
      if (!Number.isInteger(levelNum) || levelNum <= 0) {
        throw new Error(`Industry ${industry} has invalid level key: ${levelKey}`);
      }
      const label = `${industry} level ${levelKey}`;
      output[industry][levelNum] = {
        money: assertInteger(level.money_cost, `${label} money_cost`),
        coalRequired: assertInteger(level.coal_required, `${label} coal_required`),
        ironRequired: assertInteger(level.iron_required, `${label} iron_required`),
        cubesProduced: assertInteger(level.cubes_produced, `${label} cubes_produced`),
        incomeOnFlip: assertInteger(level.income_on_flip, `${label} income_on_flip`),
        sourceNote: assertSourceNote(level.source_note, label),
      };
    }
  }

  const generated = `/* eslint-disable */\n// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Source: docs/rules-data/industry-values.yaml\n\nexport const INDUSTRY_LEVEL_DATA = ${JSON.stringify(output, null, 2)} as const;\n`;

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, generated, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

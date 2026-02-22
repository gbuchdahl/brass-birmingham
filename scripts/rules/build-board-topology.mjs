import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "docs", "rules-data", "board-topology.yaml");
const OUTPUT = path.join(ROOT, "src", "engine", "board", "generated", "topology.ts");

const ALLOWED_EDGE_KINDS = new Set(["canal", "rail", "both"]);
const ALLOWED_MAP_ZONES = new Set([
  "northwest",
  "north",
  "northeast",
  "west",
  "center",
  "east",
  "southwest",
  "south",
  "southeast",
]);

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value;
}

function normalizeIndustrySlots(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (
      Array.isArray(entry) &&
      entry.length > 0 &&
      entry.every((choice) => typeof choice === "string")
    ) {
      return entry;
    }

    throw new Error(
      `${label}[${index}] must be a string or a non-empty array of strings.`,
    );
  });
}

async function main() {
  const raw = await fs.readFile(INPUT, "utf8");
  const parsed = parse(raw);

  if (!parsed.cities || typeof parsed.cities !== "object") {
    throw new Error("board-topology.yaml must include cities.");
  }

  const cities = Object.entries(parsed.cities).map(([name, value]) => {
    const slots = normalizeIndustrySlots(value.industries, `City ${name} industries`);
    const industries = slots.flatMap((slot) => slot);
    const mapZone =
      value.map_zone == null
        ? "center"
        : typeof value.map_zone === "string"
          ? value.map_zone
          : null;

    if (!mapZone || !ALLOWED_MAP_ZONES.has(mapZone)) {
      throw new Error(
        `City ${name} map_zone must be one of: ${[...ALLOWED_MAP_ZONES].join(", ")}`,
      );
    }

    return { name, industries, slots, mapZone };
  });

  const ports = assertStringArray(parsed.ports, "ports");
  const nodeSet = new Set([...cities.map((city) => city.name), ...ports]);

  if (!Array.isArray(parsed.edges) || parsed.edges.length === 0) {
    throw new Error("board-topology.yaml must include edges.");
  }

  const seenUndirected = new Set();
  const edges = parsed.edges.map((edge, index) => {
    if (!Array.isArray(edge.nodes) || edge.nodes.length !== 2) {
      throw new Error(`Edge ${index} must include exactly two nodes.`);
    }
    const [a, b] = edge.nodes;
    if (typeof a !== "string" || typeof b !== "string") {
      throw new Error(`Edge ${index} nodes must be strings.`);
    }
    if (!nodeSet.has(a) || !nodeSet.has(b)) {
      throw new Error(`Edge ${index} references unknown node(s): ${a}, ${b}`);
    }
    if (typeof edge.kind !== "string" || !ALLOWED_EDGE_KINDS.has(edge.kind)) {
      throw new Error(`Edge ${index} has invalid kind: ${String(edge.kind)}`);
    }
    const key = [a, b].sort().join("::");
    if (seenUndirected.has(key)) {
      throw new Error(`Duplicate undirected edge detected: ${a}<->${b}`);
    }
    seenUndirected.add(key);
    if (edge.comment != null && typeof edge.comment !== "string") {
      throw new Error(`Edge ${index} comment must be a string when present.`);
    }
    return {
      nodes: [a, b],
      kind: edge.kind,
      ...(edge.comment ? { comment: edge.comment } : {}),
    };
  });

  const cityDefs = {};
  for (const city of cities) {
    cityDefs[city.name] = {
      industries: city.industries,
      slots: city.slots,
      mapZone: city.mapZone,
    };
  }

  const generated = `/* eslint-disable */\n// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Source: docs/rules-data/board-topology.yaml\n\nexport const CITY_DEFS = ${JSON.stringify(cityDefs, null, 2)} as const;\n\nexport const PORT_IDS = ${JSON.stringify(ports, null, 2)} as const;\n\nexport const EDGE_DEFS = ${JSON.stringify(edges, null, 2)} as const;\n`;

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, generated, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

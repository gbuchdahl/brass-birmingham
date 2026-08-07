import {
  GAME_STATE_V2_SCHEMA_VERSION,
  validateGameStateV2,
  type GameStateV2,
  type GameStateV2ValidationError,
} from "./state";

export type DeserializeGameV2ErrorCode =
  | "INVALID_JSON"
  | "INVALID_GAME_STATE"
  | "UNSUPPORTED_STATE_SCHEMA"
  | "RULESET_MISMATCH";

export class DeserializeGameV2Error extends Error {
  readonly code: DeserializeGameV2ErrorCode;
  readonly validationErrors: readonly GameStateV2ValidationError[];

  constructor(
    code: DeserializeGameV2ErrorCode,
    message: string,
    validationErrors: readonly GameStateV2ValidationError[] = [],
  ) {
    super(message);
    this.name = "DeserializeGameV2Error";
    this.code = code;
    this.validationErrors = validationErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireValidGameState(value: unknown): GameStateV2 {
  const validation = validateGameStateV2(value);
  if (validation.ok) return validation.state;

  const first = validation.errors[0];
  throw new DeserializeGameV2Error(
    "INVALID_GAME_STATE",
    `GameStateV2 validation failed at ${first.path}: ${first.message}`,
    validation.errors,
  );
}

/** Serializes only a state that currently satisfies every GameStateV2 invariant. */
export function serializeGameV2(state: GameStateV2): string {
  return JSON.stringify(requireValidGameState(state));
}

/**
 * Restores only states for the current schema and generated rules data.
 * Deliberate migrations can be introduced alongside future schema versions.
 */
export function deserializeGameV2(serialized: string): GameStateV2 {
  if (typeof serialized !== "string") {
    throw new DeserializeGameV2Error(
      "INVALID_JSON",
      "Serialized game state must be a string.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new DeserializeGameV2Error(
      "INVALID_JSON",
      "Game state is not valid JSON.",
    );
  }

  if (!isRecord(parsed)) {
    throw new DeserializeGameV2Error(
      "INVALID_GAME_STATE",
      "Game state must be an object.",
    );
  }
  if (parsed.schemaVersion !== GAME_STATE_V2_SCHEMA_VERSION) {
    throw new DeserializeGameV2Error(
      "UNSUPPORTED_STATE_SCHEMA",
      `Unsupported GameStateV2 schema version: ${String(parsed.schemaVersion)}.`,
    );
  }

  const validation = validateGameStateV2(parsed);
  if (!validation.ok) {
    const rulesetMismatch = validation.errors.some(
      (error) => error.code === "RULESET",
    );
    const first = validation.errors[0];
    throw new DeserializeGameV2Error(
      rulesetMismatch ? "RULESET_MISMATCH" : "INVALID_GAME_STATE",
      `GameStateV2 validation failed at ${first.path}: ${first.message}`,
      validation.errors,
    );
  }
  return validation.state;
}

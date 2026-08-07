import { RULESET_META } from "./rules/generated/ruleset";
import type { GameState } from "./types";

export type DeserializeErrorCode =
  | "INVALID_JSON"
  | "INVALID_GAME_STATE"
  | "UNSUPPORTED_STATE_SCHEMA"
  | "RULESET_MISMATCH";

export class DeserializeGameError extends Error {
  readonly code: DeserializeErrorCode;

  constructor(code: DeserializeErrorCode, message: string) {
    super(message);
    this.name = "DeserializeGameError";
    this.code = code;
  }
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads only states created by the currently running ruleset. Migrations can be
 * added deliberately when a persisted schema or ruleset changes.
 */
export function deserializeGame(serialized: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new DeserializeGameError("INVALID_JSON", "Game state is not valid JSON.");
  }

  if (!isRecord(parsed) || !isRecord(parsed.ruleset)) {
    throw new DeserializeGameError(
      "INVALID_GAME_STATE",
      "Game state is missing required metadata.",
    );
  }

  if (parsed.schemaVersion !== 1) {
    throw new DeserializeGameError(
      "UNSUPPORTED_STATE_SCHEMA",
      `Unsupported game state schema version: ${String(parsed.schemaVersion)}`,
    );
  }

  if (
    parsed.ruleset.id !== RULESET_META.id ||
    parsed.ruleset.version !== RULESET_META.version
  ) {
    throw new DeserializeGameError(
      "RULESET_MISMATCH",
      `State ruleset ${String(parsed.ruleset.id)}@${String(parsed.ruleset.version)} does not match ${RULESET_META.id}@${RULESET_META.version}.`,
    );
  }

  if (!Number.isInteger(parsed.revision) || (parsed.revision as number) < 0) {
    throw new DeserializeGameError(
      "INVALID_GAME_STATE",
      "Game state revision must be a non-negative integer.",
    );
  }

  return parsed as GameState;
}

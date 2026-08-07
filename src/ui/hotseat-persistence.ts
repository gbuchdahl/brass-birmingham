import {
  replayGameV2Commands,
  type GameV2CommandEnvelope,
  type GameV2CommandError,
} from "@/engine/game-v2/commands";
import {
  deserializeGameV2,
  serializeGameV2,
} from "@/engine/game-v2/serialization";
import type { GameStateV2 } from "@/engine/game-v2/state";
import {
  createHotseatSession,
  minimumNextHotseatCommandOrdinal,
  type HotseatSession,
} from "./hotseat-session";

/** Version of the UI save document, intentionally independent of GameStateV2. */
export const HOTSEAT_SAVE_SCHEMA_VERSION = 1 as const;
export const HOTSEAT_SAVE_FORMAT = "brass-birmingham-hotseat" as const;

export type HotseatPersistenceErrorCode =
  | "INVALID_SAVE_JSON"
  | "INVALID_SAVE_SHAPE"
  | "INVALID_SAVE_FORMAT"
  | "UNSUPPORTED_SAVE_SCHEMA"
  | "INVALID_REPLAY_ORIGIN"
  | "INVALID_HEAD_STATE"
  | "COMMAND_REPLAY_FAILED"
  | "HEAD_MISMATCH"
  | "INVALID_NEXT_COMMAND_ORDINAL";

export class HotseatPersistenceError extends Error {
  readonly code: HotseatPersistenceErrorCode;
  readonly causeValue: unknown;
  readonly failedCommandIndex: number | null;
  readonly commandError: GameV2CommandError | null;

  constructor(
    code: HotseatPersistenceErrorCode,
    message: string,
    options: {
      readonly cause?: unknown;
      readonly failedCommandIndex?: number;
      readonly commandError?: GameV2CommandError;
    } = {},
  ) {
    super(message);
    this.name = "HotseatPersistenceError";
    this.code = code;
    this.causeValue = options.cause;
    this.failedCommandIndex = options.failedCommandIndex ?? null;
    this.commandError = options.commandError ?? null;
  }
}

type HotseatSaveV1 = {
  readonly format: typeof HOTSEAT_SAVE_FORMAT;
  readonly schemaVersion: typeof HOTSEAT_SAVE_SCHEMA_VERSION;
  /** Canonical GameStateV2 JSON bytes, nested as a string in this save document. */
  readonly origin: string;
  /** Canonical GameStateV2 JSON bytes after every accepted command. */
  readonly head: string;
  readonly acceptedCommands: readonly GameV2CommandEnvelope[];
  /** Includes rejected attempts, which are intentionally absent from command history. */
  readonly nextCommandOrdinal: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeState(
  state: GameStateV2,
  code: "INVALID_REPLAY_ORIGIN" | "INVALID_HEAD_STATE",
): string {
  try {
    return serializeGameV2(state);
  } catch (cause) {
    throw new HotseatPersistenceError(
      code,
      code === "INVALID_REPLAY_ORIGIN"
        ? "Hot-seat replay origin is not a valid game state."
        : "Hot-seat head is not a valid game state.",
      { cause },
    );
  }
}

function deserializeState(
  serialized: string,
  code: "INVALID_REPLAY_ORIGIN" | "INVALID_HEAD_STATE",
): GameStateV2 {
  try {
    return deserializeGameV2(serialized);
  } catch (cause) {
    throw new HotseatPersistenceError(
      code,
      code === "INVALID_REPLAY_ORIGIN"
        ? "Saved hot-seat replay origin is invalid or incompatible."
        : "Saved hot-seat head is invalid or incompatible.",
      { cause },
    );
  }
}

function requireOrdinal(head: GameStateV2, value: unknown): number {
  const minimum = minimumNextHotseatCommandOrdinal(head);
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum
  ) {
    throw new HotseatPersistenceError(
      "INVALID_NEXT_COMMAND_ORDINAL",
      `Saved next command ordinal must be a safe integer at least ${minimum}.`,
    );
  }
  return value as number;
}

function replayAndRequireHead(
  origin: GameStateV2,
  commands: readonly unknown[],
  expectedHeadBytes: string,
): readonly GameV2CommandEnvelope[] {
  const replay = replayGameV2Commands(origin, commands);
  if (!replay.ok) {
    throw new HotseatPersistenceError(
      "COMMAND_REPLAY_FAILED",
      `Saved command ${replay.failedCommandIndex} was rejected during replay: ${replay.error.message}`,
      {
        failedCommandIndex: replay.failedCommandIndex,
        commandError: replay.error,
      },
    );
  }

  const replayedHeadBytes = serializeState(replay.state, "INVALID_HEAD_STATE");
  if (replayedHeadBytes !== expectedHeadBytes) {
    throw new HotseatPersistenceError(
      "HEAD_MISMATCH",
      "Saved head does not byte-match the state reproduced by its command history.",
    );
  }
  return commands as readonly GameV2CommandEnvelope[];
}

/**
 * Persists only replay-authoritative data. Reveal state, drafts, and results are
 * deliberately excluded so a reload always returns to a private handoff.
 */
export function serializeHotseatSession(session: HotseatSession): string {
  const origin = serializeState(session.replayOrigin, "INVALID_REPLAY_ORIGIN");
  const head = serializeState(session.state, "INVALID_HEAD_STATE");
  replayAndRequireHead(session.replayOrigin, session.acceptedCommands, head);
  const nextCommandOrdinal = requireOrdinal(
    session.state,
    session.nextCommandOrdinal,
  );
  const save: HotseatSaveV1 = {
    format: HOTSEAT_SAVE_FORMAT,
    schemaVersion: HOTSEAT_SAVE_SCHEMA_VERSION,
    origin,
    head,
    acceptedCommands: session.acceptedCommands,
    nextCommandOrdinal,
  };
  try {
    return JSON.stringify(save);
  } catch (cause) {
    throw new HotseatPersistenceError(
      "INVALID_SAVE_SHAPE",
      "Hot-seat session cannot be represented as JSON.",
      { cause },
    );
  }
}

/** Restores a save only after state validation and deterministic command replay. */
export function deserializeHotseatSession(serialized: string): HotseatSession {
  if (typeof serialized !== "string") {
    throw new HotseatPersistenceError(
      "INVALID_SAVE_JSON",
      "Serialized hot-seat session must be a string.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (cause) {
    throw new HotseatPersistenceError(
      "INVALID_SAVE_JSON",
      "Hot-seat save is not valid JSON.",
      { cause },
    );
  }
  if (!isRecord(parsed)) {
    throw new HotseatPersistenceError(
      "INVALID_SAVE_SHAPE",
      "Hot-seat save must be an object.",
    );
  }
  if (parsed.format !== HOTSEAT_SAVE_FORMAT) {
    throw new HotseatPersistenceError(
      "INVALID_SAVE_FORMAT",
      `Unrecognized hot-seat save format: ${String(parsed.format)}.`,
    );
  }
  if (parsed.schemaVersion !== HOTSEAT_SAVE_SCHEMA_VERSION) {
    throw new HotseatPersistenceError(
      "UNSUPPORTED_SAVE_SCHEMA",
      `Unsupported hot-seat save schema: ${String(parsed.schemaVersion)}.`,
    );
  }
  if (
    typeof parsed.origin !== "string" ||
    typeof parsed.head !== "string" ||
    !Array.isArray(parsed.acceptedCommands)
  ) {
    throw new HotseatPersistenceError(
      "INVALID_SAVE_SHAPE",
      "Hot-seat save requires origin, head, and acceptedCommands fields.",
    );
  }

  const origin = deserializeState(parsed.origin, "INVALID_REPLAY_ORIGIN");
  const head = deserializeState(parsed.head, "INVALID_HEAD_STATE");
  const acceptedCommands = replayAndRequireHead(
    origin,
    parsed.acceptedCommands,
    parsed.head,
  );
  const nextCommandOrdinal = requireOrdinal(
    head,
    parsed.nextCommandOrdinal,
  );

  const privateHandoff = createHotseatSession(head);
  return {
    ...privateHandoff,
    replayOrigin: origin,
    acceptedCommands,
    nextCommandOrdinal,
  };
}

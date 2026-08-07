import type { Action } from "./actions";
import { reduce, type ReduceError, type ReduceErrorCode } from "./reduce";
import type { GameState } from "./types";

export const COMMAND_SCHEMA_VERSION = 1 as const;

export type CommandEnvelope = {
  schemaVersion: typeof COMMAND_SCHEMA_VERSION;
  id: string;
  expectedRevision: number;
  action: Action;
};

export type CommandErrorCode =
  | ReduceErrorCode
  | "UNSUPPORTED_COMMAND_SCHEMA"
  | "REVISION_CONFLICT";

export type CommandError = Omit<ReduceError, "code"> & {
  code: CommandErrorCode;
};

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: CommandError };

export type ReplayResult =
  | { ok: true; state: GameState; commandsApplied: number }
  | {
      ok: false;
      state: GameState;
      commandsApplied: number;
      failedCommandIndex: number;
      error: CommandError;
    };

function reject(
  state: GameState,
  code: CommandErrorCode,
  message: string,
): CommandResult {
  return { ok: false, state, error: { code, message } };
}

/**
 * Applies a command atomically. A rejected command returns the exact input state
 * object so callers cannot accidentally persist diagnostic mutations.
 */
export function executeCommand(
  state: GameState,
  command: CommandEnvelope,
): CommandResult {
  if (command.schemaVersion !== COMMAND_SCHEMA_VERSION) {
    return reject(
      state,
      "UNSUPPORTED_COMMAND_SCHEMA",
      `Unsupported command schema version: ${String(command.schemaVersion)}`,
    );
  }

  if (command.expectedRevision !== state.revision) {
    return reject(
      state,
      "REVISION_CONFLICT",
      `Expected revision ${command.expectedRevision}, current revision is ${state.revision}.`,
    );
  }

  const reduced = reduce(state, command.action);
  if (!reduced.ok) {
    return reduced;
  }

  const next = reduced.state;
  return {
    ok: true,
    state: {
      ...next,
      revision: state.revision + 1,
      log: [
        ...next.log,
        {
          idx: next.log.length,
          type: "COMMAND_APPLIED",
          data: {
            commandId: command.id,
            revision: state.revision + 1,
          },
        },
      ],
    },
  };
}

export function replayCommands(
  initialState: GameState,
  commands: readonly CommandEnvelope[],
): ReplayResult {
  let state = initialState;

  for (let index = 0; index < commands.length; index += 1) {
    const result = executeCommand(state, commands[index]);
    if (!result.ok) {
      return {
        ok: false,
        state: result.state,
        commandsApplied: index,
        failedCommandIndex: index,
        error: result.error,
      };
    }
    state = result.state;
  }

  return { ok: true, state, commandsApplied: commands.length };
}

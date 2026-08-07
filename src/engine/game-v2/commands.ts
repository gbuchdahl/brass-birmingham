import type {
  BuildActionEffect,
  BuildActionSelection,
} from "../actions-v2/build";
import type {
  DevelopActionEffect,
  DevelopActionSelection,
} from "../actions-v2/develop";
import type { LoanActionEffect } from "../actions-v2/loan";
import type {
  NetworkActionEffect,
  NetworkActionSelection,
} from "../actions-v2/network";
import type { PassActionEffect } from "../actions-v2/pass";
import type {
  ScoutActionEffect,
  ScoutActionSelection,
} from "../actions-v2/scout";
import type {
  SellActionEffect,
  SellActionSelection,
} from "../actions-v2/sell";
import type { PlayableCardId } from "../cards-v2/types";
import type { RoundIncomeSettlement } from "../economy/income";
import {
  executeBuildForGameV2,
  executeDevelopForGameV2,
  executeLoanForGameV2,
  executeNetworkForGameV2,
  executePassForGameV2,
  executeScoutForGameV2,
  executeSellForGameV2,
  type AdaptedActionEffectV2,
  type GameV2ActionAdapterError,
  type GameV2ActionAdapterErrorCode,
} from "./action-adapters";
import {
  resolveGameEra,
  type EraLifecycleError,
  type EraLifecycleSuccess,
} from "./era-lifecycle";
import {
  resolveMerchantFreeDevelopV2,
  type MerchantFreeDevelopEffectV2,
  type MerchantFreeDevelopErrorV2,
  type MerchantFreeDevelopErrorCodeV2,
  type MerchantFreeDevelopSelectionV2,
} from "./merchant-free-develop";
import {
  validateGameStateV2,
  type GameEventV2,
  type GameStateV2,
} from "./state";
import {
  applyAcceptedActionV2,
  resolveCompletedRoundV2,
  type LiquidationChoicesV2,
  type TurnLifecycleError,
} from "./turn-lifecycle";

export const GAME_V2_COMMAND_SCHEMA_VERSION = 1 as const;

export type GameV2PlayerCommand =
  | { readonly type: "BUILD"; readonly selection: BuildActionSelection }
  | { readonly type: "NETWORK"; readonly selection: NetworkActionSelection }
  | { readonly type: "DEVELOP"; readonly selection: DevelopActionSelection }
  | { readonly type: "SELL"; readonly selection: SellActionSelection }
  | { readonly type: "LOAN"; readonly cardId: PlayableCardId }
  | { readonly type: "SCOUT"; readonly selection: ScoutActionSelection }
  | { readonly type: "PASS"; readonly cardId: PlayableCardId };

export type GameV2Command =
  | GameV2PlayerCommand
  | {
      readonly type: "RESOLVE_MERCHANT_FREE_DEVELOP";
      readonly selection: MerchantFreeDevelopSelectionV2;
    }
  | {
      readonly type: "SETTLE_ROUND";
      readonly liquidationChoices: LiquidationChoicesV2;
    }
  | { readonly type: "RESOLVE_ERA" };

export type GameV2CommandEnvelope = {
  readonly schemaVersion: typeof GAME_V2_COMMAND_SCHEMA_VERSION;
  readonly commandId: string;
  readonly gameId: string;
  readonly expectedRevision: number;
  readonly actorSeat: string | null;
  readonly command: GameV2Command;
};

export type GameV2CommandBoundaryErrorCode =
  | "INVALID_GAME_STATE"
  | "INVALID_COMMAND"
  | "UNSUPPORTED_COMMAND_SCHEMA"
  | "COMMAND_ID_ALREADY_USED"
  | "GAME_ID_MISMATCH"
  | "REVISION_CONFLICT"
  | "REVISION_OVERFLOW"
  | "UNKNOWN_ACTOR"
  | "NOT_CURRENT_ACTOR"
  | "ACTOR_NOT_ALLOWED"
  | "COMMAND_NOT_ALLOWED_IN_PHASE"
  | "INVALID_TRANSITION"
  | "GAME_ALREADY_ENDED";

export type GameV2CommandError =
  | {
      readonly source: "command";
      readonly code: GameV2CommandBoundaryErrorCode;
      readonly message: string;
    }
  | {
      readonly source: "action";
      readonly actionType: GameV2PlayerCommand["type"];
      readonly code: GameV2ActionAdapterErrorCode;
      readonly message: string;
      readonly cause: GameV2ActionAdapterError;
    }
  | {
      readonly source: "turn_lifecycle";
      readonly code: TurnLifecycleError["code"];
      readonly message: string;
      readonly cause: TurnLifecycleError;
    }
  | {
      readonly source: "era_lifecycle";
      readonly code: EraLifecycleError["code"];
      readonly message: string;
      readonly cause: EraLifecycleError;
    }
  | {
      readonly source: "merchant_free_develop";
      readonly code: MerchantFreeDevelopErrorCodeV2;
      readonly message: string;
      readonly cause: MerchantFreeDevelopErrorV2;
    };

export type GameV2PlayerActionEffect =
  | AdaptedActionEffectV2<BuildActionEffect>
  | AdaptedActionEffectV2<NetworkActionEffect>
  | AdaptedActionEffectV2<DevelopActionEffect>
  | AdaptedActionEffectV2<SellActionEffect>
  | AdaptedActionEffectV2<LoanActionEffect>
  | AdaptedActionEffectV2<ScoutActionEffect>
  | AdaptedActionEffectV2<PassActionEffect>;

export type GameV2CommandOutcome =
  | {
      readonly kind: "player_action";
      readonly actionType: GameV2PlayerCommand["type"];
      readonly effect: GameV2PlayerActionEffect;
      readonly pendingFollowUp: boolean;
      readonly turnComplete: boolean | null;
      readonly roundComplete: boolean | null;
      readonly refilledCards: number | null;
    }
  | {
      readonly kind: "merchant_free_develop";
      readonly effect: MerchantFreeDevelopEffectV2;
      readonly turnComplete: boolean;
      readonly roundComplete: boolean;
      readonly refilledCards: number;
    }
  | {
      readonly kind: "round_settlement";
      readonly eraComplete: boolean;
      readonly settlements: Readonly<Record<string, RoundIncomeSettlement>>;
    }
  | {
      readonly kind: "era_resolution";
      readonly resolution: EraLifecycleSuccess;
    };

export type GameV2CommandResult =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly outcome: GameV2CommandOutcome;
    }
  | {
      readonly ok: false;
      readonly state: GameStateV2;
      readonly error: GameV2CommandError;
    };

export type GameV2ReplayResult =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly commandsApplied: number;
    }
  | {
      readonly ok: false;
      readonly state: GameStateV2;
      readonly commandsApplied: number;
      readonly failedCommandIndex: number;
      readonly error: GameV2CommandError;
    };

type PlayerAdapterResult =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly effect: GameV2PlayerActionEffect;
      readonly pending: boolean;
    }
  | {
      readonly ok: false;
      readonly error: GameV2ActionAdapterError;
    };

const PLAYER_ACTION_TYPES = new Set<GameV2PlayerCommand["type"]>([
  "BUILD",
  "NETWORK",
  "DEVELOP",
  "SELL",
  "LOAN",
  "SCOUT",
  "PASS",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonSafe(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const values = Array.isArray(value) ? value : Object.values(value);
  const safe = values.every((entry) => isJsonSafe(entry, seen));
  seen.delete(value);
  return safe;
}

function boundaryError(
  state: GameStateV2,
  code: GameV2CommandBoundaryErrorCode,
  message: string,
): GameV2CommandResult {
  return {
    ok: false,
    state,
    error: { source: "command", code, message },
  };
}

function appendEvent(
  state: GameStateV2,
  type: string,
  data: unknown,
): GameStateV2 {
  const event: GameEventV2 = {
    sequence: state.events.length,
    type,
    data,
  };
  return { ...state, events: [...state.events, event] };
}

function commandEvent(
  state: GameStateV2,
  envelope: GameV2CommandEnvelope,
): GameStateV2 {
  return appendEvent(state, "COMMAND_APPLIED", {
    commandSchemaVersion: envelope.schemaVersion,
    commandId: envelope.commandId,
    commandType: envelope.command.type,
    actorSeat: envelope.actorSeat,
    expectedRevision: envelope.expectedRevision,
    appliedRevision: envelope.expectedRevision + 1,
  });
}

function commandIdWasUsed(state: GameStateV2, commandId: string): boolean {
  return state.events.some(
    (event) =>
      event.type === "COMMAND_APPLIED" &&
      isRecord(event.data) &&
      event.data.commandId === commandId,
  );
}

function commandShapeError(value: unknown): string | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return "Command must be an object with a supported type.";
  }
  if (PLAYER_ACTION_TYPES.has(value.type as GameV2PlayerCommand["type"])) {
    if (value.type === "LOAN" || value.type === "PASS") {
      return typeof value.cardId === "string" && value.cardId.length > 0
        ? null
        : `${value.type} requires a cardId.`;
    }
    return isRecord(value.selection)
      ? null
      : `${value.type} requires a selection object.`;
  }
  if (value.type === "RESOLVE_MERCHANT_FREE_DEVELOP") {
    return isRecord(value.selection) &&
        Array.isArray(value.selection.tileIds) &&
        value.selection.tileIds.every(
          (tileId) => typeof tileId === "string" && tileId.length > 0,
        )
      ? null
      : "RESOLVE_MERCHANT_FREE_DEVELOP requires tileIds.";
  }
  if (value.type === "SETTLE_ROUND") {
    return isRecord(value.liquidationChoices)
      ? null
      : "SETTLE_ROUND requires liquidationChoices keyed by seat.";
  }
  return value.type === "RESOLVE_ERA"
    ? null
    : `Unsupported command type: ${value.type}.`;
}

function validateEnvelope(
  state: GameStateV2,
  value: unknown,
): GameV2CommandResult | GameV2CommandEnvelope {
  if (!isJsonSafe(value) || !isRecord(value)) {
    return boundaryError(
      state,
      "INVALID_COMMAND",
      "Command envelope must contain only finite, acyclic JSON values.",
    );
  }
  if (value.schemaVersion !== GAME_V2_COMMAND_SCHEMA_VERSION) {
    return boundaryError(
      state,
      "UNSUPPORTED_COMMAND_SCHEMA",
      `Unsupported GameStateV2 command schema: ${String(value.schemaVersion)}.`,
    );
  }
  if (
    typeof value.commandId !== "string" ||
    value.commandId.trim().length === 0 ||
    value.commandId.length > 128
  ) {
    return boundaryError(
      state,
      "INVALID_COMMAND",
      "Command ID must contain 1–128 characters.",
    );
  }
  if (value.gameId !== state.gameId) {
    return boundaryError(
      state,
      "GAME_ID_MISMATCH",
      "Command game ID does not match the authoritative game.",
    );
  }
  if (commandIdWasUsed(state, value.commandId)) {
    return boundaryError(
      state,
      "COMMAND_ID_ALREADY_USED",
      `Command ID has already been used: ${value.commandId}.`,
    );
  }
  if (
    !Number.isSafeInteger(value.expectedRevision) ||
    (value.expectedRevision as number) < 0
  ) {
    return boundaryError(
      state,
      "INVALID_COMMAND",
      "Expected revision must be a non-negative safe integer.",
    );
  }
  if (value.expectedRevision !== state.revision) {
    return boundaryError(
      state,
      "REVISION_CONFLICT",
      `Expected revision ${String(value.expectedRevision)}, current revision is ${state.revision}.`,
    );
  }
  if (!Number.isSafeInteger(state.revision + 1)) {
    return boundaryError(
      state,
      "REVISION_OVERFLOW",
      "The authoritative revision cannot be incremented safely.",
    );
  }
  if (
    value.actorSeat !== null &&
    (typeof value.actorSeat !== "string" || value.actorSeat.trim().length === 0)
  ) {
    return boundaryError(
      state,
      "INVALID_COMMAND",
      "Actor seat must be a non-empty string or null.",
    );
  }
  const shapeError = commandShapeError(value.command);
  if (shapeError) return boundaryError(state, "INVALID_COMMAND", shapeError);
  return value as unknown as GameV2CommandEnvelope;
}

function runPlayerAdapter(
  state: GameStateV2,
  command: GameV2PlayerCommand,
): PlayerAdapterResult {
  const result = command.type === "BUILD"
    ? executeBuildForGameV2(state, command.selection)
    : command.type === "NETWORK"
      ? executeNetworkForGameV2(state, command.selection)
      : command.type === "DEVELOP"
        ? executeDevelopForGameV2(state, command.selection)
        : command.type === "SELL"
          ? executeSellForGameV2(state, command.selection)
          : command.type === "LOAN"
            ? executeLoanForGameV2(state, command.cardId)
            : command.type === "SCOUT"
              ? executeScoutForGameV2(state, command.selection)
              : executePassForGameV2(state, command.cardId);
  return result.ok
    ? {
        ok: true,
        state: result.state,
        effect: result.effect,
        pending: result.state.progress.phase === "merchant_free_develop",
      }
    : { ok: false, error: result.error };
}

function accept(
  original: GameStateV2,
  state: GameStateV2,
  outcome: GameV2CommandOutcome,
): GameV2CommandResult {
  if (state.revision !== original.revision + 1) {
    return boundaryError(
      original,
      "INVALID_TRANSITION",
      "An accepted command must increment the revision exactly once.",
    );
  }
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    return boundaryError(
      original,
      "INVALID_TRANSITION",
      `Command produced invalid state at ${first.path}: ${first.message}`,
    );
  }
  return { ok: true, state, outcome };
}

function requirePlayerActor(
  state: GameStateV2,
  envelope: GameV2CommandEnvelope,
): GameV2CommandResult | null {
  if (typeof envelope.actorSeat !== "string") {
    return boundaryError(
      state,
      "ACTOR_NOT_ALLOWED",
      "Player actions require an actor seat.",
    );
  }
  if (!state.turnOrder.includes(envelope.actorSeat)) {
    return boundaryError(
      state,
      "UNKNOWN_ACTOR",
      `Unknown actor seat: ${envelope.actorSeat}.`,
    );
  }
  if (envelope.actorSeat !== state.currentSeat) {
    return boundaryError(
      state,
      "NOT_CURRENT_ACTOR",
      `Only ${state.currentSeat} may act now.`,
    );
  }
  return null;
}

function executePlayerCommand(
  state: GameStateV2,
  envelope: GameV2CommandEnvelope & { readonly command: GameV2PlayerCommand },
): GameV2CommandResult {
  if (state.progress.phase !== "action") {
    return boundaryError(
      state,
      "COMMAND_NOT_ALLOWED_IN_PHASE",
      `Player actions are not allowed during ${state.progress.phase}.`,
    );
  }
  const actorFailure = requirePlayerActor(state, envelope);
  if (actorFailure) return actorFailure;
  if (state.actionsUsed >= state.actionLimit) {
    const cause: TurnLifecycleError = {
      code: "ACTION_LIMIT_REACHED",
      message: "The current turn has already used its action allowance.",
    };
    return {
      ok: false,
      state,
      error: {
        source: "turn_lifecycle",
        code: cause.code,
        message: cause.message,
        cause,
      },
    };
  }

  let adapted: PlayerAdapterResult;
  try {
    adapted = runPlayerAdapter(state, envelope.command);
  } catch {
    return boundaryError(
      state,
      "INVALID_COMMAND",
      `${envelope.command.type} contains a malformed selection.`,
    );
  }
  if (!adapted.ok) {
    return {
      ok: false,
      state,
      error: {
        source: "action",
        actionType: envelope.command.type,
        code: adapted.error.code,
        message: adapted.error.message,
        cause: adapted.error,
      },
    };
  }
  if (
    !("seat" in adapted.effect) ||
    adapted.effect.seat !== envelope.actorSeat ||
    adapted.effect.actionsConsumed !== 1
  ) {
    return boundaryError(
      state,
      "INVALID_TRANSITION",
      "Action adapter returned an effect for the wrong actor or action budget.",
    );
  }

  if (adapted.pending) {
    const pendingState: GameStateV2 = {
      ...adapted.state,
      revision: state.revision + 1,
    };
    return accept(state, commandEvent(pendingState, envelope), {
      kind: "player_action",
      actionType: envelope.command.type,
      effect: adapted.effect,
      pendingFollowUp: true,
      turnComplete: null,
      roundComplete: null,
      refilledCards: null,
    });
  }

  const lifecycle = applyAcceptedActionV2(adapted.state, adapted.effect);
  if (!lifecycle.ok) {
    return {
      ok: false,
      state,
      error: {
        source: "turn_lifecycle",
        code: lifecycle.error.code,
        message: lifecycle.error.message,
        cause: lifecycle.error,
      },
    };
  }
  return accept(state, commandEvent(lifecycle.state, envelope), {
    kind: "player_action",
    actionType: envelope.command.type,
    effect: adapted.effect,
    pendingFollowUp: false,
    turnComplete: lifecycle.turnComplete,
    roundComplete: lifecycle.roundComplete,
    refilledCards: lifecycle.refilledCards,
  });
}

function executeMerchantFreeDevelopCommand(
  state: GameStateV2,
  envelope: GameV2CommandEnvelope & {
    readonly command: Extract<
      GameV2Command,
      { readonly type: "RESOLVE_MERCHANT_FREE_DEVELOP" }
    >;
  },
): GameV2CommandResult {
  if (state.progress.phase !== "merchant_free_develop") {
    return boundaryError(
      state,
      "COMMAND_NOT_ALLOWED_IN_PHASE",
      "No Merchant free Develop is pending.",
    );
  }
  if (envelope.actorSeat !== state.progress.pending.seat) {
    return boundaryError(
      state,
      typeof envelope.actorSeat === "string" &&
          !state.turnOrder.includes(envelope.actorSeat)
        ? "UNKNOWN_ACTOR"
        : "NOT_CURRENT_ACTOR",
      `Only ${state.progress.pending.seat} may resolve this follow-up.`,
    );
  }

  const resolved = resolveMerchantFreeDevelopV2(
    state,
    envelope.command.selection,
  );
  if (!resolved.ok) {
    return {
      ok: false,
      state,
      error: {
        source: "merchant_free_develop",
        code: resolved.error.code,
        message: resolved.error.message,
        cause: resolved.error,
      },
    };
  }
  const withResolution = appendEvent(
    resolved.state,
    "MERCHANT_FREE_DEVELOP_RESOLVED",
    resolved.effect,
  );
  const lifecycle = applyAcceptedActionV2(withResolution, {
    type: "SOLD",
    actionsConsumed: 1,
    moneySpent: 0,
  });
  if (!lifecycle.ok) {
    return {
      ok: false,
      state,
      error: {
        source: "turn_lifecycle",
        code: lifecycle.error.code,
        message: lifecycle.error.message,
        cause: lifecycle.error,
      },
    };
  }
  return accept(state, commandEvent(lifecycle.state, envelope), {
    kind: "merchant_free_develop",
    effect: resolved.effect,
    turnComplete: lifecycle.turnComplete,
    roundComplete: lifecycle.roundComplete,
    refilledCards: lifecycle.refilledCards,
  });
}

function executeSettlementCommand(
  state: GameStateV2,
  envelope: GameV2CommandEnvelope & {
    readonly command: Extract<GameV2Command, { readonly type: "SETTLE_ROUND" }>;
  },
): GameV2CommandResult {
  if (state.progress.phase !== "round_settlement") {
    return boundaryError(
      state,
      "COMMAND_NOT_ALLOWED_IN_PHASE",
      "Round settlement is not currently required.",
    );
  }
  if (envelope.actorSeat !== null) {
    return boundaryError(
      state,
      "ACTOR_NOT_ALLOWED",
      "Round settlement is a system command and requires a null actor.",
    );
  }
  const result = resolveCompletedRoundV2(
    state,
    envelope.command.liquidationChoices,
  );
  if (!result.ok) {
    return {
      ok: false,
      state,
      error: {
        source: "turn_lifecycle",
        code: result.error.code,
        message: result.error.message,
        cause: result.error,
      },
    };
  }
  return accept(state, commandEvent(result.state, envelope), {
    kind: "round_settlement",
    eraComplete: result.eraComplete,
    settlements: result.settlements,
  });
}

function executeEraCommand(
  state: GameStateV2,
  envelope: GameV2CommandEnvelope,
): GameV2CommandResult {
  if (state.progress.phase !== "era_transition") {
    return boundaryError(
      state,
      "COMMAND_NOT_ALLOWED_IN_PHASE",
      "Era resolution is not currently required.",
    );
  }
  if (envelope.actorSeat !== null) {
    return boundaryError(
      state,
      "ACTOR_NOT_ALLOWED",
      "Era resolution is a system command and requires a null actor.",
    );
  }
  const result = resolveGameEra(state);
  if (!result.ok) {
    return {
      ok: false,
      state,
      error: {
        source: "era_lifecycle",
        code: result.error.code,
        message: result.error.message,
        cause: result.error,
      },
    };
  }
  const stateWithCommand = commandEvent(result.state, envelope);
  return accept(state, stateWithCommand, {
    kind: "era_resolution",
    resolution: { ...result, state: stateWithCommand },
  });
}

/** Applies one versioned command atomically to authoritative GameStateV2. */
export function executeGameV2Command(
  state: GameStateV2,
  commandValue: unknown,
): GameV2CommandResult {
  const stateValidation = validateGameStateV2(state);
  if (!stateValidation.ok) {
    const first = stateValidation.errors[0];
    return boundaryError(
      state,
      "INVALID_GAME_STATE",
      `${first.path}: ${first.message}`,
    );
  }
  const envelope = validateEnvelope(state, commandValue);
  if ("ok" in envelope) return envelope;
  if (state.progress.phase === "ended") {
    return boundaryError(
      state,
      "GAME_ALREADY_ENDED",
      "No command can be applied after the game has ended.",
    );
  }

  if (PLAYER_ACTION_TYPES.has(envelope.command.type as GameV2PlayerCommand["type"])) {
    return executePlayerCommand(
      state,
      envelope as GameV2CommandEnvelope & { readonly command: GameV2PlayerCommand },
    );
  }
  if (envelope.command.type === "RESOLVE_MERCHANT_FREE_DEVELOP") {
    return executeMerchantFreeDevelopCommand(
      state,
      envelope as GameV2CommandEnvelope & {
        readonly command: Extract<
          GameV2Command,
          { readonly type: "RESOLVE_MERCHANT_FREE_DEVELOP" }
        >;
      },
    );
  }
  if (envelope.command.type === "SETTLE_ROUND") {
    return executeSettlementCommand(
      state,
      envelope as GameV2CommandEnvelope & {
        readonly command: Extract<GameV2Command, { readonly type: "SETTLE_ROUND" }>;
      },
    );
  }
  return executeEraCommand(state, envelope);
}

/** Deterministically replays commands until the first rejection. */
export function replayGameV2Commands(
  initialState: GameStateV2,
  commands: readonly unknown[],
): GameV2ReplayResult {
  let state = initialState;
  for (let index = 0; index < commands.length; index += 1) {
    const result = executeGameV2Command(state, commands[index]);
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

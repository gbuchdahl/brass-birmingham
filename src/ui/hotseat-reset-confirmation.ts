export type HotseatResetPlayerCount = 2 | 3 | 4;

export type HotseatResetContext = {
  readonly currentGame: {
    readonly gameId: string;
    readonly revision: number;
    readonly playerCount: HotseatResetPlayerCount;
    readonly seed: string;
  };
  readonly requestedGame: {
    readonly playerCount: HotseatResetPlayerCount;
    readonly seed: string;
  };
  /** Whether confirming will replace the browser's replay-authoritative save. */
  readonly localSavePresent: boolean;
};

export type HotseatResetWarning = {
  readonly title: string;
  readonly message: string;
  readonly currentGameId: string;
  readonly currentRevision: number;
  readonly currentPlayerCount: HotseatResetPlayerCount;
  readonly currentSeed: string;
  readonly requestedPlayerCount: HotseatResetPlayerCount;
  readonly requestedSeed: string;
  readonly replacesLocalSave: boolean;
};

export type HotseatResetConfirmationState =
  | { readonly status: "idle" }
  | {
      readonly status: "pending";
      readonly snapshot: HotseatResetContext;
      readonly warning: HotseatResetWarning;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
    };

export type HotseatResetRejectionReason =
  | "NO_PENDING_CONFIRMATION"
  | "INVALID_CONTEXT"
  | "CURRENT_GAME_CHANGED"
  | "REQUESTED_SETTINGS_CHANGED"
  | "SAVE_CONTEXT_CHANGED";

export type HotseatResetDecision =
  | {
      readonly status: "confirmed";
      readonly nextState: { readonly status: "idle" };
      readonly requestedGame: HotseatResetContext["requestedGame"];
    }
  | {
      readonly status: "rejected";
      readonly nextState: { readonly status: "idle" };
      readonly reason: HotseatResetRejectionReason;
      readonly message: string;
    };

const IDLE: { readonly status: "idle" } = { status: "idle" };

function isPlayerCount(value: unknown): value is HotseatResetPlayerCount {
  return value === 2 || value === 3 || value === 4;
}

function validateContext(context: HotseatResetContext): string | null {
  if (
    typeof context !== "object" ||
    context === null ||
    typeof context.currentGame !== "object" ||
    context.currentGame === null ||
    typeof context.requestedGame !== "object" ||
    context.requestedGame === null
  ) return "Reset confirmation requires current and requested game settings.";
  if (
    typeof context.currentGame.gameId !== "string" ||
    context.currentGame.gameId.length === 0 ||
    !Number.isSafeInteger(context.currentGame.revision) ||
    context.currentGame.revision < 0 ||
    !isPlayerCount(context.currentGame.playerCount) ||
    typeof context.currentGame.seed !== "string"
  ) return "The current game identity or settings are invalid.";
  if (
    !isPlayerCount(context.requestedGame.playerCount) ||
    typeof context.requestedGame.seed !== "string"
  ) return "The requested player count or seed is invalid.";
  if (typeof context.localSavePresent !== "boolean") {
    return "The local-save context is invalid.";
  }
  return null;
}

function copyContext(context: HotseatResetContext): HotseatResetContext {
  return {
    currentGame: { ...context.currentGame },
    requestedGame: { ...context.requestedGame },
    localSavePresent: context.localSavePresent,
  };
}

export function idleHotseatResetConfirmation(): HotseatResetConfirmationState {
  return IDLE;
}

/**
 * Captures every value whose change would make a later destructive confirmation
 * ambiguous. The caller should render the returned warning before confirming.
 */
export function requestHotseatResetConfirmation(
  context: HotseatResetContext,
): HotseatResetConfirmationState {
  const invalid = validateContext(context);
  if (invalid !== null) return { status: "invalid", message: invalid };
  const snapshot = copyContext(context);
  const saveDescription = snapshot.localSavePresent
    ? "The current game and its local autosave will be replaced."
    : "The current in-memory game will be replaced.";
  return {
    status: "pending",
    snapshot,
    warning: {
      title: "Replace the current hot-seat game?",
      message:
        `${saveDescription} Current: ${snapshot.currentGame.playerCount} players, ` +
        `seed “${snapshot.currentGame.seed}”, revision ${snapshot.currentGame.revision}. ` +
        `New: ${snapshot.requestedGame.playerCount} players, ` +
        `seed “${snapshot.requestedGame.seed}”.`,
      currentGameId: snapshot.currentGame.gameId,
      currentRevision: snapshot.currentGame.revision,
      currentPlayerCount: snapshot.currentGame.playerCount,
      currentSeed: snapshot.currentGame.seed,
      requestedPlayerCount: snapshot.requestedGame.playerCount,
      requestedSeed: snapshot.requestedGame.seed,
      replacesLocalSave: snapshot.localSavePresent,
    },
  };
}

/** Cancel always consumes the prompt and never authorizes a reset. */
export function cancelHotseatResetConfirmation(): HotseatResetConfirmationState {
  return IDLE;
}

function rejected(
  reason: HotseatResetRejectionReason,
  message: string,
): HotseatResetDecision {
  return { status: "rejected", nextState: IDLE, reason, message };
}

/**
 * Authorizes reset exactly once and only when the live context byte-for-byte
 * matches the warning snapshot. Every rejection consumes the old prompt.
 */
export function confirmHotseatResetConfirmation(
  state: HotseatResetConfirmationState,
  currentContext: HotseatResetContext,
): HotseatResetDecision {
  if (state.status === "invalid") {
    return rejected("INVALID_CONTEXT", state.message);
  }
  if (state.status !== "pending") {
    return rejected(
      "NO_PENDING_CONFIRMATION",
      "A reset was not confirmed because no warning is pending.",
    );
  }
  const invalid = validateContext(currentContext);
  if (invalid !== null) return rejected("INVALID_CONTEXT", invalid);

  const expected = state.snapshot;
  if (
    currentContext.currentGame.gameId !== expected.currentGame.gameId ||
    currentContext.currentGame.revision !== expected.currentGame.revision ||
    currentContext.currentGame.playerCount !==
      expected.currentGame.playerCount ||
    currentContext.currentGame.seed !== expected.currentGame.seed
  ) {
    return rejected(
      "CURRENT_GAME_CHANGED",
      "The current game changed after the reset warning. Review it again.",
    );
  }
  if (
    currentContext.requestedGame.playerCount !==
      expected.requestedGame.playerCount ||
    currentContext.requestedGame.seed !== expected.requestedGame.seed
  ) {
    return rejected(
      "REQUESTED_SETTINGS_CHANGED",
      "The requested player count or seed changed after the reset warning.",
    );
  }
  if (currentContext.localSavePresent !== expected.localSavePresent) {
    return rejected(
      "SAVE_CONTEXT_CHANGED",
      "The local-save context changed after the reset warning.",
    );
  }
  return {
    status: "confirmed",
    nextState: IDLE,
    requestedGame: { ...expected.requestedGame },
  };
}

import type { PlayableCardId } from "@/engine/cards-v2/types";
import {
  GAME_V2_COMMAND_SCHEMA_VERSION,
  executeGameV2Command,
  type GameV2Command,
  type GameV2CommandEnvelope,
  type GameV2CommandError,
  type GameV2CommandOutcome,
} from "@/engine/game-v2/commands";
import {
  validateGameStateV2,
  type GameProgressV2,
  type GameStateV2,
} from "@/engine/game-v2/state";

/** Opaque form state owned by the UI until it can produce a typed command. */
export type HotseatDraft = {
  readonly commandType: GameV2Command["type"];
  readonly fields: Readonly<Record<string, unknown>>;
};

export type HotseatVisibility =
  | {
      readonly kind: "handoff";
      /** Null while a system boundary or the terminal result is visible. */
      readonly nextSeat: string | null;
    }
  | {
      readonly kind: "revealed";
      readonly seat: string;
    };

export type HotseatLastResult =
  | {
      readonly ok: true;
      readonly commandId: string;
      readonly outcome: GameV2CommandOutcome;
    }
  | {
      readonly ok: false;
      readonly commandId: string;
      readonly error: GameV2CommandError;
    };

export type HotseatSession = {
  /** State from which acceptedCommands must deterministically reproduce state. */
  readonly replayOrigin: GameStateV2;
  /** The only authoritative game state. It must never be passed to presentation components. */
  readonly state: GameStateV2;
  /** Only accepted envelopes are replayable history. */
  readonly acceptedCommands: readonly GameV2CommandEnvelope[];
  readonly visibility: HotseatVisibility;
  readonly draft: HotseatDraft | null;
  readonly lastResult: HotseatLastResult | null;
  /** Counts attempts, including rejections, so every generated ID is unique in a session. */
  readonly nextCommandOrdinal: number;
};

export type HotseatPublicProgress =
  | { readonly phase: "action" }
  | { readonly phase: "round_settlement" }
  | { readonly phase: "era_transition" }
  | {
      readonly phase: "merchant_free_develop";
      readonly pending: {
        readonly seat: string;
        readonly count: number;
        readonly merchantSpaceIds: readonly string[];
      };
    }
  | {
      readonly phase: "ended";
      readonly standings: Extract<
        GameProgressV2,
        { readonly phase: "ended" }
      >["terminal"]["standings"];
    };

export type HotseatPublicModel = {
  readonly identity: {
    readonly gameId: string;
    readonly seed: string;
    readonly revision: number;
  };
  readonly progress: HotseatPublicProgress;
  readonly turn: {
    readonly era: GameStateV2["era"];
    readonly round: number;
    readonly turnNumber: number;
    readonly currentSeat: string;
    readonly actionsUsed: number;
    readonly actionLimit: number;
    readonly turnOrder: readonly string[];
  };
  readonly players: readonly {
    readonly seat: string;
    readonly isCurrent: boolean;
    readonly money: number;
    readonly incomeMarkerSpace: number;
    readonly victoryPoints: number;
    readonly linkTokensRemaining: number;
    readonly handCount: number;
    readonly industry: readonly {
      readonly kind: string;
      readonly remaining: number;
      readonly nextTileId: string | null;
    }[];
  }[];
  readonly cards: {
    readonly drawCount: number;
    readonly discardCount: number;
    readonly wildLocationCount: number;
    readonly wildIndustryCount: number;
  };
  readonly market: {
    readonly coal: number;
    readonly iron: number;
  };
  readonly merchants: readonly {
    readonly merchantSpaceId: string;
    readonly locationId: string;
    readonly active: boolean;
    readonly tileId: string | null;
    readonly demandIndustries: readonly string[];
    readonly beer: number;
  }[];
  readonly board: {
    readonly builtLinks: readonly {
      readonly linkId: string;
      readonly owner: string;
    }[];
    readonly placedIndustries: readonly {
      readonly spaceId: string;
      readonly owner: string;
      readonly tileId: string;
      readonly locationId: string;
      readonly resources: {
        readonly coal: number;
        readonly iron: number;
        readonly beer: number;
      };
      readonly flipped: boolean;
    }[];
  };
  /** Raw event payloads are intentionally excluded because they are not a privacy boundary. */
  readonly recentEvents: readonly {
    readonly sequence: number;
    readonly type: string;
  }[];
};

export type HotseatPrivateModel = {
  readonly seat: string;
  readonly hand: readonly PlayableCardId[];
  readonly draft: HotseatDraft | null;
};

export type HotseatViewModel = {
  readonly public: HotseatPublicModel;
  readonly visibility: HotseatVisibility;
  /** Null guarantees that no hand is mounted during device handoff. */
  readonly private: HotseatPrivateModel | null;
  readonly acceptedCommandCount: number;
  readonly lastResult: HotseatLastResult | null;
};

function playerPrivatePhase(state: GameStateV2): boolean {
  return state.progress.phase === "action" ||
    state.progress.phase === "merchant_free_develop";
}

function handoffFor(state: GameStateV2): HotseatVisibility {
  return {
    kind: "handoff",
    nextSeat: playerPrivatePhase(state) ? state.currentSeat : null,
  };
}

function requireValidState(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    throw new Error(`Invalid hot-seat game state at ${first.path}: ${first.message}`);
  }
}

function hotseatOrdinalFromCommandId(
  gameId: string,
  commandId: unknown,
): number | null {
  if (typeof commandId !== "string") return null;
  const prefix = `hotseat:${gameId}:`;
  if (!commandId.startsWith(prefix)) return null;
  const suffix = commandId.slice(prefix.length);
  if (!/^[0-9]+$/.test(suffix)) return null;
  const ordinal = Number(suffix);
  return Number.isSafeInteger(ordinal) && ordinal >= 1 ? ordinal : null;
}

/**
 * Finds an ordinal beyond every persisted hot-seat ID. Generic revisions are
 * deliberately ignored because commands created by other clients do not use
 * this ID namespace; rejected hot-seat attempts are restored from save data.
 */
export function minimumNextHotseatCommandOrdinal(state: GameStateV2): number {
  let maximum = 0;
  for (const event of state.events) {
    if (
      event.type !== "COMMAND_APPLIED" ||
      typeof event.data !== "object" ||
      event.data === null ||
      Array.isArray(event.data)
    ) continue;
    const ordinal = hotseatOrdinalFromCommandId(
      state.gameId,
      (event.data as Record<string, unknown>).commandId,
    );
    if (ordinal !== null) maximum = Math.max(maximum, ordinal);
  }
  return maximum < Number.MAX_SAFE_INTEGER
    ? maximum + 1
    : Number.MAX_SAFE_INTEGER;
}

export function createHotseatSession(state: GameStateV2): HotseatSession {
  requireValidState(state);
  return {
    replayOrigin: state,
    state,
    acceptedCommands: [],
    visibility: handoffFor(state),
    draft: null,
    lastResult: null,
    nextCommandOrdinal: minimumNextHotseatCommandOrdinal(state),
  };
}

export function resetHotseatSession(
  _session: HotseatSession,
  state: GameStateV2,
): HotseatSession {
  return createHotseatSession(state);
}

export function revealHotseatHand(session: HotseatSession): HotseatSession {
  if (!playerPrivatePhase(session.state)) return session;
  return {
    ...session,
    visibility: { kind: "revealed", seat: session.state.currentSeat },
  };
}

export function hideHotseatHand(session: HotseatSession): HotseatSession {
  return {
    ...session,
    visibility: handoffFor(session.state),
    draft: null,
  };
}

export function setHotseatDraft(
  session: HotseatSession,
  draft: HotseatDraft | null,
): HotseatSession {
  if (session.visibility.kind !== "revealed") return session;
  return { ...session, draft };
}

function actorFor(
  state: GameStateV2,
  command: GameV2Command,
): string | null {
  if (command.type === "SETTLE_ROUND" || command.type === "RESOLVE_ERA") {
    return null;
  }
  if (command.type === "RESOLVE_MERCHANT_FREE_DEVELOP") {
    return state.progress.phase === "merchant_free_develop"
      ? state.progress.pending.seat
      : state.currentSeat;
  }
  return state.currentSeat;
}

export function nextHotseatCommandId(session: HotseatSession): string {
  const ordinal = String(session.nextCommandOrdinal).padStart(6, "0");
  return `hotseat:${session.state.gameId}:${ordinal}`;
}

export function createHotseatCommandEnvelope(
  session: HotseatSession,
  command: GameV2Command,
): GameV2CommandEnvelope {
  return {
    schemaVersion: GAME_V2_COMMAND_SCHEMA_VERSION,
    commandId: nextHotseatCommandId(session),
    gameId: session.state.gameId,
    expectedRevision: session.state.revision,
    actorSeat: actorFor(session.state, command),
    command,
  };
}

/** Submits a domain command and updates only UI session state around its result. */
export function submitHotseatCommand(
  session: HotseatSession,
  command: GameV2Command,
): HotseatSession {
  const envelope = createHotseatCommandEnvelope(session, command);
  const result = executeGameV2Command(session.state, envelope);
  const nextCommandOrdinal = session.nextCommandOrdinal + 1;

  if (!result.ok) {
    return {
      ...session,
      // Command rejections retain the exact authoritative state, history,
      // visibility, and draft so the player can correct the form in place.
      state: result.state,
      lastResult: {
        ok: false,
        commandId: envelope.commandId,
        error: result.error,
      },
      nextCommandOrdinal,
    };
  }

  const remainsWithRevealedSeat =
    envelope.actorSeat !== null &&
    session.visibility.kind === "revealed" &&
    session.visibility.seat === envelope.actorSeat &&
    result.state.currentSeat === envelope.actorSeat &&
    playerPrivatePhase(result.state);

  return {
    replayOrigin: session.replayOrigin,
    state: result.state,
    acceptedCommands: [...session.acceptedCommands, envelope],
    visibility: remainsWithRevealedSeat
      ? { kind: "revealed", seat: envelope.actorSeat }
      : handoffFor(result.state),
    draft: null,
    lastResult: {
      ok: true,
      commandId: envelope.commandId,
      outcome: result.outcome,
    },
    nextCommandOrdinal,
  };
}

function publicProgress(progress: GameProgressV2): HotseatPublicProgress {
  if (progress.phase === "merchant_free_develop") {
    return {
      phase: progress.phase,
      pending: {
        seat: progress.pending.seat,
        count: progress.pending.count,
        merchantSpaceIds: [...progress.pending.merchantSpaceIds],
      },
    };
  }
  if (progress.phase === "ended") {
    return {
      phase: progress.phase,
      standings: progress.terminal.standings.map((standing) => ({ ...standing })),
    };
  }
  return { phase: progress.phase };
}

/** Projects public game information without any card identities or raw event payloads. */
export function toHotseatPublicModel(state: GameStateV2): HotseatPublicModel {
  return {
    identity: {
      gameId: state.gameId,
      seed: state.seed,
      revision: state.revision,
    },
    progress: publicProgress(state.progress),
    turn: {
      era: state.era,
      round: state.round,
      turnNumber: state.turnNumber,
      currentSeat: state.currentSeat,
      actionsUsed: state.actionsUsed,
      actionLimit: state.actionLimit,
      turnOrder: [...state.turnOrder],
    },
    players: state.turnOrder.map((seat) => {
      const player = state.players[seat];
      return {
        seat,
        isCurrent: seat === state.currentSeat,
        money: player.money,
        incomeMarkerSpace: player.incomeMarkerSpace,
        victoryPoints: player.victoryPoints,
        linkTokensRemaining: player.linkTokensRemaining,
        handCount: state.cards.hands[seat].length,
        industry: Object.entries(player.industryInventory.stacks).map(
          ([kind, stack]) => ({
            kind,
            remaining: stack.length,
            nextTileId: stack[0] ?? null,
          }),
        ),
      };
    }),
    cards: {
      drawCount: state.cards.draw.length,
      discardCount: state.cards.discard.length,
      wildLocationCount: state.cards.wildSupplies.location,
      wildIndustryCount: state.cards.wildSupplies.industry,
    },
    market: { ...state.market },
    merchants: state.merchants.spaces.map((space) => ({
      merchantSpaceId: space.merchantSpaceId,
      locationId: space.locationId,
      active: space.active,
      tileId: space.tileId,
      demandIndustries: [...space.demandIndustries],
      beer: space.beer,
    })),
    board: {
      builtLinks: Object.entries(state.board.builtLinks).map(
        ([linkId, owner]) => ({ linkId, owner }),
      ),
      placedIndustries: Object.entries(state.board.placedIndustries).map(
        ([spaceId, placement]) => ({
          spaceId,
          owner: placement.owner,
          tileId: placement.tileId,
          locationId: placement.locationId,
          resources: { ...placement.resources },
          flipped: placement.flipped,
        }),
      ),
    },
    recentEvents: state.events.slice(-8).map((event) => ({
      sequence: event.sequence,
      type: event.type,
    })),
  };
}

function toHotseatPrivateModel(
  session: HotseatSession,
): HotseatPrivateModel | null {
  if (
    session.visibility.kind !== "revealed" ||
    session.visibility.seat !== session.state.currentSeat ||
    !playerPrivatePhase(session.state)
  ) return null;
  return {
    seat: session.visibility.seat,
    hand: [...session.state.cards.hands[session.visibility.seat]],
    draft: session.draft,
  };
}

/** The only projection a hot-seat presentation component should receive. */
export function toHotseatViewModel(session: HotseatSession): HotseatViewModel {
  return {
    public: toHotseatPublicModel(session.state),
    visibility: session.visibility,
    private: toHotseatPrivateModel(session),
    acceptedCommandCount: session.acceptedCommands.length,
    lastResult: session.lastResult,
  };
}

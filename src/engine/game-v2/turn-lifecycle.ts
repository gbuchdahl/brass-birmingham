import { refillHand } from "../cards-v2/zones";
import {
  incomeLevelAt,
  settleRoundIncome,
  type RoundIncomeSettlement,
} from "../economy/income";
import {
  actionsPerTurn,
  createRoundSpendLedger,
  determineNextTurnOrder,
  nextSeat,
  recordRoundSpending,
} from "../lifecycle";
import { INDUSTRY_TILE_BY_ID } from "../rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "../rules/generated/ruleset";
import {
  validateGameStateV2,
  type GameStateV2,
  type GameEventV2,
  type PlacedIndustryStateV2,
} from "./state";

export type AcceptedActionEffectV2 = {
  readonly type?: string;
  readonly actionsConsumed: 1;
  readonly moneySpent: number;
};

export type TurnLifecycleErrorCode =
  | "INVALID_GAME_STATE"
  | "INVALID_ACTION_EFFECT"
  | "ACTION_LIMIT_REACHED"
  | "ROUND_SETTLEMENT_REQUIRED"
  | "ERA_TRANSITION_REQUIRED"
  | "GAME_ALREADY_ENDED"
  | "CARD_REFILL_FAILED"
  | "ROUND_NOT_COMPLETE"
  | "INVALID_LIQUIDATION_CHOICES"
  | "MISSING_LIQUIDATION_CHOICES"
  | "UNEXPECTED_LIQUIDATION_CHOICES"
  | "INDUSTRY_NOT_OWNED"
  | "INCOME_SETTLEMENT_FAILED";

export type TurnLifecycleError = {
  readonly code: TurnLifecycleErrorCode;
  readonly message: string;
  readonly seat?: string;
  readonly industryId?: string;
};

type TurnLifecycleFailure = {
  readonly ok: false;
  readonly state: GameStateV2;
  readonly error: TurnLifecycleError;
};

export type ApplyAcceptedActionResultV2 =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly turnComplete: boolean;
      readonly roundComplete: boolean;
      readonly refilledCards: number;
    }
  | TurnLifecycleFailure;

export type LiquidationChoicesV2 = Readonly<
  Record<string, readonly string[]>
>;

export type ResolveCompletedRoundResultV2 =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly eraComplete: boolean;
      readonly settlements: Readonly<Record<string, RoundIncomeSettlement>>;
    }
  | TurnLifecycleFailure;

function reject(
  state: GameStateV2,
  code: TurnLifecycleErrorCode,
  message: string,
  details: Pick<TurnLifecycleError, "seat" | "industryId"> = {},
): TurnLifecycleFailure {
  return { ok: false, state, error: { code, message, ...details } };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isEraCompleteRoundSettlement(
  state: GameStateV2,
  event: GameEventV2,
): boolean {
  return (
    event.type === "ROUND_SETTLED" &&
    isRecord(event.data) &&
    event.data.settlementComplete === true &&
    event.data.eraComplete === true &&
    event.data.era === state.era &&
    event.data.completedRound === state.round
  );
}

function hasEraCompleteRoundSettlement(state: GameStateV2): boolean {
  return state.events.some((event) => isEraCompleteRoundSettlement(state, event));
}

function actionBoundaryFailure(state: GameStateV2): TurnLifecycleFailure | null {
  if (state.events.some((event) => event.type === "GAME_ENDED")) {
    return reject(
      state,
      "GAME_ALREADY_ENDED",
      "No actions can be accepted after the game has ended.",
    );
  }
  if (hasEraCompleteRoundSettlement(state)) {
    return reject(
      state,
      "ERA_TRANSITION_REQUIRED",
      state.era === "canal"
        ? "The completed Canal Era must transition to Rail before another action."
        : "The completed Rail Era must resolve final scoring before another action.",
    );
  }
  if (hasCompletedRoundBoundary(state)) {
    return reject(
      state,
      "ROUND_SETTLEMENT_REQUIRED",
      "The completed round must be settled before another action.",
    );
  }
  return null;
}

function validateEntryState(state: GameStateV2): TurnLifecycleFailure | null {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    return reject(
      state,
      "INVALID_GAME_STATE",
      `${first.path}: ${first.message}`,
    );
  }
  if (!Number.isSafeInteger(state.revision + 1)) {
    return reject(
      state,
      "INVALID_GAME_STATE",
      "Revision cannot be incremented safely.",
    );
  }
  return null;
}

function appendEvent(
  state: GameStateV2,
  type: string,
  data: unknown,
): GameEventV2[] {
  return [
    ...state.events,
    { sequence: state.events.length, type, data },
  ];
}

function validateTransition(
  originalState: GameStateV2,
  nextState: GameStateV2,
): TurnLifecycleFailure | null {
  const validation = validateGameStateV2(nextState);
  if (validation.ok) return null;
  const first = validation.errors[0];
  return reject(
    originalState,
    "INVALID_GAME_STATE",
    `Lifecycle produced invalid state at ${first.path}: ${first.message}`,
  );
}

/** Records one already-accepted game action and advances the turn if complete. */
export function applyAcceptedActionV2(
  state: GameStateV2,
  effect: AcceptedActionEffectV2,
): ApplyAcceptedActionResultV2 {
  const invalidState = validateEntryState(state);
  if (invalidState) return invalidState;
  const boundaryFailure = actionBoundaryFailure(state);
  if (boundaryFailure) return boundaryFailure;
  if (
    !isRecord(effect) ||
    effect.actionsConsumed !== 1 ||
    !isNonNegativeSafeInteger(effect.moneySpent) ||
    (effect.type !== undefined &&
      (typeof effect.type !== "string" || effect.type.trim().length === 0))
  ) {
    return reject(
      state,
      "INVALID_ACTION_EFFECT",
      "Accepted actions must consume one action and report non-negative spending.",
    );
  }
  if (state.actionsUsed >= state.actionLimit) {
    return reject(
      state,
      "ACTION_LIMIT_REACHED",
      "The current turn has already used its action allowance.",
    );
  }
  const nextSpend = state.roundSpend[state.currentSeat] + effect.moneySpent;
  if (!Number.isSafeInteger(nextSpend)) {
    return reject(
      state,
      "INVALID_ACTION_EFFECT",
      "Round spending cannot be incremented safely.",
    );
  }

  const actionsUsed = state.actionsUsed + 1;
  const turnComplete = actionsUsed === state.actionLimit;
  let cards = state.cards;
  let currentSeat = state.currentSeat;
  let nextActionsUsed = actionsUsed;
  let turnNumber = state.turnNumber;
  let roundComplete = false;
  let refilledCards = 0;

  if (turnComplete) {
    const handSizeBefore = state.cards.hands[state.currentSeat].length;
    try {
      cards = refillHand(
        state.cards,
        state.currentSeat,
        SETUP_DATA.shared.handSize,
      );
    } catch (error) {
      return reject(
        state,
        "CARD_REFILL_FAILED",
        messageFrom(error),
        { seat: state.currentSeat },
      );
    }
    refilledCards = cards.hands[state.currentSeat].length - handSizeBefore;
    const advancement = nextSeat(state.turnOrder, state.currentSeat);
    currentSeat = advancement.seat;
    roundComplete = advancement.roundComplete;
    nextActionsUsed = 0;
    turnNumber += 1;
  }

  const roundSpend = recordRoundSpending(
    state.roundSpend,
    state.currentSeat,
    effect.moneySpent,
  );
  const eventData = {
    actionType: effect.type ?? "ACCEPTED_ACTION",
    seat: state.currentSeat,
    era: state.era,
    round: state.round,
    actionsUsedBefore: state.actionsUsed,
    actionsUsedAfter: actionsUsed,
    actionLimit: state.actionLimit,
    moneySpent: effect.moneySpent,
    turnComplete,
    roundComplete,
    refilledCards,
    nextSeat: currentSeat,
  };
  const nextState: GameStateV2 = {
    ...state,
    revision: state.revision + 1,
    turnNumber,
    currentSeat,
    actionsUsed: nextActionsUsed,
    roundSpend,
    cards,
    events: appendEvent(state, "ACTION_ACCEPTED", eventData),
  };
  const invalidTransition = validateTransition(state, nextState);
  if (invalidTransition) return invalidTransition;

  return {
    ok: true,
    state: nextState,
    turnComplete,
    roundComplete,
    refilledCards,
  };
}

function hasCompletedRoundBoundary(state: GameStateV2): boolean {
  return state.events.some(
    (event) =>
      event.type === "ACTION_ACCEPTED" &&
      isRecord(event.data) &&
      event.data.roundComplete === true &&
      event.data.era === state.era &&
      event.data.round === state.round,
  );
}

type PlannedSettlement = {
  readonly settlement: RoundIncomeSettlement;
  readonly removed: readonly {
    readonly industryId: string;
    readonly industry: PlacedIndustryStateV2;
  }[];
};

/** Settles a completed round using only explicit, ordered liquidation choices. */
export function resolveCompletedRoundV2(
  state: GameStateV2,
  liquidationChoices: LiquidationChoicesV2,
): ResolveCompletedRoundResultV2 {
  const invalidState = validateEntryState(state);
  if (invalidState) return invalidState;
  if (state.events.some((event) => event.type === "GAME_ENDED")) {
    return reject(
      state,
      "GAME_ALREADY_ENDED",
      "No round can be settled after the game has ended.",
    );
  }
  if (hasEraCompleteRoundSettlement(state)) {
    return reject(
      state,
      "ERA_TRANSITION_REQUIRED",
      "This era's final round has already been settled.",
    );
  }
  if (!hasCompletedRoundBoundary(state)) {
    return reject(
      state,
      "ROUND_NOT_COMPLETE",
      "The latest accepted action did not complete the round.",
    );
  }
  if (!isRecord(liquidationChoices)) {
    return reject(
      state,
      "INVALID_LIQUIDATION_CHOICES",
      "Liquidation choices must be keyed by seat.",
    );
  }

  const playerCount = state.turnOrder.length as 2 | 3 | 4;
  const finalRoundOfEra =
    state.round === SETUP_DATA.playerCounts[playerCount].roundsPerEra;
  const finalRoundOfGame = state.era === "rail" && finalRoundOfEra;
  if (finalRoundOfGame && Object.keys(liquidationChoices).length > 0) {
    const seat = Object.keys(liquidationChoices)[0];
    return reject(
      state,
      "UNEXPECTED_LIQUIDATION_CHOICES",
      "Final Rail income is skipped; liquidation choices must be empty.",
      { seat },
    );
  }
  const incomeLevels = Object.fromEntries(
    state.turnOrder.map((seat) => [
      seat,
      incomeLevelAt(state.players[seat].incomeMarkerSpace),
    ]),
  ) as Record<string, number>;
  const negativeIncomeSeats = state.turnOrder.filter(
    (seat) => incomeLevels[seat] < 0,
  );
  for (const seat of finalRoundOfGame ? [] : negativeIncomeSeats) {
    if (!Object.hasOwn(liquidationChoices, seat)) {
      return reject(
        state,
        "MISSING_LIQUIDATION_CHOICES",
        `Negative-income seat requires explicit liquidation choices: ${seat}.`,
        { seat },
      );
    }
  }
  for (const seat of Object.keys(liquidationChoices)) {
    if (!state.turnOrder.includes(seat)) {
      return reject(
        state,
        "INVALID_LIQUIDATION_CHOICES",
        `Unknown liquidation-choice seat: ${seat}.`,
        { seat },
      );
    }
    const choices = liquidationChoices[seat];
    if (
      !Array.isArray(choices) ||
      choices.some(
        (industryId) => typeof industryId !== "string" || industryId.length === 0,
      ) ||
      new Set(choices).size !== choices.length
    ) {
      return reject(
        state,
        "INVALID_LIQUIDATION_CHOICES",
        `Liquidation choices must be an ordered list of unique industry IDs: ${seat}.`,
        { seat },
      );
    }
    if (!finalRoundOfGame && incomeLevels[seat] >= 0) {
      return reject(
        state,
        "UNEXPECTED_LIQUIDATION_CHOICES",
        `Non-negative-income seat must not submit liquidation choices: ${seat}.`,
        { seat },
      );
    }
  }

  const plans = new Map<string, PlannedSettlement>();

  for (const seat of state.turnOrder) {
    const ownedIndustries = Object.entries(state.board.placedIndustries)
      .filter(([, industry]) => industry.owner === seat)
      .sort(([left], [right]) => left.localeCompare(right));
    const choices = Object.hasOwn(liquidationChoices, seat)
      ? liquidationChoices[seat]
      : [];
    for (const industryId of choices) {
      const industry = state.board.placedIndustries[industryId];
      if (!industry || industry.owner !== seat) {
        return reject(
          state,
          "INDUSTRY_NOT_OWNED",
          `Seat ${seat} cannot liquidate industry ${industryId}.`,
          { seat, industryId },
        );
      }
    }

    let settlement: RoundIncomeSettlement;
    try {
      settlement = settleRoundIncome({
        markerSpace: state.players[seat].incomeMarkerSpace,
        money: state.players[seat].money,
        victoryPoints: state.players[seat].victoryPoints,
        finalRoundOfGame,
        liquidatableIndustries: ownedIndustries.map(([industryId, industry]) => ({
          id: industryId,
          buildCost: INDUSTRY_TILE_BY_ID[industry.tileId].build.money,
        })),
        industriesToRemove: choices,
      });
    } catch (error) {
      return reject(
        state,
        "INCOME_SETTLEMENT_FAILED",
        messageFrom(error),
        { seat },
      );
    }
    plans.set(seat, {
      settlement,
      removed: settlement.removedIndustryIds.map((industryId) => ({
        industryId,
        industry: state.board.placedIndustries[industryId],
      })),
    });
  }

  const players = { ...state.players };
  const placedIndustries = { ...state.board.placedIndustries };
  const settlementEntries: Array<[string, RoundIncomeSettlement]> = [];
  for (const seat of state.turnOrder) {
    const plan = plans.get(seat);
    if (!plan) {
      return reject(
        state,
        "INCOME_SETTLEMENT_FAILED",
        `Missing planned settlement for ${seat}.`,
        { seat },
      );
    }
    const removedTileIds = plan.removed.map(({ industry }) => industry.tileId);
    for (const { industryId } of plan.removed) {
      delete placedIndustries[industryId];
    }
    players[seat] = {
      ...state.players[seat],
      money: plan.settlement.money,
      victoryPoints: plan.settlement.victoryPoints,
      removedIndustryTileIds: [
        ...state.players[seat].removedIndustryTileIds,
        ...removedTileIds,
      ],
    };
    settlementEntries.push([seat, plan.settlement]);
  }
  const settlements = Object.fromEntries(settlementEntries) as Record<
    string,
    RoundIncomeSettlement
  >;

  const nextTurnOrder = determineNextTurnOrder(
    state.turnOrder,
    state.roundSpend,
  );
  const eraComplete = finalRoundOfEra;
  const nextRound = eraComplete ? state.round : state.round + 1;
  const eventData = {
    settlementComplete: true,
    era: state.era,
    completedRound: state.round,
    eraComplete,
    nextRound: eraComplete ? null : nextRound,
    previousTurnOrder: state.turnOrder,
    nextTurnOrder,
    incomeSkipped: finalRoundOfGame,
    settlements,
  };
  const nextState: GameStateV2 = {
    ...state,
    revision: state.revision + 1,
    round: nextRound,
    turnOrder: nextTurnOrder,
    currentSeat: nextTurnOrder[0],
    actionsUsed: 0,
    actionLimit: eraComplete
      ? state.actionLimit
      : actionsPerTurn(state.era, nextRound),
    roundSpend: createRoundSpendLedger(nextTurnOrder),
    players,
    board: { ...state.board, placedIndustries },
    events: appendEvent(state, "ROUND_SETTLED", eventData),
  };
  const invalidTransition = validateTransition(state, nextState);
  if (invalidTransition) return invalidTransition;

  return { ok: true, state: nextState, eraComplete, settlements };
}

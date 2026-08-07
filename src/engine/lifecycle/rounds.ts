import { SETUP_DATA } from "../rules/generated/ruleset";

export type LifecycleEra = keyof typeof SETUP_DATA.eras;
export type RoundSeatId = string;
export type RoundSpendLedger = Readonly<Record<RoundSeatId, number>>;

function assertSeats(seats: readonly RoundSeatId[]): void {
  if (seats.length < 2 || seats.length > 4) {
    throw new RangeError("Turn order requires 2–4 seats");
  }
  if (seats.some((seat) => typeof seat !== "string" || seat.trim().length === 0)) {
    throw new TypeError("Seat IDs must be nonempty strings");
  }
  if (new Set(seats).size !== seats.length) {
    throw new Error("Seat IDs must be unique");
  }
}

export function actionsPerTurn(
  era: LifecycleEra,
  roundNumber: number,
): 1 | 2 {
  if (!Number.isSafeInteger(roundNumber) || roundNumber < 1) {
    throw new RangeError("Round number must be a positive integer");
  }

  const eraRules = SETUP_DATA.eras[era];
  if (!eraRules) {
    throw new RangeError(`Unsupported era: ${String(era)}`);
  }
  return roundNumber === 1
    ? eraRules.firstRoundActions
    : eraRules.laterRoundActions;
}

export function createRoundSpendLedger(
  seats: readonly RoundSeatId[],
): RoundSpendLedger {
  assertSeats(seats);
  return Object.fromEntries(seats.map((seat) => [seat, 0]));
}

export function recordRoundSpending(
  ledger: RoundSpendLedger,
  seat: RoundSeatId,
  amount: number,
): RoundSpendLedger {
  if (!Object.hasOwn(ledger, seat)) {
    throw new Error(`Unknown seat: ${seat}`);
  }
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("Spent money must be a non-negative integer");
  }

  return { ...ledger, [seat]: ledger[seat] + amount };
}

/**
 * Least money spent goes first. Array stability preserves the previous order
 * for tied players, exactly matching the end-of-round rule.
 */
export function determineNextTurnOrder(
  currentOrder: readonly RoundSeatId[],
  ledger: RoundSpendLedger,
): RoundSeatId[] {
  assertSeats(currentOrder);
  const expectedSeats = new Set(currentOrder);
  const ledgerSeats = Object.keys(ledger);

  if (
    ledgerSeats.length !== currentOrder.length ||
    ledgerSeats.some((seat) => !expectedSeats.has(seat))
  ) {
    throw new Error("Spend ledger must contain exactly the seats in turn order");
  }
  for (const seat of currentOrder) {
    if (!Number.isSafeInteger(ledger[seat]) || ledger[seat] < 0) {
      throw new RangeError(`Invalid spent money for seat: ${seat}`);
    }
  }

  return currentOrder
    .map((seat, priorIndex) => ({ seat, priorIndex, spent: ledger[seat] }))
    .sort((left, right) => left.spent - right.spent || left.priorIndex - right.priorIndex)
    .map(({ seat }) => seat);
}

export function nextSeat(
  turnOrder: readonly RoundSeatId[],
  currentSeat: RoundSeatId,
): { seat: RoundSeatId; roundComplete: boolean } {
  assertSeats(turnOrder);
  const currentIndex = turnOrder.indexOf(currentSeat);
  if (currentIndex === -1) {
    throw new Error(`Current seat is not in turn order: ${currentSeat}`);
  }
  const roundComplete = currentIndex === turnOrder.length - 1;
  return {
    seat: turnOrder[(currentIndex + 1) % turnOrder.length],
    roundComplete,
  };
}

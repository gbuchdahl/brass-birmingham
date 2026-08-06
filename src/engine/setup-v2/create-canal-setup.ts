import {
  CARD_CATALOG,
  DRAW_DECK_SIZE_BY_PLAYER_COUNT,
  WILD_CARD_SUPPLY,
  type RulesPhysicalCardId,
} from "../rules/generated/cards";
import { RULESET_META, SETUP_DATA } from "../rules/generated/ruleset";
import { shuffleInPlace } from "../util/rng";
import {
  CANAL_SETUP_SCHEMA_VERSION,
  type CanalSetupResult,
  type SeatId,
  type SupportedPlayerCount,
} from "./types";

function validateSeats(seats: readonly SeatId[]): SupportedPlayerCount {
  if (!Array.isArray(seats)) {
    throw new TypeError("Seats must be an array");
  }

  if (seats.length < 2 || seats.length > 4) {
    throw new RangeError("Brass: Birmingham requires 2–4 seats");
  }

  for (const seat of seats) {
    if (typeof seat !== "string" || seat.trim().length === 0) {
      throw new TypeError("Seat IDs must be nonempty strings");
    }
  }

  if (new Set(seats).size !== seats.length) {
    throw new Error("Seat IDs must be unique");
  }

  return seats.length as SupportedPlayerCount;
}

function regularCardIds(playerCount: SupportedPlayerCount): RulesPhysicalCardId[] {
  const ids = CARD_CATALOG.filter((card) =>
    (card.includedAt as readonly number[]).includes(playerCount),
  ).map((card) => card.id);

  const setupDeckSize = SETUP_DATA.playerCounts[playerCount].regularCards;
  const catalogDeckSize = DRAW_DECK_SIZE_BY_PLAYER_COUNT[playerCount];
  if (ids.length !== setupDeckSize || ids.length !== catalogDeckSize) {
    throw new Error(
      `Generated card and setup data disagree for ${playerCount} players`,
    );
  }

  return ids;
}

/**
 * Builds the complete regular-card state at the start of the Canal Era.
 *
 * The returned value contains only JSON-compatible data. The generated rules
 * catalog and caller-provided seats are copied before any ordering occurs.
 */
export function createCanalSetup(
  seats: readonly SeatId[],
  seed: string,
): CanalSetupResult {
  const playerCount = validateSeats(seats);
  const seatOrder = [...seats];
  const shuffled = shuffleInPlace(regularCardIds(playerCount), seed);
  const hands = Object.fromEntries(
    seatOrder.map((seat) => [seat, [] as RulesPhysicalCardId[]]),
  ) as Record<SeatId, RulesPhysicalCardId[]>;

  let nextCard = 0;
  for (let cardNumber = 0; cardNumber < SETUP_DATA.shared.handSize; cardNumber += 1) {
    for (const seat of seatOrder) {
      hands[seat].push(shuffled[nextCard]);
      nextCard += 1;
    }
  }

  const initialDiscardCount =
    playerCount * SETUP_DATA.shared.initialDiscardPerPlayer;
  const discard = shuffled.slice(nextCard, nextCard + initialDiscardCount);
  nextCard += initialDiscardCount;

  return {
    schemaVersion: CANAL_SETUP_SCHEMA_VERSION,
    ruleset: {
      id: RULESET_META.id,
      version: RULESET_META.version,
    },
    era: "canal",
    seed,
    seats: seatOrder,
    hands,
    draw: shuffled.slice(nextCard),
    discard,
    wildSupplies: {
      location: WILD_CARD_SUPPLY.location,
      industry: WILD_CARD_SUPPLY.industry,
    },
  };
}

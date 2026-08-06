import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type CardZones,
  type PlayableCardId,
} from "../cards-v2/types";
import {
  CARD_CATALOG,
  WILD_CARD_SUPPLY,
  type RulesPhysicalCardId,
} from "../rules/generated/cards";
import { RULESET_META, SETUP_DATA } from "../rules/generated/ruleset";
import { shuffleInPlace } from "../util/rng";
import type { SeatId, SupportedPlayerCount } from "./types";

export const RAIL_SETUP_SCHEMA_VERSION = 1 as const;

export type RailSetupResult = {
  readonly schemaVersion: typeof RAIL_SETUP_SCHEMA_VERSION;
  readonly ruleset: {
    readonly id: string;
    readonly version: string;
  };
  readonly era: "rail";
  readonly seed: string;
  readonly seats: SeatId[];
  readonly hands: Record<SeatId, PlayableCardId[]>;
  readonly draw: RulesPhysicalCardId[];
  readonly discard: RulesPhysicalCardId[];
  readonly wildSupplies: {
    readonly location: number;
    readonly industry: number;
  };
};

function validateSeats(seats: readonly SeatId[]): SupportedPlayerCount {
  if (!Array.isArray(seats) || seats.length < 2 || seats.length > 4) {
    throw new RangeError("Brass: Birmingham requires 2–4 seats");
  }
  if (
    seats.some(
      (seat) => typeof seat !== "string" || seat.trim().length === 0,
    )
  ) {
    throw new TypeError("Seat IDs must be nonempty strings");
  }
  if (new Set(seats).size !== seats.length) {
    throw new Error("Seat IDs must be unique");
  }
  return seats.length as SupportedPlayerCount;
}

function expectedRegularCards(
  playerCount: SupportedPlayerCount,
): RulesPhysicalCardId[] {
  return CARD_CATALOG.filter((card) =>
    (card.includedAt as readonly number[]).includes(playerCount),
  ).map((card) => card.id);
}

function collectAndValidateCards(
  zones: CardZones,
  seats: readonly SeatId[],
  playerCount: SupportedPlayerCount,
): RulesPhysicalCardId[] {
  if (typeof zones !== "object" || zones === null) {
    throw new TypeError("Card zones must be an object");
  }
  const zoneSeats = Object.keys(zones.hands);
  if (
    zoneSeats.length !== seats.length ||
    zoneSeats.some((seat) => !seats.includes(seat))
  ) {
    throw new Error("Card-zone hands must contain exactly the setup seats");
  }
  if (!Array.isArray(zones.draw) || !Array.isArray(zones.discard)) {
    throw new TypeError("Draw and discard zones must be arrays");
  }

  const expected = expectedRegularCards(playerCount);
  const expectedSet = new Set<PlayableCardId>(expected);
  const regular: RulesPhysicalCardId[] = [];
  let wildLocations = zones.wildSupplies.location;
  let wildIndustries = zones.wildSupplies.industry;

  if (
    !Number.isSafeInteger(wildLocations) ||
    wildLocations < 0 ||
    !Number.isSafeInteger(wildIndustries) ||
    wildIndustries < 0
  ) {
    throw new RangeError("Wild supplies must be non-negative integers");
  }

  const collect = (cardId: PlayableCardId): void => {
    if (cardId === WILD_LOCATION_CARD_ID) {
      wildLocations += 1;
      return;
    }
    if (cardId === WILD_INDUSTRY_CARD_ID) {
      wildIndustries += 1;
      return;
    }
    if (!expectedSet.has(cardId)) {
      throw new Error(`Card is not used at ${playerCount} players: ${cardId}`);
    }
    regular.push(cardId);
  };

  for (const seat of seats) {
    const hand = zones.hands[seat];
    if (!Array.isArray(hand)) throw new TypeError(`Hand must be an array: ${seat}`);
    for (const cardId of hand) collect(cardId);
  }
  for (const cardId of zones.draw) collect(cardId);
  for (const cardId of zones.discard) collect(cardId);

  if (
    wildLocations !== WILD_CARD_SUPPLY.location ||
    wildIndustries !== WILD_CARD_SUPPLY.industry
  ) {
    throw new Error("Rail setup must conserve all Wild cards");
  }
  if (
    regular.length !== expected.length ||
    new Set(regular).size !== regular.length ||
    expected.some((cardId) => !regular.includes(cardId))
  ) {
    throw new Error("Rail setup must conserve every eligible regular card exactly once");
  }
  return regular;
}

/** Collects the Canal card zones, reshuffles them, and deals the Rail hands. */
export function createRailSetup(
  seats: readonly SeatId[],
  zones: CardZones,
  seed: string,
): RailSetupResult {
  const playerCount = validateSeats(seats);
  if (typeof seed !== "string") {
    throw new TypeError("Rail setup seed must be a string");
  }
  const seatOrder = [...seats];
  const shuffled = shuffleInPlace(
    collectAndValidateCards(zones, seatOrder, playerCount),
    seed,
  );
  const hands = Object.fromEntries(
    seatOrder.map((seat) => [seat, [] as PlayableCardId[]]),
  ) as Record<SeatId, PlayableCardId[]>;

  let nextCard = 0;
  for (
    let cardNumber = 0;
    cardNumber < SETUP_DATA.shared.handSize;
    cardNumber += 1
  ) {
    for (const seat of seatOrder) {
      hands[seat].push(shuffled[nextCard]);
      nextCard += 1;
    }
  }

  return {
    schemaVersion: RAIL_SETUP_SCHEMA_VERSION,
    ruleset: { id: RULESET_META.id, version: RULESET_META.version },
    era: "rail",
    seed,
    seats: seatOrder,
    hands,
    draw: shuffled.slice(nextCard),
    discard: [],
    wildSupplies: {
      location: WILD_CARD_SUPPLY.location,
      industry: WILD_CARD_SUPPLY.industry,
    },
  };
}

import type { GameState, PlayerId, PlayerState } from "../types";
import type { DeckState } from "../cards";
import {
  COAL_MARKET_FALLBACK_PRICE,
  HAND_SIZE_BY_PLAYER_COUNT,
  INITIAL_COAL_MARKET_UNITS,
  INITIAL_IRON_MARKET_UNITS,
  IRON_MARKET_FALLBACK_PRICE,
  STARTING_MONEY,
} from "../rules/config";
import { buildDeck, dealToPlayers } from "../cards";
import { TOPOLOGY } from "../board/topology";

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export function createGame(
  seats: PlayerId[],
  seed: string | undefined = process.env.NODE_ENV === "production" ? undefined : "dev-seed",
): GameState {
  const resolvedSeed = seed ?? uid();

  if (seats.length < 2 || seats.length > 4) {
    throw new Error("Brass requires 2–4 players");
  }

  const deck: DeckState = buildDeck(resolvedSeed);
  const handSize = HAND_SIZE_BY_PLAYER_COUNT[seats.length] ?? 8;
  const { hands, deck: deckAfterDeal } = dealToPlayers(deck, seats, handSize);

  const players: Record<PlayerId, PlayerState> = {};
  for (const id of seats) {
    players[id] = {
      id,
      money: STARTING_MONEY,
      income: 0,
      hand: hands[id] ?? [],
      vp: 0,
    };
  }

  const linkStates = TOPOLOGY.edges.map(() => ({}));
  const market = {
    coal: {
      units: INITIAL_COAL_MARKET_UNITS,
      fallbackPrice: COAL_MARKET_FALLBACK_PRICE,
    },
    iron: {
      units: INITIAL_IRON_MARKET_UNITS,
      fallbackPrice: IRON_MARKET_FALLBACK_PRICE,
    },
  };

  return {
    id: `game-${resolvedSeed}`,
    seed: resolvedSeed,
    phase: "canal",
    round: 1,
    turn: 1,
    actionsTakenThisTurn: 0,
    seatOrder: [...seats],
    currentPlayer: seats[0],
    players,
    log: [
      {
        idx: 0,
        type: "GAME_CREATED",
        data: { seats, seed: resolvedSeed, handSize },
      },
    ],
    deck: deckAfterDeal,
    market,
    board: {
      topology: TOPOLOGY,
      linkStates,
      tiles: {},
    },
  };
}

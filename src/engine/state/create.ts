import type { GameState, PlayerId, PlayerState } from "../types";
import type { DeckState } from "../cards";
import { HAND_SIZE_BY_PLAYER_COUNT } from "../rules/config";
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
      money: 0,
      income: 0,
      hand: hands[id] ?? [],
      vp: 0,
    };
  }

  const linkStates = TOPOLOGY.edges.map(() => ({}));

  return {
    id: `game-${resolvedSeed}`,
    seed: resolvedSeed,
    phase: "canal",
    round: 1,
    turn: 1,
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
    board: {
      topology: TOPOLOGY,
      linkStates,
    },
  };
}

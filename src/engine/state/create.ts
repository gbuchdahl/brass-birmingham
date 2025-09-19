import type { GameState, PlayerId, PlayerState } from "../types";

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

  const players: Record<PlayerId, PlayerState> = {};
  for (const id of seats) {
    players[id] = {
      id,
      money: 0, // tune later
      income: 0, // tune later
      hand: [], // deal in later milestones
      vp: 0,
    };
  }

  return {
    id: uid(),
    seed: resolvedSeed,
    phase: "Canal",
    round: 1,
    turn: 1,
    seatOrder: [...seats],
    currentPlayer: seats[0],
    players,
    log: [{ idx: 0, type: "GAME_CREATED", data: { seats, seed: resolvedSeed } }],
  };
}

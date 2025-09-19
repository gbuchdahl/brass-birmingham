const games = new Map<string, unknown>();

export function getGame(id: string) {
  return games.get(id);
}

export function setGame(id: string, state: unknown) {
  games.set(id, state);
}

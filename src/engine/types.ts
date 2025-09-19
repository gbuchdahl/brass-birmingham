export type PlayerId = string;

export type GameState = Record<string, never>;

export type Action = {
  type: string;
  [key: string]: unknown;
};

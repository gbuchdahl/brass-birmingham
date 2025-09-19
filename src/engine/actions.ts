export type ActionType = string;

export type Action = {
  type: ActionType;
  [key: string]: unknown;
};

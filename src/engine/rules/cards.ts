import type { BuildIndustry } from "../actions";
import { discardCards } from "../cards/deck";
import type { Card, CardId } from "../cards/types";
import { CITY_DEFS } from "../board/topology";
import type { CityId, NodeId } from "../board/topology";
import type { GameState, IndustryKind, PlayerId } from "../types";

export type BuildCardErrorCode =
  | "CARD_NOT_IN_HAND"
  | "INVALID_BUILD_CARD"
  | "CARD_DOES_NOT_ALLOW_BUILD"
  | "BUILD_NOT_CONNECTED_FOR_CARD";

export type BuildCardValidationResult =
  | {
      ok: true;
      card: Card;
      cardKind: Card["kind"];
    }
  | {
      ok: false;
      code: BuildCardErrorCode;
      message: string;
    };

function normalizeIndustry(value: string): IndustryKind | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "coal" || normalized === "iron") {
    return normalized;
  }
  return null;
}

function isCityId(value: string): value is CityId {
  return value in CITY_DEFS;
}

function getCardFromHand(state: GameState, player: PlayerId, cardId: CardId): Card | null {
  const hand = state.players[player]?.hand ?? [];
  if (!hand.includes(cardId)) {
    return null;
  }
  const card = state.deck.byId[cardId];
  return card ?? null;
}

function playerGraph(state: GameState, player: PlayerId): Map<NodeId, Set<NodeId>> {
  const graph = new Map<NodeId, Set<NodeId>>();
  state.board.topology.edges.forEach((edge, index) => {
    if (state.board.linkStates[index].builtBy !== player) {
      return;
    }
    const [a, b] = edge.nodes;
    if (!graph.has(a)) {
      graph.set(a, new Set());
    }
    if (!graph.has(b)) {
      graph.set(b, new Set());
    }
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  });
  return graph;
}

export function isCityInPlayerNetwork(
  state: GameState,
  player: PlayerId,
  city: CityId,
): boolean {
  const graph = playerGraph(state, player);
  if (graph.size === 0 || !graph.has(city)) {
    return false;
  }

  const visited = new Set<NodeId>();
  const queue: NodeId[] = [city];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    const next = graph.get(node);
    if (!next) {
      continue;
    }
    for (const neighbor of next) {
      queue.push(neighbor);
    }
  }

  return visited.has(city);
}

export function validateBuildCard(
  state: GameState,
  action: BuildIndustry,
): BuildCardValidationResult {
  const card = getCardFromHand(state, action.player, action.cardId);
  if (!card) {
    return {
      ok: false,
      code: "CARD_NOT_IN_HAND",
      message: "Build card is not in the acting player's hand.",
    };
  }

  switch (card.kind) {
    case "Wild":
      return { ok: true, card, cardKind: card.kind };
    case "Location": {
      const city = card.payload?.city;
      if (typeof city !== "string") {
        return {
          ok: false,
          code: "INVALID_BUILD_CARD",
          message: "Location card is missing a city payload.",
        };
      }
      if (!isCityId(city) || city !== action.city) {
        return {
          ok: false,
          code: "CARD_DOES_NOT_ALLOW_BUILD",
          message: "Location card does not allow a build in that city.",
        };
      }
      return { ok: true, card, cardKind: card.kind };
    }
    case "Industry": {
      const industry = card.payload?.industry;
      if (typeof industry !== "string") {
        return {
          ok: false,
          code: "INVALID_BUILD_CARD",
          message: "Industry card is missing an industry payload.",
        };
      }
      const normalized = normalizeIndustry(industry);
      if (!normalized) {
        return {
          ok: false,
          code: "INVALID_BUILD_CARD",
          message: "Industry card payload is not supported in this milestone.",
        };
      }
      if (normalized !== action.industry) {
        return {
          ok: false,
          code: "CARD_DOES_NOT_ALLOW_BUILD",
          message: "Industry card does not match the requested industry.",
        };
      }
      if (!isCityInPlayerNetwork(state, action.player, action.city)) {
        return {
          ok: false,
          code: "BUILD_NOT_CONNECTED_FOR_CARD",
          message: "Industry card builds require the city to be in the player's network.",
        };
      }
      return { ok: true, card, cardKind: card.kind };
    }
    default:
      return {
        ok: false,
        code: "INVALID_BUILD_CARD",
        message: "Unsupported card type for build action.",
      };
  }
}

export function consumeCardFromHand(
  state: GameState,
  player: PlayerId,
  cardId: CardId,
): GameState {
  const hand = state.players[player]?.hand ?? [];
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hand: hand.filter((id) => id !== cardId),
      },
    },
    deck: discardCards(state.deck, [cardId]),
  };
}

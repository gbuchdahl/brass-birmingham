import type {
  NetworkActionEffect,
  NetworkActionSelection,
  NetworkCoalChoice,
} from "../actions-v2/network";
import type { PlayableCardId } from "../cards-v2/types";
import { BOARD_V2 } from "../rules/generated/board-v2";
import { INDUSTRY_TILE_BY_ID } from "../rules/generated/industry-tiles-v2";
import {
  executeNetworkForGameV2,
  type FlipIncomeAwardV2,
  type GameV2ActionAdapterResult,
} from "./action-adapters";
import {
  validateGameStateV2,
  type GameStateV2,
} from "./state";

export type GameV2RailNetworkDisabledReasonCode =
  | "INVALID_GAME_STATE"
  | "GAME_ALREADY_ENDED"
  | "NOT_ACTION_PHASE"
  | "ACTOR_REQUIRED"
  | "UNKNOWN_ACTOR"
  | "NOT_CURRENT_ACTOR"
  | "ACTION_LIMIT_REACHED"
  | "NOT_RAIL_ERA"
  | "CARD_REQUIRED"
  | "CARD_NOT_IN_HAND"
  | "INSUFFICIENT_LINK_TOKENS"
  | "INSUFFICIENT_MONEY"
  | "INVALID_NETWORK_PREFIX"
  | "NO_LEGAL_RAIL_NETWORK";

export type GameV2RailNetworkDisabledReason = {
  readonly code: GameV2RailNetworkDisabledReasonCode;
  readonly message: string;
};

export type GameV2RailLinkSummary = {
  readonly linkId: string;
  /** One-based placement order for presentation. */
  readonly order: number;
  readonly endpoints: readonly {
    readonly locationId: string;
    readonly locationLabel: string;
  }[];
};

export type GameV2RailMineCoalSummary = {
  readonly kind: "mine";
  readonly linkId: string;
  readonly industryId: string;
  readonly owner: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly coalRemaining: number;
  readonly depleted: boolean;
};

export type GameV2RailMarketCoalSummary = {
  readonly kind: "market";
  readonly linkId: string;
  readonly unitPrice: number;
};

export type GameV2RailCoalSummary =
  | GameV2RailMineCoalSummary
  | GameV2RailMarketCoalSummary;

export type GameV2RailBeerSummary = {
  readonly industryId: string;
  readonly owner: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly beerRemaining: number;
  readonly depleted: boolean;
};

export type GameV2RailNetworkPlan = {
  /** Complete selection accepted by the authoritative Network adapter. */
  readonly selection: NetworkActionSelection;
  readonly linkCount: 1 | 2;
  readonly links: readonly GameV2RailLinkSummary[];
  readonly coalSources: readonly GameV2RailCoalSummary[];
  readonly beerSource: GameV2RailBeerSummary | null;
  readonly flippedIndustryIds: readonly string[];
  readonly incomeAwards: readonly FlipIncomeAwardV2[];
  readonly actionsConsumed: 1;
  readonly costs: {
    readonly links: number;
    readonly resources: number;
    readonly total: number;
  };
  readonly playerResult: {
    readonly money: number;
    readonly moneyChange: number;
    readonly linkTokensRemaining: number;
    readonly linkTokensUsed: number;
  };
  readonly marketResult: {
    readonly coalBefore: number;
    readonly coalAfter: number;
    readonly coalPurchased: number;
  };
};

export type GameV2RailNetworkLegalOptions = {
  readonly availability: "exact" | "disabled";
  readonly actorSeat: string | null;
  readonly cardId: PlayableCardId | null;
  /** The accepted one-link prefix being extended, if any. */
  readonly selectedPrefix: NetworkActionSelection | null;
  /** Submit this one-link plan now instead of extending it. */
  readonly currentPlan: GameV2RailNetworkPlan | null;
  /** One-link plans initially, or exact ordered two-link extensions. */
  readonly nextPlans: readonly GameV2RailNetworkPlan[];
  readonly reason: GameV2RailNetworkDisabledReason | null;
};

type RailLink = (typeof BOARD_V2.links)[number];

const RAIL_LINKS: readonly RailLink[] = BOARD_V2.links.filter((link) =>
  (link.eras as readonly string[]).includes("rail")
);

const LOCATION_LABELS = new Map(
  Object.entries(BOARD_V2.locations).map(([locationId, location]) => [
    locationId,
    location.label,
  ]),
);

const BOARD_SPACE_IDS: readonly string[] = Object.values(
  BOARD_V2.locations,
).flatMap((location) =>
  "buildSpaces" in location
    ? location.buildSpaces.map((space) => space.id)
    : []
);

function cloneCoalChoice(choice: NetworkCoalChoice): NetworkCoalChoice {
  return choice.kind === "market"
    ? { kind: "market" }
    : { kind: "mine", industryId: choice.industryId };
}

function cloneSelection(
  selection: NetworkActionSelection,
): NetworkActionSelection {
  return {
    linkIds: [...selection.linkIds],
    coalSources: selection.coalSources.map(cloneCoalChoice),
    beerSourceId: selection.beerSourceId,
    cardId: selection.cardId,
  };
}

function disabled(
  actorSeat: string | null,
  cardId: PlayableCardId | null,
  code: GameV2RailNetworkDisabledReasonCode,
  message: string,
): GameV2RailNetworkLegalOptions {
  return {
    availability: "disabled",
    actorSeat,
    cardId,
    selectedPrefix: null,
    currentPlan: null,
    nextPlans: [],
    reason: { code, message },
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoalChoice(value: unknown): value is NetworkCoalChoice {
  if (!isRecord(value)) return false;
  return value.kind === "market" ||
    (value.kind === "mine" &&
      typeof value.industryId === "string" &&
      value.industryId.length > 0);
}

function isOneLinkPrefix(
  value: unknown,
  selectedCardId: PlayableCardId,
): value is NetworkActionSelection {
  return isRecord(value) &&
    Array.isArray(value.linkIds) &&
    value.linkIds.length === 1 &&
    typeof value.linkIds[0] === "string" &&
    value.linkIds[0].length > 0 &&
    Array.isArray(value.coalSources) &&
    value.coalSources.length === 1 &&
    isCoalChoice(value.coalSources[0]) &&
    value.beerSourceId === null &&
    value.cardId === selectedCardId;
}

function coalCandidates(state: GameStateV2): readonly NetworkCoalChoice[] {
  return [
    ...BOARD_SPACE_IDS.flatMap((industryId) => {
      const placement = state.board.placedIndustries[industryId];
      return placement &&
          INDUSTRY_TILE_BY_ID[placement.tileId].industry === "coal" &&
          !placement.flipped &&
          placement.resources.coal > 0
        ? [{ kind: "mine" as const, industryId }]
        : [];
    }),
    { kind: "market" as const },
  ];
}

function breweryCandidates(
  state: GameStateV2,
  actorSeat: string,
): readonly string[] {
  return BOARD_SPACE_IDS.flatMap((industryId) => {
    const placement = state.board.placedIndustries[industryId];
    return placement &&
        placement.owner === actorSeat &&
        INDUSTRY_TILE_BY_ID[placement.tileId].industry === "brewery" &&
        !placement.flipped &&
        placement.resources.beer > 0
      ? [industryId]
      : [];
  });
}

function execute(
  state: GameStateV2,
  selection: NetworkActionSelection,
): GameV2ActionAdapterResult<NetworkActionEffect> {
  try {
    return executeNetworkForGameV2(state, selection);
  } catch {
    return {
      ok: false,
      state,
      error: {
        code: "INVALID_LINK_COUNT",
        message: "Rail Network selection is malformed.",
      },
    };
  }
}

type AcceptedNetwork = Extract<
  GameV2ActionAdapterResult<NetworkActionEffect>,
  { readonly ok: true }
>;

function projectCoalSources(
  state: GameStateV2,
  result: AcceptedNetwork,
): readonly GameV2RailCoalSummary[] {
  const remainingByMine = new Map<string, number>();
  return result.effect.coalSources.map((source, index) => {
    const linkId = result.effect.links[index].linkId;
    if (source.kind === "market") {
      return {
        kind: "market",
        linkId,
        unitPrice: source.unitPrice,
      };
    }
    const placement = state.board.placedIndustries[source.industryId];
    if (!placement) {
      throw new Error(
        `Accepted Rail Network referenced a missing mine: ${source.industryId}.`,
      );
    }
    const before = remainingByMine.get(source.industryId) ??
      placement.resources.coal;
    const coalRemaining = before - 1;
    remainingByMine.set(source.industryId, coalRemaining);
    return {
      kind: "mine",
      linkId,
      industryId: source.industryId,
      owner: placement.owner,
      locationId: source.locationId,
      locationLabel: LOCATION_LABELS.get(source.locationId) ?? source.locationId,
      coalRemaining,
      depleted: source.depleted,
    };
  });
}

function projectBeerSource(
  state: GameStateV2,
  result: AcceptedNetwork,
): GameV2RailBeerSummary | null {
  const source = result.effect.beerSource;
  if (source === null) return null;
  const before = state.board.placedIndustries[source.industryId];
  const after = result.state.board.placedIndustries[source.industryId];
  if (!before || !after) {
    throw new Error(
      `Accepted Rail Network referenced a missing Brewery: ${source.industryId}.`,
    );
  }
  return {
    industryId: source.industryId,
    owner: before.owner,
    locationId: source.locationId,
    locationLabel: LOCATION_LABELS.get(source.locationId) ?? source.locationId,
    beerRemaining: after.resources.beer,
    depleted: source.depleted,
  };
}

function projectPlan(
  state: GameStateV2,
  selection: NetworkActionSelection,
  result: AcceptedNetwork,
): GameV2RailNetworkPlan {
  const actorSeat = result.effect.seat;
  const before = state.players[actorSeat];
  const after = result.state.players[actorSeat];
  const marketCoalBefore = state.market.coal;
  const marketCoalAfter = result.state.market.coal;
  return {
    selection: cloneSelection(selection),
    linkCount: result.effect.links.length as 1 | 2,
    links: result.effect.links.map(({ linkId }, index) => {
      const link = RAIL_LINKS.find((candidate) => candidate.id === linkId);
      if (!link) throw new Error(`Accepted Rail Network used unknown link ${linkId}.`);
      return {
        linkId,
        order: index + 1,
        endpoints: link.adjacentLocations.map((locationId) => ({
          locationId,
          locationLabel: LOCATION_LABELS.get(locationId) ?? locationId,
        })),
      };
    }),
    coalSources: projectCoalSources(state, result),
    beerSource: projectBeerSource(state, result),
    flippedIndustryIds: [...result.effect.flippedIndustryIds],
    incomeAwards: result.effect.incomeAwards.map((award) => ({ ...award })),
    actionsConsumed: 1,
    costs: {
      links: result.effect.linkCost,
      resources: result.effect.resourceCost,
      total: result.effect.moneySpent,
    },
    playerResult: {
      money: after.money,
      moneyChange: after.money - before.money,
      linkTokensRemaining: after.linkTokensRemaining,
      linkTokensUsed: before.linkTokensRemaining - after.linkTokensRemaining,
    },
    marketResult: {
      coalBefore: marketCoalBefore,
      coalAfter: marketCoalAfter,
      coalPurchased: marketCoalBefore - marketCoalAfter,
    },
  };
}

/**
 * Enumerates exact Rail Network plans one bounded decision layer at a time.
 *
 * Without `selectedPrefix`, every accepted one-link/link-coal combination is
 * returned. Passing one emitted selection back makes it `currentPlan` and
 * enumerates every accepted ordered second-link/coal/own-beer extension from
 * the original state. This avoids eagerly materializing all first × second
 * products while keeping every returned selection reducer-ready.
 *
 * The authoritative adapter decides placement reach, the first-link-anywhere
 * exception, coal connectivity and priority, sequential market prices, beer,
 * affordability, and token availability. Only byte-identical resulting
 * adapter states are collapsed.
 */
export function getGameV2RailNetworkLegalOptions(
  state: GameStateV2,
  actorSeat: string | null,
  selectedCardId: PlayableCardId | null,
  selectedPrefix: NetworkActionSelection | null = null,
): GameV2RailNetworkLegalOptions {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    return disabled(
      actorSeat,
      selectedCardId,
      "INVALID_GAME_STATE",
      `${first.path}: ${first.message}`,
    );
  }
  if (state.progress.phase === "ended") {
    return disabled(
      actorSeat,
      selectedCardId,
      "GAME_ALREADY_ENDED",
      "The game has ended.",
    );
  }
  if (state.progress.phase !== "action") {
    return disabled(
      actorSeat,
      selectedCardId,
      "NOT_ACTION_PHASE",
      `Rail Network is unavailable during ${state.progress.phase}.`,
    );
  }
  if (actorSeat === null) {
    return disabled(
      actorSeat,
      selectedCardId,
      "ACTOR_REQUIRED",
      "Rail Network requires an actor.",
    );
  }
  if (!state.turnOrder.includes(actorSeat)) {
    return disabled(
      actorSeat,
      selectedCardId,
      "UNKNOWN_ACTOR",
      `Unknown actor seat: ${actorSeat}.`,
    );
  }
  if (actorSeat !== state.currentSeat) {
    return disabled(
      actorSeat,
      selectedCardId,
      "NOT_CURRENT_ACTOR",
      `Only ${state.currentSeat} may build Rail links now.`,
    );
  }
  if (state.actionsUsed >= state.actionLimit) {
    return disabled(
      actorSeat,
      selectedCardId,
      "ACTION_LIMIT_REACHED",
      "The current turn has already used its action allowance.",
    );
  }
  if (state.era !== "rail") {
    return disabled(
      actorSeat,
      selectedCardId,
      "NOT_RAIL_ERA",
      "Exact Rail Network plans are only available in the Rail Era.",
    );
  }
  if (
    selectedCardId === null ||
    typeof selectedCardId !== "string" ||
    selectedCardId.length === 0
  ) {
    return disabled(
      actorSeat,
      selectedCardId,
      "CARD_REQUIRED",
      "Choose an action card before selecting a Rail Network plan.",
    );
  }
  if (!state.cards.hands[actorSeat].includes(selectedCardId)) {
    return disabled(
      actorSeat,
      selectedCardId,
      "CARD_NOT_IN_HAND",
      "The selected Rail Network card is not in the active player's hand.",
    );
  }
  if (state.players[actorSeat].linkTokensRemaining < 1) {
    return disabled(
      actorSeat,
      selectedCardId,
      "INSUFFICIENT_LINK_TOKENS",
      "The active player has no link token remaining.",
    );
  }
  if (state.players[actorSeat].money < 5) {
    return disabled(
      actorSeat,
      selectedCardId,
      "INSUFFICIENT_MONEY",
      "A Rail Network action requires at least £5 before resource costs.",
    );
  }

  let currentPlan: GameV2RailNetworkPlan | null = null;
  let prefix: NetworkActionSelection | null = null;
  let candidateState = state;
  if (selectedPrefix !== null) {
    if (!isOneLinkPrefix(selectedPrefix, selectedCardId)) {
      return disabled(
        actorSeat,
        selectedCardId,
        "INVALID_NETWORK_PREFIX",
        "A Rail extension requires one accepted link, one coal source, no beer, and the selected card.",
      );
    }
    prefix = cloneSelection(selectedPrefix);
    const acceptedPrefix = execute(state, prefix);
    if (!acceptedPrefix.ok) {
      return disabled(
        actorSeat,
        selectedCardId,
        "INVALID_NETWORK_PREFIX",
        `${acceptedPrefix.error.code}: ${acceptedPrefix.error.message}`,
      );
    }
    currentPlan = projectPlan(state, prefix, acceptedPrefix);
    candidateState = acceptedPrefix.state;
  }

  const nextPlans: GameV2RailNetworkPlan[] = [];
  const materialOutcomes = new Set<string>();
  const candidateCoal = coalCandidates(candidateState);
  if (prefix === null) {
    for (const link of RAIL_LINKS) {
      for (const coalSource of candidateCoal) {
        const selection: NetworkActionSelection = {
          linkIds: [link.id],
          coalSources: [coalSource],
          beerSourceId: null,
          cardId: selectedCardId,
        };
        const planned = execute(state, selection);
        if (!planned.ok) continue;
        const materialOutcome = JSON.stringify(planned.state);
        if (materialOutcomes.has(materialOutcome)) continue;
        materialOutcomes.add(materialOutcome);
        nextPlans.push(projectPlan(state, selection, planned));
      }
    }
  } else {
    const firstLinkId = prefix.linkIds[0];
    const breweries = breweryCandidates(candidateState, actorSeat);
    for (const link of RAIL_LINKS) {
      if (link.id === firstLinkId) continue;
      for (const coalSource of candidateCoal) {
        for (const beerSourceId of breweries) {
          const selection: NetworkActionSelection = {
            linkIds: [firstLinkId, link.id],
            coalSources: [cloneCoalChoice(prefix.coalSources[0]), coalSource],
            beerSourceId,
            cardId: selectedCardId,
          };
          const planned = execute(state, selection);
          if (!planned.ok) continue;
          const materialOutcome = JSON.stringify(planned.state);
          if (materialOutcomes.has(materialOutcome)) continue;
          materialOutcomes.add(materialOutcome);
          nextPlans.push(projectPlan(state, selection, planned));
        }
      }
    }
  }

  if (currentPlan === null && nextPlans.length === 0) {
    return disabled(
      actorSeat,
      selectedCardId,
      "NO_LEGAL_RAIL_NETWORK",
      "No affordable Rail link has an authoritative coal source.",
    );
  }

  return {
    availability: "exact",
    actorSeat,
    cardId: selectedCardId,
    selectedPrefix: prefix,
    currentPlan,
    nextPlans,
    reason: null,
  };
}

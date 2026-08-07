import type { DevelopActionSelection } from "../actions-v2/develop";
import type { PlayableCardId } from "../cards-v2/types";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_KIND_ORDER,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import { executeDevelopForGameV2 } from "./action-adapters";
import {
  validateGameStateV2,
  type GameStateV2,
} from "./state";

export type GameV2DevelopLegalDisabledReasonCode =
  | "INVALID_GAME_STATE"
  | "GAME_ALREADY_ENDED"
  | "NOT_ACTION_PHASE"
  | "ACTOR_REQUIRED"
  | "UNKNOWN_ACTOR"
  | "NOT_CURRENT_ACTOR"
  | "ACTION_LIMIT_REACHED"
  | "CARD_REQUIRED"
  | "CARD_NOT_IN_HAND"
  | "NO_LEGAL_DEVELOP";

export type GameV2DevelopLegalDisabledReason = {
  readonly code: GameV2DevelopLegalDisabledReasonCode;
  readonly message: string;
};

export type GameV2DevelopTile = {
  readonly id: IndustryTileId;
  readonly industry: IndustryTileKind;
  readonly faceId: string;
  readonly level: number;
};

export type GameV2DevelopBoardIronSource = {
  /** Game selections call this an industry ID; canonically it is a board space ID. */
  readonly buildSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly owner: string;
  readonly cubesBefore: number;
  readonly unitsConsumed: number;
  readonly cubesRemaining: number;
  readonly depleted: boolean;
};

export type GameV2DevelopPlan = {
  readonly selection: DevelopActionSelection;
  /** Ordered physical removals, including sequential copies of one face. */
  readonly tiles: readonly GameV2DevelopTile[];
  readonly iron: {
    readonly requiredUnits: 1 | 2;
    readonly boardSources: readonly GameV2DevelopBoardIronSource[];
    readonly market: {
      readonly unitsPurchased: number;
      readonly unitPrices: readonly number[];
      readonly totalCost: number;
    };
  };
  readonly moneySpent: number;
  readonly outcome: {
    readonly moneyAfter: number;
    readonly marketIronUnitsAfter: number;
    readonly flippedProviderSpaceIds: readonly string[];
    readonly removedTileIds: readonly IndustryTileId[];
  };
};

export type GameV2DevelopLegalOptions = {
  readonly availability: "exact" | "disabled";
  readonly actorSeat: string | null;
  readonly cardId: PlayableCardId | null;
  readonly plans: readonly GameV2DevelopPlan[];
  readonly reason: GameV2DevelopLegalDisabledReason | null;
};

type IronSourceCandidate = {
  readonly buildSpaceId: string;
  readonly cubes: number;
};

const BUILD_SPACE_IDS = Object.values(BOARD_V2.locations).flatMap((location) =>
  "buildSpaces" in location
    ? location.buildSpaces.map((space) => space.id)
    : [],
);

const LOCATION_LABELS = new Map(
  Object.entries(BOARD_V2.locations).map(([locationId, location]) => [
    locationId,
    location.label,
  ]),
);

function disabled(
  actorSeat: string | null,
  cardId: PlayableCardId | null,
  code: GameV2DevelopLegalDisabledReasonCode,
  message: string,
): GameV2DevelopLegalOptions {
  return {
    availability: "disabled",
    actorSeat,
    cardId,
    plans: [],
    reason: { code, message },
  };
}

/**
 * Only the first two remaining IDs in each stack can participate in a legal
 * one- or two-tile Develop. The adapter still decides top order and protection.
 */
function candidateTileSelections(
  state: GameStateV2,
  actorSeat: string,
): readonly (readonly string[])[] {
  const inventory = state.players[actorSeat].industryInventory;
  const candidates = INDUSTRY_TILE_KIND_ORDER.flatMap((industry) =>
    inventory.stacks[industry].slice(0, 2),
  );
  return [
    ...candidates.map((tileId) => [tileId]),
    ...candidates.flatMap((first) =>
      candidates.map((second) => [first, second]),
    ),
  ];
}

function ironSources(state: GameStateV2): readonly IronSourceCandidate[] {
  return BUILD_SPACE_IDS.flatMap((buildSpaceId) => {
    const placement = state.board.placedIndustries[buildSpaceId];
    if (
      placement === undefined ||
      INDUSTRY_TILE_BY_ID[placement.tileId].industry !== "iron" ||
      placement.flipped ||
      placement.resources.iron < 1
    ) return [];
    return [{ buildSpaceId, cubes: placement.resources.iron }];
  });
}

/**
 * Develop needs at most two iron. A second source is material only when the
 * first source has one cube; sources are unique at the action boundary.
 */
function candidateIronSourceSelections(
  sources: readonly IronSourceCandidate[],
  requiredUnits: 1 | 2,
): readonly (readonly IronSourceCandidate[])[] {
  const singles = sources.map((source) => [source]);
  if (requiredUnits === 1) return [[], ...singles];
  const pairs = sources.flatMap((first) =>
    first.cubes === 1
      ? sources.flatMap((second) =>
          second.buildSpaceId === first.buildSpaceId
            ? []
            : [[first, second]],
        )
      : [],
  );
  return [[], ...singles, ...pairs];
}

function requiresMarket(
  sources: readonly IronSourceCandidate[],
  requiredUnits: 1 | 2,
): boolean {
  return sources.reduce(
    (units, source) => Math.min(requiredUnits, units + source.cubes),
    0,
  ) < requiredUnits;
}

/**
 * Returns reducer-ready Develop plans for one already selected action card.
 *
 * Candidate generation is bounded by six inventory stacks, two removals, and
 * two iron units. The authoritative adapter alone decides stack ordering,
 * protected pottery, board-before-market priority, affordability, card use,
 * resource depletion, income awards, and the resulting state. Plans are only
 * collapsed when their complete adapter-produced states serialize identically.
 */
export function getGameV2DevelopLegalOptions(
  state: GameStateV2,
  actorSeat: string | null,
  cardId: PlayableCardId | null,
): GameV2DevelopLegalOptions {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    return disabled(
      actorSeat,
      cardId,
      "INVALID_GAME_STATE",
      `${first.path}: ${first.message}`,
    );
  }
  if (state.progress.phase === "ended") {
    return disabled(actorSeat, cardId, "GAME_ALREADY_ENDED", "The game has ended.");
  }
  if (state.progress.phase !== "action") {
    return disabled(
      actorSeat,
      cardId,
      "NOT_ACTION_PHASE",
      `Develop is unavailable during ${state.progress.phase}.`,
    );
  }
  if (actorSeat === null) {
    return disabled(actorSeat, cardId, "ACTOR_REQUIRED", "Develop requires an actor.");
  }
  if (!state.turnOrder.includes(actorSeat)) {
    return disabled(
      actorSeat,
      cardId,
      "UNKNOWN_ACTOR",
      `Unknown actor seat: ${actorSeat}.`,
    );
  }
  if (actorSeat !== state.currentSeat) {
    return disabled(
      actorSeat,
      cardId,
      "NOT_CURRENT_ACTOR",
      `Only ${state.currentSeat} may Develop now.`,
    );
  }
  if (state.actionsUsed >= state.actionLimit) {
    return disabled(
      actorSeat,
      cardId,
      "ACTION_LIMIT_REACHED",
      "The current turn has already used its action allowance.",
    );
  }
  if (cardId === null || typeof cardId !== "string" || cardId.length === 0) {
    return disabled(
      actorSeat,
      cardId,
      "CARD_REQUIRED",
      "Choose an action card before selecting Develop tiles.",
    );
  }
  if (!state.cards.hands[actorSeat].includes(cardId)) {
    return disabled(
      actorSeat,
      cardId,
      "CARD_NOT_IN_HAND",
      "The selected Develop card is not in the active player's hand.",
    );
  }

  const tileSelections = candidateTileSelections(state, actorSeat);
  const availableIron = ironSources(state);
  const stateOutcomes = new Set<string>();
  const plans: GameV2DevelopPlan[] = [];

  for (const tileIds of tileSelections) {
    const requiredUnits = tileIds.length as 1 | 2;
    const sourceSelections = candidateIronSourceSelections(
      availableIron,
      requiredUnits,
    );
    for (const selectedSources of sourceSelections) {
      const selection: DevelopActionSelection = {
        cardId,
        tileIds,
        accessibleIronIndustryIds: selectedSources.map(
          (source) => source.buildSpaceId,
        ),
        purchaseMarketShortfall: requiresMarket(
          selectedSources,
          requiredUnits,
        ),
      };
      const planned = executeDevelopForGameV2(state, selection);
      if (!planned.ok) continue;
      const outcomeKey = JSON.stringify(planned.state);
      if (stateOutcomes.has(outcomeKey)) continue;
      stateOutcomes.add(outcomeKey);

      const removedTileIds = planned.effect.removedTileIds;
      const boardSources = planned.effect.iron.boardSources.map((source) => {
        const placement = state.board.placedIndustries[source.industryId];
        if (placement === undefined) {
          throw new Error(
            `Accepted Develop referenced a missing iron source: ${source.industryId}`,
          );
        }
        return {
          buildSpaceId: source.industryId,
          locationId: placement.locationId,
          locationLabel:
            LOCATION_LABELS.get(placement.locationId) ?? placement.locationId,
          owner: source.owner,
          cubesBefore: placement.resources.iron,
          unitsConsumed: source.unitsConsumed,
          cubesRemaining: source.cubesRemaining,
          depleted: source.depleted,
        };
      });
      plans.push({
        selection,
        tiles: removedTileIds.map((tileId) => {
          const tile = INDUSTRY_TILE_BY_ID[tileId];
          return {
            id: tile.id,
            industry: tile.industry,
            faceId: tile.faceId,
            level: tile.level,
          };
        }),
        iron: {
          requiredUnits: planned.effect.iron.requiredUnits,
          boardSources,
          market: { ...planned.effect.iron.market },
        },
        moneySpent: planned.effect.moneySpent,
        outcome: {
          moneyAfter: planned.state.players[actorSeat].money,
          marketIronUnitsAfter: planned.state.market.iron,
          flippedProviderSpaceIds: boardSources.flatMap((source) =>
            source.depleted ? [source.buildSpaceId] : [],
          ),
          removedTileIds: [...removedTileIds],
        },
      });
    }
  }

  if (plans.length === 0) {
    return disabled(
      actorSeat,
      cardId,
      "NO_LEGAL_DEVELOP",
      "The active player has no affordable legal Develop selection.",
    );
  }
  return {
    availability: "exact",
    actorSeat,
    cardId,
    plans,
    reason: null,
  };
}

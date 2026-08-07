import type {
  BuildActionSelection,
  BuildCoalChoice,
  BuildIronChoice,
  BuildResourceEffect,
} from "../actions-v2/build";
import type { PlayableCardId } from "../cards-v2/types";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_KIND_ORDER,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import { executeBuildForGameV2 } from "./action-adapters";
import {
  validateGameStateV2,
  type GameStateV2,
} from "./state";

export type GameV2BuildLegalDisabledReasonCode =
  | "INVALID_GAME_STATE"
  | "GAME_ALREADY_ENDED"
  | "NOT_ACTION_PHASE"
  | "ACTOR_REQUIRED"
  | "UNKNOWN_ACTOR"
  | "NOT_CURRENT_ACTOR"
  | "ACTION_LIMIT_REACHED"
  | "CARD_REQUIRED"
  | "CARD_NOT_IN_HAND"
  | "NO_LEGAL_BUILD";

export type GameV2BuildLegalDisabledReason = {
  readonly code: GameV2BuildLegalDisabledReasonCode;
  readonly message: string;
};

export type GameV2BuildBoardResourceSource = {
  readonly resource: "coal" | "iron";
  readonly kind: "mine" | "works";
  readonly buildSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly owner: string;
  readonly depleted: boolean;
};

export type GameV2BuildMarketResourceSource = {
  readonly resource: "coal" | "iron";
  readonly kind: "market";
  readonly unitPrice: number;
};

export type GameV2BuildResourceSource =
  | GameV2BuildBoardResourceSource
  | GameV2BuildMarketResourceSource;

export type GameV2BuildResourcePlan = {
  /** Complete reducer-ready selection using the card requested by the caller. */
  readonly selection: BuildActionSelection;
  readonly sources: readonly GameV2BuildResourceSource[];
  readonly flippedProviderSpaceIds: readonly string[];
  readonly printedBuildCost: number;
  readonly resourceMarketCost: number;
  readonly totalCost: number;
  readonly productionRevenue: number;
  readonly productionSold: {
    readonly coal: number;
    readonly iron: number;
  };
  readonly resultingPlacement: {
    readonly resources: {
      readonly coal: number;
      readonly iron: number;
      readonly beer: number;
    };
    readonly flipped: boolean;
  };
  readonly moneyChange: number;
};

export type GameV2BuildTarget = {
  readonly buildSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly industry: IndustryTileKind;
  readonly tile: {
    readonly id: IndustryTileId;
    readonly faceId: string;
    readonly level: number;
  };
  readonly overbuild: null | {
    readonly owner: string;
    readonly tileId: string;
    readonly industry: IndustryTileKind;
    readonly level: number;
  };
  /** Exact alternative source plans for this target. */
  readonly resourcePlans: readonly GameV2BuildResourcePlan[];
};

export type GameV2BuildLegalOptions = {
  readonly availability: "exact" | "disabled";
  readonly actorSeat: string | null;
  readonly cardId: PlayableCardId | null;
  readonly targets: readonly GameV2BuildTarget[];
  readonly reason: GameV2BuildLegalDisabledReason | null;
};

type BuildSpaceCandidate = {
  readonly buildSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
};

const BUILD_SPACES: readonly BuildSpaceCandidate[] = Object.entries(
  BOARD_V2.locations,
).flatMap(([locationId, location]) =>
  "buildSpaces" in location
    ? location.buildSpaces.map((space) => ({
        buildSpaceId: space.id,
        locationId,
        locationLabel: location.label,
      }))
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
  code: GameV2BuildLegalDisabledReasonCode,
  message: string,
): GameV2BuildLegalOptions {
  return {
    availability: "disabled",
    actorSeat,
    cardId,
    targets: [],
    reason: { code, message },
  };
}

function orderedSelections<T>(
  choices: readonly T[],
  length: number,
): readonly (readonly T[])[] {
  if (length === 0) return [[]];
  const tails = orderedSelections(choices, length - 1);
  return choices.flatMap((choice) =>
    tails.map((tail) => [choice, ...tail]),
  );
}

function coalCandidates(state: GameStateV2): readonly BuildCoalChoice[] {
  return [
    ...BUILD_SPACES.flatMap(({ buildSpaceId }) => {
      const placement = state.board.placedIndustries[buildSpaceId];
      return placement !== undefined &&
          INDUSTRY_TILE_BY_ID[placement.tileId].industry === "coal" &&
          !placement.flipped &&
          placement.resources.coal > 0
        ? [{ kind: "mine" as const, buildSpaceId }]
        : [];
    }),
    { kind: "market" as const },
  ];
}

function ironCandidates(state: GameStateV2): readonly BuildIronChoice[] {
  return [
    ...BUILD_SPACES.flatMap(({ buildSpaceId }) => {
      const placement = state.board.placedIndustries[buildSpaceId];
      return placement !== undefined &&
          INDUSTRY_TILE_BY_ID[placement.tileId].industry === "iron" &&
          !placement.flipped &&
          placement.resources.iron > 0
        ? [{ kind: "works" as const, buildSpaceId }]
        : [];
    }),
    { kind: "market" as const },
  ];
}

function sourceMultisetKey(
  coalSources: readonly BuildCoalChoice[],
  ironSources: readonly BuildIronChoice[],
): string {
  const choiceKey = (choice: BuildCoalChoice | BuildIronChoice): string =>
    choice.kind === "market"
      ? "market"
      : `${choice.kind}:${choice.buildSpaceId}`;
  return JSON.stringify({
    coal: coalSources.map(choiceKey).sort(),
    iron: ironSources.map(choiceKey).sort(),
  });
}

const RESOURCE_PLANNING_ERRORS = new Set([
  "COAL_SOURCE_PRIORITY",
  "COAL_MARKET_NOT_CONNECTED",
  "IRON_SOURCE_PRIORITY",
  "INSUFFICIENT_MONEY",
]);

/**
 * Uses the authoritative adapter to reject card, space, network, era, and
 * overbuild failures once per target before generating resource products.
 * Resource-stage failures remain candidates because a board source can make a
 * market-only probe legal or affordable.
 */
function mayHaveResourcePlan(
  state: GameStateV2,
  cardId: PlayableCardId,
  buildSpaceId: string,
  industry: IndustryTileKind,
  coalRequired: number,
  ironRequired: number,
): boolean {
  const probe = executeBuildForGameV2(state, {
    cardId,
    buildSpaceId,
    industry,
    coalSources: Array.from(
      { length: coalRequired },
      () => ({ kind: "market" as const }),
    ),
    ironSources: Array.from(
      { length: ironRequired },
      () => ({ kind: "market" as const }),
    ),
  });
  return probe.ok || RESOURCE_PLANNING_ERRORS.has(probe.error.code);
}

function projectSource(
  state: GameStateV2,
  source: BuildResourceEffect,
): GameV2BuildResourceSource {
  if (source.kind === "market") {
    return {
      resource: source.resource,
      kind: "market",
      unitPrice: source.unitPrice,
    };
  }
  const placement = state.board.placedIndustries[source.buildSpaceId];
  if (placement === undefined) {
    throw new Error(
      `Accepted Build referenced a missing resource source: ${source.buildSpaceId}`,
    );
  }
  return {
    resource: source.resource,
    kind: source.kind,
    buildSpaceId: source.buildSpaceId,
    locationId: placement.locationId,
    locationLabel: LOCATION_LABELS.get(placement.locationId) ?? placement.locationId,
    owner: placement.owner,
    depleted: source.depleted,
  };
}

/**
 * Enumerates exact Build targets after the hot-seat UI has selected one card.
 *
 * The authoritative GameStateV2 Build adapter is the sole judge of cards,
 * spaces, network reach, overbuilds, resource priority, market access, and
 * affordability. It first preflights each target, then exhaustively tests the
 * small source products only for survivors. Accepted source permutations with
 * the same material outcome are collapsed to one deterministic sequence.
 */
export function getGameV2BuildLegalOptions(
  state: GameStateV2,
  actorSeat: string | null,
  cardId: PlayableCardId | null,
): GameV2BuildLegalOptions {
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
      `Build is unavailable during ${state.progress.phase}.`,
    );
  }
  if (actorSeat === null) {
    return disabled(actorSeat, cardId, "ACTOR_REQUIRED", "Build requires an actor.");
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
      `Only ${state.currentSeat} may build now.`,
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
      "Choose an action card before selecting a Build target.",
    );
  }
  if (!state.cards.hands[actorSeat].includes(cardId)) {
    return disabled(
      actorSeat,
      cardId,
      "CARD_NOT_IN_HAND",
      "The selected Build card is not in the active player's hand.",
    );
  }

  const coalChoices = coalCandidates(state);
  const ironChoices = ironCandidates(state);
  const targets: GameV2BuildTarget[] = [];

  for (const space of BUILD_SPACES) {
    for (const industry of INDUSTRY_TILE_KIND_ORDER) {
      const tileId = state.players[actorSeat].industryInventory.stacks[industry][0];
      if (tileId === undefined) continue;
      const tile = INDUSTRY_TILE_BY_ID[tileId];
      if (!mayHaveResourcePlan(
        state,
        cardId,
        space.buildSpaceId,
        industry,
        tile.build.coal,
        tile.build.iron,
      )) continue;
      const coalSelections = orderedSelections(coalChoices, tile.build.coal);
      const ironSelections = orderedSelections(ironChoices, tile.build.iron);
      const resourcePlans: GameV2BuildResourcePlan[] = [];
      const materialChoices = new Set<string>();

      for (const coalSources of coalSelections) {
        for (const ironSources of ironSelections) {
          const selection: BuildActionSelection = {
            buildSpaceId: space.buildSpaceId,
            industry,
            cardId,
            coalSources,
            ironSources,
          };
          const planned = executeBuildForGameV2(state, selection);
          if (!planned.ok) continue;
          const materialKey = sourceMultisetKey(coalSources, ironSources);
          if (materialChoices.has(materialKey)) continue;
          materialChoices.add(materialKey);
          resourcePlans.push({
            selection,
            sources: planned.effect.resourceSources.map((source) =>
              projectSource(state, source),
            ),
            flippedProviderSpaceIds: [...planned.effect.flippedProviderSpaceIds],
            printedBuildCost: planned.effect.printedBuildCost,
            resourceMarketCost: planned.effect.resourceMarketCost,
            totalCost: planned.effect.moneySpent,
            productionRevenue: planned.effect.productionRevenue,
            productionSold: { ...planned.effect.productionSold },
            resultingPlacement: {
              resources: { ...planned.effect.placement.resources },
              flipped: planned.effect.placement.flipped,
            },
            moneyChange: planned.effect.moneyChange,
          });
        }
      }
      if (resourcePlans.length === 0) continue;

      const occupant = state.board.placedIndustries[space.buildSpaceId];
      targets.push({
        buildSpaceId: space.buildSpaceId,
        locationId: space.locationId,
        locationLabel: space.locationLabel,
        industry,
        tile: {
          id: tile.id,
          faceId: tile.faceId,
          level: tile.level,
        },
        overbuild: occupant === undefined
          ? null
          : {
              owner: occupant.owner,
              tileId: occupant.tileId,
              industry: INDUSTRY_TILE_BY_ID[occupant.tileId].industry,
              level: INDUSTRY_TILE_BY_ID[occupant.tileId].level,
            },
        resourcePlans,
      });
    }
  }

  if (targets.length === 0) {
    return disabled(
      actorSeat,
      cardId,
      "NO_LEGAL_BUILD",
      "The selected card has no affordable legal Build target.",
    );
  }
  return {
    availability: "exact",
    actorSeat,
    cardId,
    targets,
    reason: null,
  };
}

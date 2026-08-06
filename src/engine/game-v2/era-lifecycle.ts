import { incomeLevelAt } from "../economy/income";
import { createRoundSpendLedger } from "../lifecycle";
import {
  rankFinalStandings,
  resolveEraEnd,
  type BoardLinkId,
  type BoardLocationId,
  type EraAssetScoringResult,
  type EraEndInput,
  type EraEndResolution,
  type PlayerStanding,
} from "../scoring/era-transition";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILES,
  type IndustryTileId,
} from "../rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "../rules/generated/ruleset";
import { WILD_CARD_SUPPLY } from "../rules/generated/cards";
import {
  MERCHANT_DEMAND_INDUSTRIES,
  type RulesMerchantDemandIndustry,
} from "../rules/generated/merchant-tiles";
import { createRailSetup } from "../setup-v2/create-rail-setup";
import type { MerchantSpaceSetup } from "../setup-v2/create-merchant-setup";
import {
  validateGameStateV2,
  type GameEventV2,
  type GameStateV2,
  type GameStateV2ValidationError,
  type PlacedIndustryStateV2,
  type PlayerStateV2,
} from "./state";

export type EraLifecycleErrorCode =
  | "INVALID_GAME_STATE"
  | "NOT_ERA_BOUNDARY"
  | "ALREADY_ENDED"
  | "ERA_SCORING_FAILED"
  | "VICTORY_POINT_OVERFLOW"
  | "RAIL_SETUP_FAILED"
  | "RESULT_INVALID";

export type EraLifecycleError = {
  readonly code: EraLifecycleErrorCode;
  readonly message: string;
  readonly validationErrors?: readonly GameStateV2ValidationError[];
};

export type EraLifecycleSuccess =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly completedEra: "canal";
      readonly gameEnded: false;
      readonly standings: null;
      readonly scoring: EraAssetScoringResult;
      readonly railSeed: string;
    }
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly completedEra: "rail";
      readonly gameEnded: true;
      readonly standings: readonly PlayerStanding[];
      readonly scoring: EraAssetScoringResult;
      readonly railSeed: null;
    };

export type EraLifecycleResult =
  | EraLifecycleSuccess
  | {
      readonly ok: false;
      /** Every failure returns the exact authoritative input object. */
      readonly state: GameStateV2;
      readonly error: EraLifecycleError;
    };

const CANONICAL_TILE_INDEX = new Map<string, number>(
  INDUSTRY_TILES.map((tile, index) => [tile.id, index]),
);
const MERCHANT_DEMAND_SET = new Set<string>(MERCHANT_DEMAND_INDUSTRIES);

function reject(
  state: GameStateV2,
  error: EraLifecycleError,
): Extract<EraLifecycleResult, { ok: false }> {
  return { ok: false, state, error };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Derives the Rail reshuffle independently from setup and future RNG state. */
export function deriveRailSetupSeed(gameSeed: string): string {
  if (typeof gameSeed !== "string") {
    throw new TypeError("Game seed must be a string");
  }
  return JSON.stringify([
    "brass-birmingham-game-v2",
    "rail-cards",
    gameSeed,
  ]);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function atCompletedEraBoundary(state: GameStateV2): boolean {
  const playerCount = state.turnOrder.length as 2 | 3 | 4;
  const finalRound = SETUP_DATA.playerCounts[playerCount]?.roundsPerEra;
  const settlementEvent = state.events.at(-1);
  if (
    settlementEvent?.type !== "ROUND_SETTLED" ||
    !isRecord(settlementEvent.data) ||
    settlementEvent.data.settlementComplete !== true ||
    settlementEvent.data.era !== state.era ||
    settlementEvent.data.completedRound !== state.round ||
    settlementEvent.data.eraComplete !== true
  ) return false;
  if (state.round !== finalRound || state.cards.draw.length !== 0) return false;
  if (state.turnOrder.some((seat) => state.cards.hands[seat].length !== 0)) {
    return false;
  }
  return (
    state.cards.wildSupplies.location === WILD_CARD_SUPPLY.location &&
    state.cards.wildSupplies.industry === WILD_CARD_SUPPLY.industry
  );
}

function eraScoringInput(
  state: GameStateV2,
): EraEndInput<MerchantSpaceSetup> {
  return {
    completedEra: state.era,
    links: Object.entries(state.board.builtLinks).map(([linkId, ownerId]) => ({
      linkId: linkId as BoardLinkId,
      ownerId,
      era: state.era,
    })),
    industries: Object.entries(state.board.placedIndustries).map(
      ([industryId, industry]) => ({
        id: industryId,
        ownerId: industry.owner,
        locationId: industry.locationId as BoardLocationId,
        faceId: INDUSTRY_TILE_BY_ID[industry.tileId].faceId,
        flipped: industry.flipped,
      }),
    ),
    merchantSpaces: state.merchants.spaces,
  };
}

function pointsForEverySeat(
  state: GameStateV2,
  scoring: EraAssetScoringResult,
): Record<string, number> {
  return Object.fromEntries(
    state.turnOrder.map((seat) => [seat, scoring.totalByOwner[seat] ?? 0]),
  );
}

function playersWithScoredVictoryPoints(
  state: GameStateV2,
  pointsBySeat: Readonly<Record<string, number>>,
): Record<string, PlayerStateV2> | null {
  const players: Record<string, PlayerStateV2> = {};
  for (const seat of state.turnOrder) {
    const player = state.players[seat];
    const victoryPoints = player.victoryPoints + pointsBySeat[seat];
    if (!Number.isSafeInteger(victoryPoints)) return null;
    players[seat] = { ...player, victoryPoints };
  }
  return players;
}

function appendEvents(
  existing: readonly GameEventV2[],
  events: readonly Omit<GameEventV2, "sequence">[],
): GameEventV2[] {
  return [
    ...existing,
    ...events.map((event, index) => ({
      ...event,
      sequence: existing.length + index,
    })),
  ];
}

function isMerchantDemand(value: string): value is RulesMerchantDemandIndustry {
  return MERCHANT_DEMAND_SET.has(value);
}

function exactMerchantSpaces(
  spaces: EraEndResolution<MerchantSpaceSetup>["merchantSpaces"],
): MerchantSpaceSetup[] | null {
  const exact: MerchantSpaceSetup[] = [];
  for (const space of spaces) {
    const demandIndustries = space.demandIndustries.filter(isMerchantDemand);
    if (demandIndustries.length !== space.demandIndustries.length) return null;
    exact.push({
      ...space,
      demandIndustries,
    });
  }
  return exact;
}

function scoredEventData(
  era: GameStateV2["era"],
  scoring: EraAssetScoringResult,
  pointsBySeat: Readonly<Record<string, number>>,
): unknown {
  return {
    era,
    pointsBySeat,
    linkPointsBySeat: scoring.linkPointsByOwner,
    industryPointsBySeat: scoring.industryPointsByOwner,
    links: scoring.links,
    industries: scoring.industries,
  };
}

function inventoryLevelOneIds(player: PlayerStateV2): IndustryTileId[] {
  return Object.values(player.industryInventory.stacks)
    .flat()
    .filter((tileId) => INDUSTRY_TILE_BY_ID[tileId].level === 1);
}

function purgeCanalIndustries(
  state: GameStateV2,
  removedIndustrySpaceIds: readonly string[],
  scoredPlayers: Readonly<Record<string, PlayerStateV2>>,
): {
  players: Record<string, PlayerStateV2>;
  placedIndustries: Readonly<Record<string, PlacedIndustryStateV2>>;
  removedTileIdsBySeat: Record<string, IndustryTileId[]>;
} {
  const removedSpaces = new Set(removedIndustrySpaceIds);
  const removedBoardTilesBySeat = new Map<string, IndustryTileId[]>();
  for (const [spaceId, industry] of Object.entries(
    state.board.placedIndustries,
  )) {
    if (!removedSpaces.has(spaceId)) continue;
    removedBoardTilesBySeat.set(industry.owner, [
      ...(removedBoardTilesBySeat.get(industry.owner) ?? []),
      industry.tileId,
    ]);
  }

  const players: Record<string, PlayerStateV2> = {};
  const removedTileIdsBySeat: Record<string, IndustryTileId[]> = {};
  for (const seat of state.turnOrder) {
    const player = scoredPlayers[seat];
    const inventoryLevelOne = inventoryLevelOneIds(player);
    const boardLevelOne = removedBoardTilesBySeat.get(seat) ?? [];
    const alreadyRemoved = new Set(player.removedIndustryTileIds);
    const additions = [...new Set([...inventoryLevelOne, ...boardLevelOne])]
      .filter((tileId) => !alreadyRemoved.has(tileId))
      .sort(
        (left, right) =>
          (CANONICAL_TILE_INDEX.get(left) ?? 0) -
          (CANONICAL_TILE_INDEX.get(right) ?? 0),
      );
    const stacks = Object.fromEntries(
      Object.entries(player.industryInventory.stacks).map(([kind, stack]) => [
        kind,
        stack.filter((tileId) => INDUSTRY_TILE_BY_ID[tileId].level !== 1),
      ]),
    ) as PlayerStateV2["industryInventory"]["stacks"];
    players[seat] = {
      ...player,
      industryInventory: { ...player.industryInventory, stacks },
      removedIndustryTileIds: [
        ...player.removedIndustryTileIds,
        ...additions,
      ],
    };
    removedTileIdsBySeat[seat] = additions;
  }

  return {
    players,
    placedIndustries: Object.fromEntries(
      Object.entries(state.board.placedIndustries).filter(
        ([spaceId]) => !removedSpaces.has(spaceId),
      ),
    ),
    removedTileIdsBySeat,
  };
}

function restoreCanalLinks(
  state: GameStateV2,
  removedLinkIds: readonly string[],
  players: Readonly<Record<string, PlayerStateV2>>,
): Record<string, PlayerStateV2> | null {
  const restoredBySeat = new Map<string, number>();
  for (const linkId of removedLinkIds) {
    const owner = state.board.builtLinks[linkId];
    restoredBySeat.set(owner, (restoredBySeat.get(owner) ?? 0) + 1);
  }
  const nextPlayers: Record<string, PlayerStateV2> = {};
  for (const seat of state.turnOrder) {
    const linkTokensRemaining =
      players[seat].linkTokensRemaining + (restoredBySeat.get(seat) ?? 0);
    if (
      !Number.isSafeInteger(linkTokensRemaining) ||
      linkTokensRemaining > SETUP_DATA.shared.linksPerPlayer
    ) {
      return null;
    }
    nextPlayers[seat] = { ...players[seat], linkTokensRemaining };
  }
  return nextPlayers;
}

function validateResult(
  original: GameStateV2,
  result: GameStateV2,
): Extract<EraLifecycleResult, { ok: false }> | null {
  const validation = validateGameStateV2(result);
  return validation.ok
    ? null
    : reject(original, {
        code: "RESULT_INVALID",
        message: `Era resolution produced invalid state: ${validation.errors[0].message}`,
        validationErrors: validation.errors,
      });
}

/** Resolves either the Canal-to-Rail boundary or final Rail scoring atomically. */
export function resolveGameEra(
  state: GameStateV2,
): EraLifecycleResult {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    return reject(state, {
      code: "INVALID_GAME_STATE",
      message: `Cannot resolve invalid state: ${validation.errors[0].message}`,
      validationErrors: validation.errors,
    });
  }
  if (state.events.some((event) => event.type === "GAME_ENDED")) {
    return reject(state, {
      code: "ALREADY_ENDED",
      message: "The game has already ended.",
    });
  }
  if (!atCompletedEraBoundary(state)) {
    return reject(state, {
      code: "NOT_ERA_BOUNDARY",
      message:
        "Era resolution requires a settled final round with empty hands and draw pile.",
    });
  }
  if (!Number.isSafeInteger(state.revision + 1)) {
    return reject(state, {
      code: "INVALID_GAME_STATE",
      message: "Revision cannot be incremented safely.",
    });
  }

  let eraResolution: EraEndResolution<MerchantSpaceSetup>;
  try {
    eraResolution = resolveEraEnd(eraScoringInput(state));
  } catch (error) {
    return reject(state, {
      code: "ERA_SCORING_FAILED",
      message: messageFrom(error),
    });
  }
  const pointsBySeat = pointsForEverySeat(state, eraResolution.scoring);
  const scoredPlayers = playersWithScoredVictoryPoints(state, pointsBySeat);
  if (!scoredPlayers) {
    return reject(state, {
      code: "VICTORY_POINT_OVERFLOW",
      message: "Era victory points would exceed the safe integer range.",
    });
  }
  const eraScoredEvent = {
    type: "ERA_SCORED",
    data: scoredEventData(state.era, eraResolution.scoring, pointsBySeat),
  };

  if (state.era === "rail") {
    const standings = rankFinalStandings(
      state.turnOrder.map((seat) => ({
        playerId: seat,
        victoryPoints: scoredPlayers[seat].victoryPoints,
        incomeLevel: incomeLevelAt(scoredPlayers[seat].incomeMarkerSpace),
        cash: scoredPlayers[seat].money,
      })),
    );
    const nextState: GameStateV2 = {
      ...state,
      revision: state.revision + 1,
      players: scoredPlayers,
      events: appendEvents(state.events, [
        eraScoredEvent,
        { type: "GAME_ENDED", data: { standings } },
      ]),
    };
    const invalidResult = validateResult(state, nextState);
    if (invalidResult) return invalidResult;
    return {
      ok: true,
      state: nextState,
      completedEra: "rail",
      gameEnded: true,
      standings,
      scoring: eraResolution.scoring,
      railSeed: null,
    };
  }

  const purged = purgeCanalIndustries(
    state,
    eraResolution.removedIndustryIds,
    scoredPlayers,
  );
  const restoredPlayers = restoreCanalLinks(
    state,
    eraResolution.removedLinkIds,
    purged.players,
  );
  if (!restoredPlayers) {
    return reject(state, {
      code: "INVALID_GAME_STATE",
      message: "Canal link restoration exceeds a player's link supply.",
    });
  }

  const railSeed = deriveRailSetupSeed(state.seed);
  let railCards: ReturnType<typeof createRailSetup>;
  try {
    railCards = createRailSetup(state.turnOrder, state.cards, railSeed);
  } catch (error) {
    return reject(state, {
      code: "RAIL_SETUP_FAILED",
      message: messageFrom(error),
    });
  }
  const merchantSpaces = exactMerchantSpaces(eraResolution.merchantSpaces);
  if (!merchantSpaces) {
    return reject(state, {
      code: "RESULT_INVALID",
      message: "Era resolution produced an unknown Merchant demand.",
    });
  }
  const nextState: GameStateV2 = {
    ...state,
    revision: state.revision + 1,
    era: "rail",
    round: 1,
    turnNumber: 1,
    currentSeat: state.turnOrder[0],
    actionsUsed: 0,
    actionLimit: 2,
    roundSpend: createRoundSpendLedger(state.turnOrder),
    players: restoredPlayers,
    cards: {
      hands: railCards.hands,
      draw: railCards.draw,
      discard: railCards.discard,
      wildSupplies: railCards.wildSupplies,
    },
    merchants: {
      ...state.merchants,
      spaces: merchantSpaces,
    },
    board: {
      builtLinks: Object.fromEntries(
        Object.entries(state.board.builtLinks).filter(
          ([linkId]) => !eraResolution.removedLinkIds.includes(
            linkId as (typeof eraResolution.removedLinkIds)[number],
          ),
        ),
      ),
      placedIndustries: purged.placedIndustries,
    },
    events: appendEvents(state.events, [
      eraScoredEvent,
      {
        type: "RAIL_STARTED",
        data: {
          railSeed,
          turnOrder: state.turnOrder,
          removedLinkIds: eraResolution.removedLinkIds,
          removedIndustrySpaceIds: eraResolution.removedIndustryIds,
          removedIndustryTileIdsBySeat: purged.removedTileIdsBySeat,
        },
      },
    ]),
  };
  const invalidResult = validateResult(state, nextState);
  if (invalidResult) return invalidResult;
  return {
    ok: true,
    state: nextState,
    completedEra: "canal",
    gameEnded: false,
    standings: null,
    scoring: eraResolution.scoring,
    railSeed,
  };
}

import {
  incomeLevelAt,
  liquidationValue,
  type RoundIncomeSettlement,
} from "../economy/income";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "../rules/generated/ruleset";
import {
  resolveCompletedRoundV2,
  type LiquidationChoicesV2,
} from "./turn-lifecycle";
import {
  validateGameStateV2,
  type GameProgressV2,
  type GameStateV2,
} from "./state";

export type GameV2LiquidationLegalDisabledReasonCode =
  | "INVALID_GAME_STATE"
  | "NOT_ROUND_SETTLEMENT"
  | "INVALID_LIQUIDATION_CHOICES"
  | "UNKNOWN_SEAT"
  | "NON_NEGATIVE_SEAT"
  | "FINAL_RAIL_CHOICES_NOT_ALLOWED"
  | "DUPLICATE_INDUSTRY"
  | "INDUSTRY_NOT_OWNED"
  | "ZERO_VALUE_INDUSTRY"
  | "LIQUIDATION_PAST_COVERAGE"
  | "AUTHORITY_REJECTED";

export type GameV2LiquidationLegalDisabledReason = {
  readonly code: GameV2LiquidationLegalDisabledReasonCode;
  readonly message: string;
  readonly seat?: string;
  readonly industryId?: string;
};

export type GameV2LiquidationCoverage =
  | "covered_by_cash"
  | "shortfall"
  | "covered_by_liquidation"
  | "assets_exhausted";

export type GameV2LiquidationAsset = {
  readonly buildSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly tileId: IndustryTileId;
  readonly industry: IndustryTileKind;
  readonly faceId: string;
  readonly level: number;
  readonly buildCost: number;
  readonly liquidationValue: number;
};

export type GameV2LiquidationNextChoice = GameV2LiquidationAsset & {
  /** The sole new prefix produced by clicking this option once. */
  readonly choicesAfterAppend: readonly string[];
  readonly liquidationProceedsAfterAppend: number;
  readonly remainingShortfallAfterAppend: number;
  readonly coverageAfterAppend: Exclude<
    GameV2LiquidationCoverage,
    "covered_by_cash"
  >;
};

export type GameV2SeatLiquidationProgress = {
  readonly seat: string;
  readonly incomeLevel: number;
  readonly requiredPayment: number;
  readonly cashBefore: number;
  readonly cashApplied: number;
  readonly initialShortfall: number;
  readonly selectedAssets: readonly GameV2LiquidationAsset[];
  readonly liquidationProceeds: number;
  readonly remainingShortfall: number;
  readonly coverage: GameV2LiquidationCoverage;
  /** Missing keys are never silently treated as the required explicit `[]`. */
  readonly acknowledged: boolean;
  readonly ready: boolean;
  readonly exhausted: boolean;
  readonly nextChoices: readonly GameV2LiquidationNextChoice[];
  readonly preview: {
    readonly moneyAfter: number;
    readonly victoryPointsBefore: number;
    readonly victoryPointsLost: number;
    readonly victoryPointsAfter: number;
    readonly unpaidShortfall: number;
  };
  /** Present only after the complete map is accepted by round settlement. */
  readonly authoritativeSettlement: RoundIncomeSettlement | null;
};

export type GameV2LiquidationAuthorityPreview = {
  readonly eraComplete: boolean;
  readonly settlements: Readonly<Record<string, RoundIncomeSettlement>>;
  readonly next: {
    readonly round: number;
    readonly progressPhase: GameProgressV2["phase"];
    readonly turnOrder: readonly string[];
  };
};

export type GameV2LiquidationLegalOptions = {
  readonly availability: "exact" | "disabled";
  readonly finalRailIncomeSkipped: boolean;
  readonly requiredSeats: readonly string[];
  readonly seats: readonly GameV2SeatLiquidationProgress[];
  readonly ready: boolean;
  /** Reducer-ready only when all required explicit seat prefixes are complete. */
  readonly liquidationChoices: LiquidationChoicesV2 | null;
  readonly authority: GameV2LiquidationAuthorityPreview | null;
  readonly reason: GameV2LiquidationLegalDisabledReason | null;
};

const LOCATION_LABELS = new Map(
  Object.entries(BOARD_V2.locations).map(([locationId, location]) => [
    locationId,
    location.label,
  ]),
);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function disabled(
  code: GameV2LiquidationLegalDisabledReasonCode,
  message: string,
  details: Pick<
    GameV2LiquidationLegalDisabledReason,
    "seat" | "industryId"
  > = {},
): GameV2LiquidationLegalOptions {
  return {
    availability: "disabled",
    finalRailIncomeSkipped: false,
    requiredSeats: [],
    seats: [],
    ready: false,
    liquidationChoices: null,
    authority: null,
    reason: { code, message, ...details },
  };
}

function assetFor(
  state: GameStateV2,
  buildSpaceId: string,
): GameV2LiquidationAsset {
  const placement = state.board.placedIndustries[buildSpaceId];
  const tile = INDUSTRY_TILE_BY_ID[placement.tileId];
  return {
    buildSpaceId,
    locationId: placement.locationId,
    locationLabel:
      LOCATION_LABELS.get(placement.locationId) ?? placement.locationId,
    tileId: tile.id,
    industry: tile.industry,
    faceId: tile.faceId,
    level: tile.level,
    buildCost: tile.build.money,
    liquidationValue: liquidationValue(tile.build.money),
  };
}

function ownedAssets(
  state: GameStateV2,
  seat: string,
): readonly GameV2LiquidationAsset[] {
  return Object.entries(state.board.placedIndustries)
    .filter(([, placement]) => placement.owner === seat)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([buildSpaceId]) => assetFor(state, buildSpaceId));
}

function coverageFor(
  initialShortfall: number,
  liquidationProceeds: number,
  usefulAssetsRemaining: boolean,
): GameV2LiquidationCoverage {
  if (initialShortfall === 0) return "covered_by_cash";
  if (liquidationProceeds >= initialShortfall) {
    return "covered_by_liquidation";
  }
  return usefulAssetsRemaining ? "shortfall" : "assets_exhausted";
}

function previewFor(
  state: GameStateV2,
  seat: string,
  requiredPayment: number,
  liquidationProceeds: number,
): GameV2SeatLiquidationProgress["preview"] {
  const player = state.players[seat];
  const remainingShortfall = Math.max(
    0,
    requiredPayment - player.money - liquidationProceeds,
  );
  const victoryPointsLost = Math.min(
    player.victoryPoints,
    remainingShortfall,
  );
  return {
    moneyAfter: Math.max(
      0,
      player.money + liquidationProceeds - requiredPayment,
    ),
    victoryPointsBefore: player.victoryPoints,
    victoryPointsLost,
    victoryPointsAfter: player.victoryPoints - victoryPointsLost,
    unpaidShortfall: remainingShortfall - victoryPointsLost,
  };
}

function withAuthority(
  state: GameStateV2,
  liquidationChoices: LiquidationChoicesV2,
  requiredSeats: readonly string[],
  seats: readonly GameV2SeatLiquidationProgress[],
  finalRailIncomeSkipped: boolean,
): GameV2LiquidationLegalOptions {
  const resolved = resolveCompletedRoundV2(state, liquidationChoices);
  if (!resolved.ok) {
    return disabled(
      "AUTHORITY_REJECTED",
      `Round settlement rejected a completed liquidation plan: ${resolved.error.message}`,
      {
        seat: resolved.error.seat,
        industryId: resolved.error.industryId,
      },
    );
  }
  return {
    availability: "exact",
    finalRailIncomeSkipped,
    requiredSeats,
    seats: seats.map((seat) => ({
      ...seat,
      authoritativeSettlement: resolved.settlements[seat.seat] ?? null,
    })),
    ready: true,
    liquidationChoices,
    authority: {
      eraComplete: resolved.eraComplete,
      settlements: resolved.settlements,
      next: {
        round: resolved.state.round,
        progressPhase: resolved.state.progress.phase,
        turnOrder: [...resolved.state.turnOrder],
      },
    },
    reason: null,
  };
}

/**
 * Validates one ordered liquidation prefix and exposes only its next appendable
 * assets. It never enumerates subsets or permutations; callers append exactly
 * one returned asset and ask again. A settlement map is returned only after
 * every negative-income seat has explicitly acknowledged a complete prefix.
 */
export function getGameV2LiquidationLegalOptions(
  state: GameStateV2,
  partialChoices: LiquidationChoicesV2,
): GameV2LiquidationLegalOptions {
  const validation = validateGameStateV2(state);
  if (!validation.ok || !Number.isSafeInteger(state.revision + 1)) {
    const message = validation.ok
      ? "Revision cannot be incremented safely."
      : `${validation.errors[0].path}: ${validation.errors[0].message}`;
    return disabled("INVALID_GAME_STATE", message);
  }
  if (state.progress.phase !== "round_settlement") {
    return disabled(
      "NOT_ROUND_SETTLEMENT",
      `Liquidation is unavailable during ${state.progress.phase}.`,
    );
  }
  if (!isRecord(partialChoices)) {
    return disabled(
      "INVALID_LIQUIDATION_CHOICES",
      "Liquidation choices must be an object keyed by seat.",
    );
  }

  const playerCount = state.turnOrder.length as 2 | 3 | 4;
  const finalRoundOfEra =
    state.round === SETUP_DATA.playerCounts[playerCount].roundsPerEra;
  const finalRailIncomeSkipped = state.era === "rail" && finalRoundOfEra;
  const choiceSeats = Object.keys(partialChoices);
  if (finalRailIncomeSkipped) {
    if (choiceSeats.length > 0) {
      return disabled(
        "FINAL_RAIL_CHOICES_NOT_ALLOWED",
        "Final Rail income is skipped; liquidation choices must be exactly {}.",
        { seat: choiceSeats[0] },
      );
    }
    return withAuthority(state, {}, [], [], true);
  }

  const incomeLevels = Object.fromEntries(state.turnOrder.map((seat) => [
    seat,
    incomeLevelAt(state.players[seat].incomeMarkerSpace),
  ])) as Record<string, number>;
  const requiredSeats = state.turnOrder.filter((seat) => incomeLevels[seat] < 0);

  for (const seat of choiceSeats) {
    if (!state.turnOrder.includes(seat)) {
      return disabled(
        "UNKNOWN_SEAT",
        `Unknown liquidation-choice seat: ${seat}.`,
        { seat },
      );
    }
    if (incomeLevels[seat] >= 0) {
      return disabled(
        "NON_NEGATIVE_SEAT",
        `Non-negative-income seat must not submit liquidation choices: ${seat}.`,
        { seat },
      );
    }
    const choices = partialChoices[seat];
    if (
      !Array.isArray(choices) ||
      choices.some(
        (industryId) => typeof industryId !== "string" || industryId.length === 0,
      )
    ) {
      return disabled(
        "INVALID_LIQUIDATION_CHOICES",
        `Liquidation choices must be an ordered industry-ID list: ${seat}.`,
        { seat },
      );
    }
  }

  const seats: GameV2SeatLiquidationProgress[] = [];
  for (const seat of requiredSeats) {
    const choices = Object.hasOwn(partialChoices, seat)
      ? partialChoices[seat]
      : [];
    const duplicate = choices.find(
      (industryId, index) => choices.indexOf(industryId) !== index,
    );
    if (duplicate !== undefined) {
      return disabled(
        "DUPLICATE_INDUSTRY",
        `Liquidation choices contain a duplicate industry: ${duplicate}.`,
        { seat, industryId: duplicate },
      );
    }

    const assets = ownedAssets(state, seat);
    const assetsById = new Map(assets.map((asset) => [asset.buildSpaceId, asset]));
    const requiredPayment = -incomeLevels[seat];
    const cashBefore = state.players[seat].money;
    const initialShortfall = Math.max(0, requiredPayment - cashBefore);
    let liquidationProceeds = 0;
    const selectedAssets: GameV2LiquidationAsset[] = [];
    for (const industryId of choices) {
      const asset = assetsById.get(industryId);
      if (asset === undefined) {
        return disabled(
          "INDUSTRY_NOT_OWNED",
          `Seat ${seat} does not own industry ${industryId}.`,
          { seat, industryId },
        );
      }
      if (asset.liquidationValue === 0) {
        return disabled(
          "ZERO_VALUE_INDUSTRY",
          `Industry ${industryId} has no liquidation value.`,
          { seat, industryId },
        );
      }
      if (liquidationProceeds >= initialShortfall) {
        return disabled(
          "LIQUIDATION_PAST_COVERAGE",
          `Seat ${seat} must stop liquidating as soon as its shortfall is covered.`,
          { seat, industryId },
        );
      }
      selectedAssets.push(asset);
      liquidationProceeds += asset.liquidationValue;
    }

    const selectedIds = new Set(choices);
    const remainingPositiveAssets = assets.filter(
      (asset) =>
        asset.liquidationValue > 0 && !selectedIds.has(asset.buildSpaceId),
    );
    const coverage = coverageFor(
      initialShortfall,
      liquidationProceeds,
      remainingPositiveAssets.length > 0,
    );
    const remainingShortfall = Math.max(
      0,
      initialShortfall - liquidationProceeds,
    );
    const acknowledged = Object.hasOwn(partialChoices, seat);
    const ready = acknowledged && coverage !== "shortfall";
    const nextChoices = coverage === "shortfall"
      ? remainingPositiveAssets.map((asset) => {
          const proceedsAfter = liquidationProceeds + asset.liquidationValue;
          const shortfallAfter = Math.max(0, initialShortfall - proceedsAfter);
          const otherUsefulAsset = remainingPositiveAssets.some(
            (candidate) => candidate.buildSpaceId !== asset.buildSpaceId,
          );
          return {
            ...asset,
            choicesAfterAppend: [...choices, asset.buildSpaceId],
            liquidationProceedsAfterAppend: proceedsAfter,
            remainingShortfallAfterAppend: shortfallAfter,
            coverageAfterAppend: proceedsAfter >= initialShortfall
              ? "covered_by_liquidation" as const
              : otherUsefulAsset
                ? "shortfall" as const
                : "assets_exhausted" as const,
          };
        })
      : [];
    seats.push({
      seat,
      incomeLevel: incomeLevels[seat],
      requiredPayment,
      cashBefore,
      cashApplied: Math.min(cashBefore, requiredPayment),
      initialShortfall,
      selectedAssets,
      liquidationProceeds,
      remainingShortfall,
      coverage,
      acknowledged,
      ready,
      exhausted: coverage === "assets_exhausted",
      nextChoices,
      preview: previewFor(state, seat, requiredPayment, liquidationProceeds),
      authoritativeSettlement: null,
    });
  }

  if (!seats.every((seat) => seat.ready)) {
    return {
      availability: "exact",
      finalRailIncomeSkipped: false,
      requiredSeats,
      seats,
      ready: false,
      liquidationChoices: null,
      authority: null,
      reason: null,
    };
  }

  const liquidationChoices = Object.fromEntries(requiredSeats.map((seat) => [
    seat,
    [...partialChoices[seat]],
  ])) as LiquidationChoicesV2;
  return withAuthority(
    state,
    liquidationChoices,
    requiredSeats,
    seats,
    false,
  );
}

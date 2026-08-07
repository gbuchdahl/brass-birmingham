import type {
  SellActionEffect,
  SellActionSelection,
  SellBeerEffect,
  SellMerchantBonusEffect,
  SellTileEffect,
  SellTileSelection,
  SellableIndustryKind,
} from "../actions-v2/sell";
import type { PlayableCardId } from "../cards-v2/types";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import type { RulesMerchantTileId } from "../rules/generated/merchant-tiles";
import {
  executeSellForGameV2,
  type FlipIncomeAwardV2,
  type GameV2ActionAdapterResult,
} from "./action-adapters";
import {
  validateGameStateV2,
  type GameStateV2,
} from "./state";

export type GameV2SellLegalDisabledReasonCode =
  | "INVALID_GAME_STATE"
  | "GAME_ALREADY_ENDED"
  | "NOT_ACTION_PHASE"
  | "ACTOR_REQUIRED"
  | "UNKNOWN_ACTOR"
  | "NOT_CURRENT_ACTOR"
  | "ACTION_LIMIT_REACHED"
  | "CARD_REQUIRED"
  | "CARD_NOT_IN_HAND"
  | "INVALID_SALE_PREFIX"
  | "NO_LEGAL_SALE";

export type GameV2SellLegalDisabledReason = {
  readonly code: GameV2SellLegalDisabledReasonCode;
  readonly message: string;
};

export type GameV2SellIndustrySummary = {
  readonly industryId: string;
  readonly owner: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly industry: IndustryTileKind;
  readonly industryLabel: string;
  readonly sellableKind: SellableIndustryKind;
  readonly tile: {
    readonly id: IndustryTileId;
    readonly faceId: string;
    readonly level: number;
  };
};

export type GameV2SellMerchantSummary = {
  readonly merchantSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly tileId: RulesMerchantTileId;
  readonly demandIndustries: readonly SellableIndustryKind[];
};

export type GameV2SellMerchantBeerSummary = {
  readonly kind: "merchant";
  readonly merchantSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly bonus: SellMerchantBonusEffect;
};

export type GameV2SellBreweryBeerSummary = {
  readonly kind: "brewery";
  readonly industryId: string;
  readonly owner: string;
  readonly own: boolean;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly beerRemaining: number;
  readonly depleted: boolean;
};

export type GameV2SellBeerSummary =
  | GameV2SellMerchantBeerSummary
  | GameV2SellBreweryBeerSummary;

export type GameV2SellProjectedSale = {
  readonly selectionIndex: number;
  readonly industry: GameV2SellIndustrySummary;
  readonly merchant: GameV2SellMerchantSummary;
  readonly beer: GameV2SellBeerSummary;
  readonly income: SellTileEffect["income"];
};

export type GameV2SellPendingFollowUp = {
  readonly kind: "free_develop";
  readonly seat: string;
  readonly count: number;
  readonly source: "merchant_bonus";
  readonly merchantSpaceIds: readonly string[];
};

export type GameV2SellPlan = {
  /** A complete selection accepted by the authoritative Sell adapter. */
  readonly selection: SellActionSelection;
  readonly actionsConsumed: 1;
  readonly moneySpent: 0;
  readonly soldIndustryIds: readonly string[];
  readonly sales: readonly GameV2SellProjectedSale[];
  readonly rewards: SellActionEffect["rewards"];
  readonly incomeAwards: readonly FlipIncomeAwardV2[];
  readonly pendingFollowUp: GameV2SellPendingFollowUp | null;
  readonly resultingProgressPhase: GameStateV2["progress"]["phase"];
  readonly playerResult: {
    readonly money: number;
    readonly moneyChange: number;
    readonly victoryPoints: number;
    readonly victoryPointsChange: number;
    readonly incomeMarkerSpace: number;
    readonly incomeMarkerSpacesAdvanced: number;
  };
};

export type GameV2SellNextSale = {
  /** The one newly appended sale. */
  readonly sale: SellTileSelection;
  readonly industry: GameV2SellIndustrySummary;
  readonly merchant: GameV2SellMerchantSummary;
  readonly beer: GameV2SellBeerSummary;
  /** The complete reducer-ready Sell action if the player stops here. */
  readonly plan: GameV2SellPlan;
};

export type GameV2SellLegalOptions = {
  readonly availability: "exact" | "disabled";
  readonly actorSeat: string | null;
  readonly cardId: PlayableCardId | null;
  /** The already selected ordered sales used to produce this decision layer. */
  readonly selectedSales: readonly SellTileSelection[];
  /** Non-null exactly when selectedSales is itself a legal complete Sell. */
  readonly currentPlan: GameV2SellPlan | null;
  /** Every materially distinct legal sale that can be appended next. */
  readonly nextSales: readonly GameV2SellNextSale[];
  readonly reason: GameV2SellLegalDisabledReason | null;
};

type BoardSpace = {
  readonly industryId: string;
  readonly locationId: string;
  readonly locationLabel: string;
};

type MerchantSpace = {
  readonly merchantSpaceId: string;
  readonly locationId: string;
  readonly locationLabel: string;
};

const BOARD_SPACES: readonly BoardSpace[] = Object.entries(
  BOARD_V2.locations,
).flatMap(([locationId, location]) =>
  "buildSpaces" in location
    ? location.buildSpaces.map((space) => ({
        industryId: space.id,
        locationId,
        locationLabel: location.label,
      }))
    : [],
);

const BOARD_SPACE_BY_ID = new Map(
  BOARD_SPACES.map((space) => [space.industryId, space]),
);

const MERCHANT_SPACES: readonly MerchantSpace[] = Object.entries(
  BOARD_V2.locations,
).flatMap(([locationId, location]) =>
  location.kind === "merchant"
    ? location.merchantSpaces.map((merchantSpaceId) => ({
        merchantSpaceId,
        locationId,
        locationLabel: location.label,
      }))
    : [],
);

const INDUSTRY_LABELS: Readonly<Record<IndustryTileKind, string>> = {
  manufacturer: "Manufacturer",
  cotton: "Cotton Mill",
  brewery: "Brewery",
  coal: "Coal Mine",
  pottery: "Pottery",
  iron: "Iron Works",
};

function cloneSale(sale: SellTileSelection): SellTileSelection {
  return {
    industryId: sale.industryId,
    merchantSpaceId: sale.merchantSpaceId,
    beerSource: sale.beerSource.kind === "merchant"
      ? { kind: "merchant" }
      : {
          kind: "brewery",
          industryId: sale.beerSource.industryId,
        },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSellTileSelection(value: unknown): value is SellTileSelection {
  if (
    !isRecord(value) ||
    typeof value.industryId !== "string" ||
    value.industryId.length === 0 ||
    typeof value.merchantSpaceId !== "string" ||
    value.merchantSpaceId.length === 0 ||
    !isRecord(value.beerSource)
  ) return false;
  return value.beerSource.kind === "merchant" ||
    (value.beerSource.kind === "brewery" &&
      typeof value.beerSource.industryId === "string" &&
      value.beerSource.industryId.length > 0);
}

function disabled(
  actorSeat: string | null,
  cardId: PlayableCardId | null,
  selectedSales: readonly SellTileSelection[],
  code: GameV2SellLegalDisabledReasonCode,
  message: string,
): GameV2SellLegalOptions {
  return {
    availability: "disabled",
    actorSeat,
    cardId,
    selectedSales: selectedSales.map(cloneSale),
    currentPlan: null,
    nextSales: [],
    reason: { code, message },
  };
}

function sellableKind(industry: IndustryTileKind): SellableIndustryKind | null {
  if (industry === "cotton") return "cotton_mill";
  if (industry === "manufacturer" || industry === "pottery") return industry;
  return null;
}

function projectIndustry(
  state: GameStateV2,
  industryId: string,
): GameV2SellIndustrySummary {
  const placement = state.board.placedIndustries[industryId];
  const boardSpace = BOARD_SPACE_BY_ID.get(industryId);
  if (!placement || !boardSpace) {
    throw new Error(`Accepted Sell referenced an unknown Industry: ${industryId}.`);
  }
  const tile = INDUSTRY_TILE_BY_ID[placement.tileId];
  const kind = sellableKind(tile.industry);
  if (!kind) {
    throw new Error(`Accepted Sell referenced a non-sellable Industry: ${industryId}.`);
  }
  return {
    industryId,
    owner: placement.owner,
    locationId: placement.locationId,
    locationLabel: boardSpace.locationLabel,
    industry: tile.industry,
    industryLabel: INDUSTRY_LABELS[tile.industry],
    sellableKind: kind,
    tile: {
      id: tile.id,
      faceId: tile.faceId,
      level: tile.level,
    },
  };
}

function projectMerchant(
  state: GameStateV2,
  merchantSpaceId: string,
): GameV2SellMerchantSummary {
  const canonical = MERCHANT_SPACES.find(
    (space) => space.merchantSpaceId === merchantSpaceId,
  );
  const merchant = state.merchants.spaces.find(
    (space) => space.merchantSpaceId === merchantSpaceId,
  );
  if (!canonical || !merchant?.active || merchant.tileId === null) {
    throw new Error(`Accepted Sell referenced an inactive Merchant: ${merchantSpaceId}.`);
  }
  return {
    merchantSpaceId,
    locationId: merchant.locationId,
    locationLabel: canonical.locationLabel,
    tileId: merchant.tileId,
    demandIndustries: [...merchant.demandIndustries],
  };
}

function projectBeer(
  state: GameStateV2,
  actorSeat: string,
  beer: SellBeerEffect,
): GameV2SellBeerSummary {
  if (beer.kind === "merchant") {
    const location = BOARD_V2.locations[
      beer.locationId as keyof typeof BOARD_V2.locations
    ];
    return {
      kind: "merchant",
      merchantSpaceId: beer.merchantSpaceId,
      locationId: beer.locationId,
      locationLabel: location.label,
      bonus: { ...beer.bonus },
    };
  }
  const placement = state.board.placedIndustries[beer.industryId];
  const boardSpace = BOARD_SPACE_BY_ID.get(beer.industryId);
  if (!placement || !boardSpace) {
    throw new Error(
      `Accepted Sell referenced an unknown Brewery: ${beer.industryId}.`,
    );
  }
  return {
    kind: "brewery",
    industryId: beer.industryId,
    owner: beer.owner,
    own: beer.owner === actorSeat,
    locationId: beer.locationId,
    locationLabel: boardSpace.locationLabel,
    beerRemaining: beer.beerRemaining,
    depleted: beer.depleted,
  };
}

function projectSale(
  state: GameStateV2,
  actorSeat: string,
  effect: SellTileEffect,
): GameV2SellProjectedSale {
  return {
    selectionIndex: effect.selectionIndex,
    industry: projectIndustry(state, effect.industryId),
    merchant: projectMerchant(state, effect.merchantSpaceId),
    beer: projectBeer(state, actorSeat, effect.beer),
    income: { ...effect.income },
  };
}

type AcceptedSell = Extract<
  GameV2ActionAdapterResult<SellActionEffect>,
  { readonly ok: true }
>;

function projectPlan(
  state: GameStateV2,
  actorSeat: string,
  selection: SellActionSelection,
  result: AcceptedSell,
): GameV2SellPlan {
  const before = state.players[actorSeat];
  const after = result.state.players[actorSeat];
  return {
    selection: {
      cardId: selection.cardId,
      sales: selection.sales.map(cloneSale),
    },
    actionsConsumed: 1,
    moneySpent: 0,
    soldIndustryIds: [...result.effect.soldIndustryIds],
    sales: result.effect.sales.map((sale) =>
      projectSale(state, actorSeat, sale)
    ),
    rewards: { ...result.effect.rewards },
    incomeAwards: result.effect.incomeAwards.map((award) => ({ ...award })),
    pendingFollowUp: result.pending
      ? {
          kind: "free_develop",
          seat: result.pending.seat,
          count: result.pending.count,
          source: result.pending.source,
          merchantSpaceIds: [...result.pending.merchantSpaceIds],
        }
      : null,
    resultingProgressPhase: result.state.progress.phase,
    playerResult: {
      money: after.money,
      moneyChange: after.money - before.money,
      victoryPoints: after.victoryPoints,
      victoryPointsChange: after.victoryPoints - before.victoryPoints,
      incomeMarkerSpace: after.incomeMarkerSpace,
      incomeMarkerSpacesAdvanced:
        after.incomeMarkerSpace - before.incomeMarkerSpace,
    },
  };
}

function execute(
  state: GameStateV2,
  selection: SellActionSelection,
): GameV2ActionAdapterResult<SellActionEffect> {
  try {
    return executeSellForGameV2(state, selection);
  } catch {
    return {
      ok: false,
      state,
      error: {
        code: "INVALID_SALE_SELECTION",
        message: "Sell selection is malformed.",
      },
    };
  }
}

function candidateIndustries(
  state: GameStateV2,
  actorSeat: string,
): readonly BoardSpace[] {
  return BOARD_SPACES.filter(({ industryId }) => {
    const placement = state.board.placedIndustries[industryId];
    if (!placement || placement.owner !== actorSeat || placement.flipped) {
      return false;
    }
    return sellableKind(INDUSTRY_TILE_BY_ID[placement.tileId].industry) !== null;
  });
}

function candidateBreweries(state: GameStateV2): readonly string[] {
  return BOARD_SPACES.flatMap(({ industryId }) => {
    const placement = state.board.placedIndustries[industryId];
    return placement &&
        INDUSTRY_TILE_BY_ID[placement.tileId].industry === "brewery" &&
        !placement.flipped &&
        placement.resources.beer > 0
      ? [industryId]
      : [];
  });
}

/**
 * Enumerates one exact, bounded layer of an ordered Sell action.
 *
 * Sell permits any non-empty ordered list of sales, so eagerly materializing
 * every complete list is factorial in the number of products. Instead, an
 * empty `selectedSales` list enumerates every legal first sale. Passing an
 * emitted plan's `selection.sales` back as `selectedSales` enumerates every
 * legal continuation. `currentPlan` is always reducer-ready, allowing the
 * player to stop after any accepted prefix without losing multi-sale support.
 *
 * The authoritative adapter remains the sole judge of connectivity, demand,
 * Merchant beer priority, Brewery availability, bonuses, and pending free
 * Develop consequences. Candidate generation only supplies the finite board
 * product of physical Industries, Merchant spaces, and beer sources.
 */
export function getGameV2SellLegalOptions(
  state: GameStateV2,
  actorSeat: string | null,
  selectedCardId: PlayableCardId | null,
  selectedSales: readonly SellTileSelection[] = [],
): GameV2SellLegalOptions {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    const first = validation.errors[0];
    return disabled(
      actorSeat,
      selectedCardId,
      [],
      "INVALID_GAME_STATE",
      `${first.path}: ${first.message}`,
    );
  }
  if (!Array.isArray(selectedSales)) {
    return disabled(
      actorSeat,
      selectedCardId,
      [],
      "INVALID_SALE_PREFIX",
      "Selected sales must be an array.",
    );
  }
  if (!selectedSales.every(isSellTileSelection)) {
    return disabled(
      actorSeat,
      selectedCardId,
      [],
      "INVALID_SALE_PREFIX",
      "Every selected sale requires an Industry, Merchant, and beer source.",
    );
  }
  if (state.progress.phase === "ended") {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "GAME_ALREADY_ENDED",
      "The game has ended.",
    );
  }
  if (state.progress.phase !== "action") {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "NOT_ACTION_PHASE",
      `Sell is unavailable during ${state.progress.phase}.`,
    );
  }
  if (actorSeat === null) {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "ACTOR_REQUIRED",
      "Sell requires an actor.",
    );
  }
  if (!state.turnOrder.includes(actorSeat)) {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "UNKNOWN_ACTOR",
      `Unknown actor seat: ${actorSeat}.`,
    );
  }
  if (actorSeat !== state.currentSeat) {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "NOT_CURRENT_ACTOR",
      `Only ${state.currentSeat} may sell now.`,
    );
  }
  if (state.actionsUsed >= state.actionLimit) {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "ACTION_LIMIT_REACHED",
      "The current turn has already used its action allowance.",
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
      selectedSales,
      "CARD_REQUIRED",
      "Choose an action card before selecting a Sell plan.",
    );
  }
  if (!state.cards.hands[actorSeat].includes(selectedCardId)) {
    return disabled(
      actorSeat,
      selectedCardId,
      selectedSales,
      "CARD_NOT_IN_HAND",
      "The selected Sell card is not in the active player's hand.",
    );
  }

  const prefix = selectedSales.map(cloneSale);
  let currentPlan: GameV2SellPlan | null = null;
  let candidateState = state;
  if (prefix.length > 0) {
    const currentSelection: SellActionSelection = {
      cardId: selectedCardId,
      sales: prefix,
    };
    const current = execute(state, currentSelection);
    if (!current.ok) {
      return disabled(
        actorSeat,
        selectedCardId,
        prefix,
        "INVALID_SALE_PREFIX",
        `${current.error.code}: ${current.error.message}`,
      );
    }
    currentPlan = projectPlan(state, actorSeat, currentSelection, current);
    candidateState = current.state;
  }

  const merchantsById = new Map(
    candidateState.merchants.spaces.map((space) => [
      space.merchantSpaceId,
      space,
    ]),
  );
  const breweries = candidateBreweries(candidateState);
  const nextSales: GameV2SellNextSale[] = [];
  const materialOutcomes = new Set<string>();

  for (const industrySpace of candidateIndustries(candidateState, actorSeat)) {
    const placement = candidateState.board.placedIndustries[
      industrySpace.industryId
    ];
    const kind = sellableKind(
      INDUSTRY_TILE_BY_ID[placement.tileId].industry,
    );
    if (kind === null) continue;

    for (const merchantSpace of MERCHANT_SPACES) {
      const merchant = merchantsById.get(merchantSpace.merchantSpaceId);
      if (
        !merchant?.active ||
        merchant.tileId === null ||
        !merchant.demandIndustries.includes(kind)
      ) continue;

      const beerSources = [
        { kind: "merchant" as const },
        ...breweries.map((industryId) => ({
          kind: "brewery" as const,
          industryId,
        })),
      ];
      for (const beerSource of beerSources) {
        const sale: SellTileSelection = {
          industryId: industrySpace.industryId,
          merchantSpaceId: merchantSpace.merchantSpaceId,
          beerSource,
        };
        const selection: SellActionSelection = {
          cardId: selectedCardId,
          sales: [...prefix, sale],
        };
        const planned = execute(state, selection);
        if (!planned.ok) continue;
        const materialOutcome = JSON.stringify(planned.state);
        if (materialOutcomes.has(materialOutcome)) continue;
        materialOutcomes.add(materialOutcome);
        const plan = projectPlan(state, actorSeat, selection, planned);
        const projected = plan.sales[plan.sales.length - 1];
        nextSales.push({
          sale: cloneSale(sale),
          industry: projected.industry,
          merchant: projected.merchant,
          beer: projected.beer,
          plan,
        });
      }
    }
  }

  if (currentPlan === null && nextSales.length === 0) {
    return disabled(
      actorSeat,
      selectedCardId,
      prefix,
      "NO_LEGAL_SALE",
      "No Industry can currently be sold with the available beer.",
    );
  }

  return {
    availability: "exact",
    actorSeat,
    cardId: selectedCardId,
    selectedSales: prefix,
    currentPlan,
    nextSales,
    reason: null,
  };
}

import type { PlayableCardId } from "@/engine/cards-v2/types";
import type {
  GameV2Command,
  GameV2CommandOutcome,
  GameV2PlayerCommand,
} from "@/engine/game-v2/commands";
import {
  getGameV2LegalOptions,
  type GameV2LegalityDisabledReason,
} from "@/engine/game-v2/legal";
import {
  getGameV2BuildLegalOptions,
  type GameV2BuildLegalDisabledReason,
  type GameV2BuildResourceSource,
} from "@/engine/game-v2/build-legal";
import {
  getGameV2DevelopLegalOptions,
  type GameV2DevelopLegalDisabledReason,
} from "@/engine/game-v2/develop-legal";
import type { GameStateV2 } from "@/engine/game-v2/state";
import { incomeLevelAt } from "@/engine/economy/income";
import type { LiquidationChoicesV2 } from "@/engine/game-v2/turn-lifecycle";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import { INDUSTRY_TILE_BY_ID } from "@/engine/rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";
import type {
  HotseatDraft,
  HotseatPublicModel,
  HotseatViewModel,
} from "@/ui/hotseat-session";

export type HotseatSimpleCardAction = Extract<
  GameV2PlayerCommand["type"],
  "PASS" | "LOAN"
>;

export type HotseatNetworkCommand = Extract<
  GameV2PlayerCommand,
  { readonly type: "NETWORK" }
>;

export type HotseatBuildCommand = Extract<
  GameV2PlayerCommand,
  { readonly type: "BUILD" }
>;

export type HotseatDevelopCommand = Extract<
  GameV2PlayerCommand,
  { readonly type: "DEVELOP" }
>;

export type HotseatMerchantFreeDevelopCommand = Extract<
  GameV2Command,
  { readonly type: "RESOLVE_MERCHANT_FREE_DEVELOP" }
>;

export type HotseatPrototypeNetworkLink = {
  readonly linkId: string;
  readonly endpointLabel: string;
  readonly cost: number;
  readonly selection: Omit<HotseatNetworkCommand["selection"], "cardId">;
};

export type HotseatPrototypeBuildPlan = {
  /** Stable structural ID, independent of display order. */
  readonly id: string;
  readonly buildSpaceId: string;
  readonly buildSpaceLabel: string;
  readonly locationLabel: string;
  readonly industry: string;
  readonly industryLabel: string;
  readonly industryEmoji: string;
  readonly tileId: string;
  readonly tileLevel: number;
  readonly sourceSummary: string;
  readonly totalCost: number;
  readonly moneyChange: number;
  readonly selection: HotseatBuildCommand["selection"];
};

export type HotseatPrototypeDevelopPlan = {
  readonly id: string;
  readonly tiles: readonly {
    readonly id: string;
    readonly industryLabel: string;
    readonly industryEmoji: string;
    readonly level: number;
  }[];
  readonly ironSummary: string;
  readonly boardIronSources: readonly {
    readonly locationLabel: string;
    readonly owner: string;
    readonly unitsConsumed: number;
    readonly cubesRemaining: number;
  }[];
  readonly marketIronUnits: number;
  readonly marketIronCost: number;
  readonly totalCost: number;
  readonly selection: HotseatDevelopCommand["selection"];
};

export type HotseatPrototypePlayerInventory = {
  readonly seat: string;
  readonly industries: readonly {
    readonly kind: string;
    readonly industryLabel: string;
    readonly industryEmoji: string;
    readonly remaining: number;
    readonly nextTileLevel: number | null;
  }[];
};

export type HotseatPrototypePlacedIndustry = {
  readonly buildSpaceId: string;
  readonly locationLabel: string;
  readonly owner: string;
  readonly industryLabel: string;
  readonly industryEmoji: string;
  readonly tileId: string;
  readonly tileLevel: number;
  readonly resourceSummary: string;
  readonly flipped: boolean;
};

export type HotseatPrototypeMerchantFreeDevelopSelection = {
  readonly id: string;
  readonly tileIds: readonly string[];
  readonly tiles: readonly {
    readonly id: string;
    readonly industryLabel: string;
    readonly industryEmoji: string;
    readonly level: number;
  }[];
  readonly skippedCount: number;
};

export type HotseatPrototypePrivateModel = {
  readonly mode: "action" | "merchant_free_develop";
  readonly seat: string;
  readonly cards: readonly {
    readonly id: PlayableCardId;
    readonly label: string;
    readonly canPass: boolean;
    readonly canLoan: boolean;
    readonly canScout: boolean;
    readonly canNetwork: boolean;
    readonly canDevelop: boolean;
  }[];
  readonly selectedCardId: PlayableCardId | null;
  readonly selectedScoutCardIds: readonly PlayableCardId[];
  readonly selectedNetworkLinkId: string | null;
  readonly selectedBuildPlanId: string | null;
  readonly selectedDevelopPlanId: string | null;
  readonly merchantFreeDevelop: {
    readonly availability: "exact" | "disabled";
    readonly requiredCount: number;
    readonly selections: readonly HotseatPrototypeMerchantFreeDevelopSelection[];
    readonly selectedSelectionId: string | null;
    readonly selectionIsLegal: boolean;
    readonly reason: GameV2LegalityDisabledReason | null;
  } | null;
  readonly legal: {
    readonly pass: {
      readonly selectedIsLegal: boolean;
      readonly reason: GameV2LegalityDisabledReason | null;
    };
    readonly loan: {
      readonly selectedIsLegal: boolean;
      readonly reason: GameV2LegalityDisabledReason | null;
    };
    readonly scout: {
      readonly selectionIsLegal: boolean;
      readonly reason: GameV2LegalityDisabledReason | null;
    };
    readonly network: {
      readonly availability: "exact" | "attemptable" | "disabled";
      readonly selectedCardIsLegal: boolean;
      readonly selectionIsLegal: boolean;
      readonly links: readonly HotseatPrototypeNetworkLink[];
      readonly reason: GameV2LegalityDisabledReason | null;
    };
    readonly build: {
      readonly availability: "exact" | "disabled";
      readonly selectionIsLegal: boolean;
      readonly plans: readonly HotseatPrototypeBuildPlan[];
      readonly reason: GameV2BuildLegalDisabledReason | null;
    };
    readonly develop: {
      readonly availability: "exact" | "disabled";
      readonly selectionIsLegal: boolean;
      readonly plans: readonly HotseatPrototypeDevelopPlan[];
      readonly reason: GameV2DevelopLegalDisabledReason | null;
    };
  };
};

export type HotseatPrototypeFeedback =
  | {
      readonly kind: "accepted";
      readonly commandId: string;
      readonly message: string;
    }
  | {
      readonly kind: "error";
      readonly commandId: string;
      readonly source: string;
      readonly code: string;
      readonly message: string;
    };

export type HotseatPrototypeBoundary =
  | {
      readonly kind: "round_settlement";
      readonly automaticLiquidationChoices: LiquidationChoicesV2 | null;
    }
  | { readonly kind: "era_transition" }
  | {
      readonly kind: "merchant_free_develop";
      readonly seat: string;
      readonly count: number;
    }
  | {
      readonly kind: "ended";
      readonly standings: Extract<
        HotseatPublicModel["progress"],
        { readonly phase: "ended" }
      >["standings"];
    };

export type HotseatPrototypeModel = {
  readonly public: HotseatPublicModel;
  readonly handoff: { readonly nextSeat: string } | null;
  readonly private: HotseatPrototypePrivateModel | null;
  readonly placedIndustries: readonly HotseatPrototypePlacedIndustry[];
  readonly playerIndustryInventories: readonly HotseatPrototypePlayerInventory[];
  readonly boundary: HotseatPrototypeBoundary | null;
  readonly feedback: HotseatPrototypeFeedback | null;
};

const CARD_LABEL_BY_ID = new Map<string, string>(
  CARD_CATALOG.map((card) => [card.id, humanizeCardTemplate(card.templateId)]),
);

function humanizeCardTemplate(value: string): string {
  return value
    .replace(/^industry-/, "")
    .replace(/^location-/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function hotseatCardLabel(cardId: PlayableCardId): string {
  if (cardId === "wild-location") return "Wild location";
  if (cardId === "wild-industry") return "Wild industry";
  return CARD_LABEL_BY_ID.get(cardId) ?? humanizeCardTemplate(cardId);
}

export function hotseatCardDraft(
  cardId: PlayableCardId,
  commandType: HotseatSimpleCardAction = "PASS",
): HotseatDraft {
  return { commandType, fields: { cardId } };
}

/** Selects the single card used by Pass or Loan without dropping Scout work. */
export function selectHotseatActionCard(
  draft: HotseatDraft | null,
  cardId: PlayableCardId,
  commandType: HotseatSimpleCardAction = "PASS",
): HotseatDraft {
  return {
    commandType,
    fields: { ...draft?.fields, cardId },
  };
}

export function selectedHotseatCardId(
  draft: HotseatDraft | null,
): PlayableCardId | null {
  const cardId = draft?.fields.cardId;
  return typeof cardId === "string" && cardId.length > 0
    ? cardId as PlayableCardId
    : null;
}

export function selectedHotseatScoutCardIds(
  draft: HotseatDraft | null,
): readonly PlayableCardId[] {
  const cards = draft?.fields.cardsToDiscard;
  if (!Array.isArray(cards)) return [];
  return cards.filter(
    (cardId): cardId is PlayableCardId =>
      typeof cardId === "string" && cardId.length > 0,
  );
}

export function selectedHotseatNetworkLinkId(
  draft: HotseatDraft | null,
): string | null {
  const linkId = draft?.fields.networkLinkId;
  return typeof linkId === "string" && linkId.length > 0 ? linkId : null;
}

export function normalizeHotseatNetworkLinkId(
  linkId: string | null,
  selectableLinkIds: readonly string[],
): string | null {
  return linkId !== null && selectableLinkIds.includes(linkId) ? linkId : null;
}

/** Selects one exact Canal link while preserving the shared action card. */
export function selectHotseatNetworkLink(
  draft: HotseatDraft | null,
  linkId: string,
  selectableLinkIds: readonly string[],
): HotseatDraft {
  return {
    commandType: "NETWORK",
    fields: {
      ...draft?.fields,
      networkLinkId: normalizeHotseatNetworkLinkId(linkId, selectableLinkIds),
    },
  };
}

/** Builds a typed command only from the exact selector-backed UI projection. */
export function selectedHotseatNetworkCommand(
  privateModel: HotseatPrototypePrivateModel,
): HotseatNetworkCommand | null {
  if (!privateModel.legal.network.selectionIsLegal) return null;
  const cardId = privateModel.selectedCardId;
  const link = privateModel.legal.network.links.find(
    (candidate) => candidate.linkId === privateModel.selectedNetworkLinkId,
  );
  if (cardId === null || link === undefined) return null;
  return {
    type: "NETWORK",
    selection: { ...link.selection, cardId },
  };
}

export function selectedHotseatBuildPlanId(
  draft: HotseatDraft | null,
): string | null {
  const planId = draft?.fields.buildPlanId;
  return typeof planId === "string" && planId.length > 0 ? planId : null;
}

export function hotseatBuildPlanId(
  selection: HotseatBuildCommand["selection"],
): string {
  return JSON.stringify({
    cardId: selection.cardId,
    buildSpaceId: selection.buildSpaceId,
    industry: selection.industry,
    coalSources: selection.coalSources,
    ironSources: selection.ironSources,
  });
}

export function normalizeHotseatBuildPlanId(
  planId: string | null,
  selectablePlanIds: readonly string[],
): string | null {
  return planId !== null && selectablePlanIds.includes(planId) ? planId : null;
}

/**
 * Removes an invalid persisted plan while retaining it across unrelated UI
 * controls whenever it is still one of the exact selector choices.
 */
export function normalizeHotseatBuildDraft(
  draft: HotseatDraft | null,
  selectablePlanIds: readonly string[],
): HotseatDraft | null {
  if (draft === null) return null;
  const normalized = normalizeHotseatBuildPlanId(
    selectedHotseatBuildPlanId(draft),
    selectablePlanIds,
  );
  const fields = { ...draft.fields };
  if (normalized === null) {
    delete fields.buildPlanId;
  } else {
    fields.buildPlanId = normalized;
  }
  return { ...draft, fields };
}

export function selectHotseatBuildPlan(
  draft: HotseatDraft | null,
  planId: string,
  selectablePlanIds: readonly string[],
): HotseatDraft {
  const normalized = normalizeHotseatBuildPlanId(planId, selectablePlanIds);
  const fields = { ...draft?.fields };
  if (normalized === null) {
    delete fields.buildPlanId;
  } else {
    fields.buildPlanId = normalized;
  }
  return { commandType: "BUILD", fields };
}

export function selectedHotseatBuildCommand(
  privateModel: HotseatPrototypePrivateModel,
): HotseatBuildCommand | null {
  if (!privateModel.legal.build.selectionIsLegal) return null;
  const plan = privateModel.legal.build.plans.find(
    (candidate) => candidate.id === privateModel.selectedBuildPlanId,
  );
  return plan === undefined ? null : { type: "BUILD", selection: plan.selection };
}

export function selectedHotseatDevelopPlanId(
  draft: HotseatDraft | null,
): string | null {
  const planId = draft?.fields.developPlanId;
  return typeof planId === "string" && planId.length > 0 ? planId : null;
}

export function hotseatDevelopPlanId(
  selection: HotseatDevelopCommand["selection"],
): string {
  return JSON.stringify({
    cardId: selection.cardId,
    tileIds: selection.tileIds,
    accessibleIronIndustryIds: selection.accessibleIronIndustryIds,
    purchaseMarketShortfall: selection.purchaseMarketShortfall,
  });
}

export function normalizeHotseatDevelopPlanId(
  planId: string | null,
  legalPlanIds: readonly string[],
): string | null {
  return planId !== null && legalPlanIds.includes(planId) ? planId : null;
}

export function normalizeHotseatDevelopDraft(
  draft: HotseatDraft | null,
  legalPlanIds: readonly string[],
): HotseatDraft | null {
  if (draft === null) return null;
  const normalized = normalizeHotseatDevelopPlanId(
    selectedHotseatDevelopPlanId(draft),
    legalPlanIds,
  );
  const fields = { ...draft.fields };
  if (normalized === null) {
    delete fields.developPlanId;
  } else {
    fields.developPlanId = normalized;
  }
  return { ...draft, fields };
}

export function selectHotseatDevelopPlan(
  draft: HotseatDraft | null,
  planId: string,
  legalPlanIds: readonly string[],
): HotseatDraft {
  const normalized = normalizeHotseatDevelopPlanId(planId, legalPlanIds);
  const fields = { ...draft?.fields };
  if (normalized === null) {
    delete fields.developPlanId;
  } else {
    fields.developPlanId = normalized;
  }
  return { commandType: "DEVELOP", fields };
}

export function selectedHotseatDevelopCommand(
  privateModel: HotseatPrototypePrivateModel,
): HotseatDevelopCommand | null {
  if (!privateModel.legal.develop.selectionIsLegal) return null;
  const plan = privateModel.legal.develop.plans.find(
    (candidate) => candidate.id === privateModel.selectedDevelopPlanId,
  );
  return plan === undefined
    ? null
    : { type: "DEVELOP", selection: plan.selection };
}

export function hotseatMerchantFreeDevelopSelectionId(
  tileIds: readonly string[],
): string {
  return JSON.stringify(tileIds);
}

export function selectedHotseatMerchantFreeDevelopSelectionId(
  draft: HotseatDraft | null,
): string | null {
  const selectionId = draft?.fields.merchantFreeDevelopSelectionId;
  return typeof selectionId === "string" && selectionId.length > 0
    ? selectionId
    : null;
}

export function normalizeHotseatMerchantFreeDevelopSelectionId(
  selectionId: string | null,
  legalSelectionIds: readonly string[],
): string | null {
  return selectionId !== null && legalSelectionIds.includes(selectionId)
    ? selectionId
    : null;
}

export function selectHotseatMerchantFreeDevelopSelection(
  draft: HotseatDraft | null,
  selectionId: string,
  legalSelectionIds: readonly string[],
): HotseatDraft {
  const normalized = normalizeHotseatMerchantFreeDevelopSelectionId(
    selectionId,
    legalSelectionIds,
  );
  const fields = { ...draft?.fields };
  if (normalized === null) {
    delete fields.merchantFreeDevelopSelectionId;
  } else {
    fields.merchantFreeDevelopSelectionId = normalized;
  }
  return {
    commandType: "RESOLVE_MERCHANT_FREE_DEVELOP",
    fields,
  };
}

export function selectedHotseatMerchantFreeDevelopCommand(
  privateModel: HotseatPrototypePrivateModel,
): HotseatMerchantFreeDevelopCommand | null {
  const followUp = privateModel.merchantFreeDevelop;
  if (followUp === null || !followUp.selectionIsLegal) return null;
  const selection = followUp.selections.find(
    (candidate) => candidate.id === followUp.selectedSelectionId,
  );
  return selection === undefined
    ? null
    : {
        type: "RESOLVE_MERCHANT_FREE_DEVELOP",
        selection: { tileIds: selection.tileIds },
      };
}

const INDUSTRY_PRESENTATION: Readonly<Record<
  string,
  { readonly label: string; readonly emoji: string }
>> = {
  brewery: { label: "Brewery", emoji: "🍺" },
  coal: { label: "Coal mine", emoji: "⛏️" },
  cotton: { label: "Cotton mill", emoji: "🧶" },
  iron: { label: "Iron works", emoji: "⚙️" },
  manufacturer: { label: "Manufacturer", emoji: "🏭" },
  pottery: { label: "Pottery", emoji: "🏺" },
};

function industryPresentation(industry: string): {
  readonly label: string;
  readonly emoji: string;
} {
  return INDUSTRY_PRESENTATION[industry] ?? {
    label: humanizeCardTemplate(industry),
    emoji: "🏭",
  };
}

function hotseatBuildSourceSummary(
  sources: readonly GameV2BuildResourceSource[],
): string {
  if (sources.length === 0) return "No coal or iron required";
  return sources.map((source) => {
    const resource = source.resource === "coal" ? "Coal" : "Iron";
    const emoji = source.resource === "coal" ? "⛏️" : "⚙️";
    return source.kind === "market"
      ? `${emoji} ${resource} market (£${source.unitPrice})`
      : `${emoji} ${resource} from ${source.locationLabel} (${source.owner})`;
  }).join(" · ");
}

function hotseatDevelopIronSummary(
  boardSources: readonly {
    readonly locationLabel: string;
    readonly owner: string;
    readonly unitsConsumed: number;
  }[],
  market: { readonly unitsPurchased: number; readonly totalCost: number },
): string {
  const parts = boardSources.map((source) =>
    `⚙️ ${source.unitsConsumed} iron from ${source.locationLabel} (${source.owner})`
  );
  if (market.unitsPurchased > 0) {
    parts.push(
      `⚙️ ${market.unitsPurchased} iron from market (£${market.totalCost})`,
    );
  }
  return parts.join(" · ");
}

function hotseatBuildSpaceLabel(buildSpaceId: string): string {
  const suffix = /_([0-9]+)$/.exec(buildSpaceId)?.[1];
  return suffix === undefined ? buildSpaceId : `space ${suffix}`;
}

function hotseatPlacedResourceSummary(
  resources: { readonly coal: number; readonly iron: number; readonly beer: number },
): string {
  const parts = [
    resources.coal > 0 ? `⛏️ ${resources.coal} coal` : null,
    resources.iron > 0 ? `⚙️ ${resources.iron} iron` : null,
    resources.beer > 0 ? `🍺 ${resources.beer} beer` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? "No resources" : parts.join(" · ");
}

/**
 * Canonicalizes Scout choices into selector order, removing duplicates,
 * unavailable cards, and anything past the three-card limit.
 */
export function normalizeHotseatScoutSelection(
  selectedCardIds: readonly PlayableCardId[],
  selectableCardIds: readonly PlayableCardId[],
): readonly PlayableCardId[] {
  const selected = new Set(selectedCardIds);
  return selectableCardIds.filter((cardId) => selected.has(cardId)).slice(0, 3);
}

export function toggleHotseatScoutCard(
  draft: HotseatDraft | null,
  cardId: PlayableCardId,
  selectableCardIds: readonly PlayableCardId[],
): HotseatDraft {
  const current = normalizeHotseatScoutSelection(
    selectedHotseatScoutCardIds(draft),
    selectableCardIds,
  );
  const selected = new Set(current);
  if (selected.has(cardId)) {
    selected.delete(cardId);
  } else if (selectableCardIds.includes(cardId) && selected.size < 3) {
    selected.add(cardId);
  }
  return {
    commandType: "SCOUT",
    fields: {
      ...draft?.fields,
      cardsToDiscard: normalizeHotseatScoutSelection(
        [...selected],
        selectableCardIds,
      ),
    },
  };
}

export function legalHotseatScoutTriple(
  selectedCardIds: readonly PlayableCardId[],
  legalTriples: readonly (readonly [
    PlayableCardId,
    PlayableCardId,
    PlayableCardId,
  ])[],
): readonly [PlayableCardId, PlayableCardId, PlayableCardId] | null {
  if (selectedCardIds.length !== 3) return null;
  return legalTriples.find((triple) =>
    triple.every((cardId, index) => cardId === selectedCardIds[index])
  ) ?? null;
}

export function describeHotseatOutcome(outcome: GameV2CommandOutcome): string {
  if (outcome.kind === "player_action") {
    const seat = "seat" in outcome.effect ? outcome.effect.seat : "Player";
    const followUp = outcome.pendingFollowUp
      ? " A Merchant free Develop must be resolved next."
      : outcome.turnComplete
        ? " Turn complete."
        : " One action remains.";
    return `${seat}: ${outcome.actionType} accepted.${followUp}`;
  }
  if (outcome.kind === "merchant_free_develop") {
    return outcome.turnComplete
      ? "Merchant free Develop resolved. Turn complete."
      : "Merchant free Develop resolved. One action remains.";
  }
  if (outcome.kind === "round_settlement") {
    return outcome.eraComplete
      ? "Round settled. Era scoring is ready."
      : "Round settled. The next round is ready.";
  }
  return outcome.resolution.gameEnded
    ? "Final Rail scoring complete. The game has ended."
    : "Canal scoring complete. The Rail Era is ready.";
}

function boundaryFor(
  game: HotseatPublicModel,
): HotseatPrototypeBoundary | null {
  const progress = game.progress;
  if (progress.phase === "round_settlement") {
    return {
      kind: "round_settlement",
      automaticLiquidationChoices: automaticHotseatLiquidationChoices(game),
    };
  }
  if (progress.phase === "era_transition") {
    return { kind: "era_transition" };
  }
  if (progress.phase === "merchant_free_develop") {
    return {
      kind: "merchant_free_develop",
      seat: progress.pending.seat,
      count: progress.pending.count,
    };
  }
  if (progress.phase === "ended") {
    return { kind: "ended", standings: progress.standings };
  }
  return null;
}

/**
 * Produces a settlement that needs no asset-sale decision. A negative-income
 * player still gets an explicit empty choice, as required by the engine. When
 * cash is short and the player owns an industry, the UI must ask which assets
 * to sell instead of silently choosing or converting the shortfall to VP loss.
 */
export function automaticHotseatLiquidationChoices(
  game: HotseatPublicModel,
): LiquidationChoicesV2 | null {
  const playerCount = game.turn.turnOrder.length as 2 | 3 | 4;
  const finalRound = SETUP_DATA.playerCounts[playerCount]?.roundsPerEra;
  if (game.turn.era === "rail" && game.turn.round === finalRound) return {};

  const choices: Record<string, readonly string[]> = {};
  for (const player of game.players) {
    const income = incomeLevelAt(player.incomeMarkerSpace);
    if (income >= 0) continue;
    const requiredPayment = -income;
    const ownsIndustry = game.board.placedIndustries.some(
      (industry) => industry.owner === player.seat,
    );
    if (player.money < requiredPayment && ownsIndustry) return null;
    choices[player.seat] = [];
  }
  return choices;
}

export function toHotseatPrototypeModel(
  view: HotseatViewModel,
  state: GameStateV2,
): HotseatPrototypeModel {
  const feedback: HotseatPrototypeFeedback | null = view.lastResult === null
    ? null
    : view.lastResult.ok
      ? {
          kind: "accepted",
          commandId: view.lastResult.commandId,
          message: describeHotseatOutcome(view.lastResult.outcome),
        }
      : {
          kind: "error",
          commandId: view.lastResult.commandId,
          source: view.lastResult.error.source,
          code: view.lastResult.error.code,
          message: view.lastResult.error.message,
        };

  const isPrivatePlayerPhase = view.public.progress.phase === "action" ||
    view.public.progress.phase === "merchant_free_develop";
  const expectedPrivateSeat = state.progress.phase === "merchant_free_develop"
    ? state.progress.pending.seat
    : state.currentSeat;
  const privateView = isPrivatePlayerPhase &&
      view.private !== null &&
      view.public.identity.gameId === state.gameId &&
      view.public.identity.revision === state.revision &&
      view.private.seat === expectedPrivateSeat
    ? view.private
    : null;
  const privateModel = privateView === null
    ? null
    : (() => {
        // Legal card identities are computed only inside the revealed branch.
        // Nothing from this selector reaches the handoff/public projection.
        const options = getGameV2LegalOptions(state, privateView.seat);
        const pass = options.playerActions.find((action) =>
          action.kind === "PASS"
        );
        const loan = options.playerActions.find((action) =>
          action.kind === "LOAN"
        );
        const developAction = options.playerActions.find((action) =>
          action.kind === "DEVELOP"
        );
        const selectedCardCandidate = state.progress.phase === "action"
          ? selectedHotseatCardId(privateView.draft)
          : null;
        const selectedCardId = selectedCardCandidate !== null &&
            privateView.hand.includes(selectedCardCandidate)
          ? selectedCardCandidate
          : null;
        const scoutCardIds = normalizeHotseatScoutSelection(
          selectedHotseatScoutCardIds(privateView.draft),
          options.scout.selectableRegularCardIds,
        );
        const networkLinks: HotseatPrototypeNetworkLink[] =
          options.network.canalLinks.map((link) => ({
            linkId: link.linkId,
            endpointLabel: link.adjacentLocations
              .map((location) => location.label)
              .join(" ↔ "),
            cost: link.totalCost,
            selection: link.selection,
          }));
        const selectedNetworkLinkId = normalizeHotseatNetworkLinkId(
          selectedHotseatNetworkLinkId(privateView.draft),
          networkLinks.map((link) => link.linkId),
        );
        const selectedNetworkCardIsLegal = selectedCardId !== null &&
          options.network.selectableCardIds.includes(selectedCardId);
        const buildOptions = getGameV2BuildLegalOptions(
          state,
          privateView.seat,
          selectedCardId,
        );
        const buildPlans: HotseatPrototypeBuildPlan[] =
          buildOptions.targets.flatMap((target) => {
            const presentation = industryPresentation(target.industry);
            return target.resourcePlans.map((plan) => ({
              id: hotseatBuildPlanId(plan.selection),
              buildSpaceId: target.buildSpaceId,
              buildSpaceLabel: hotseatBuildSpaceLabel(target.buildSpaceId),
              locationLabel: target.locationLabel,
              industry: target.industry,
              industryLabel: presentation.label,
              industryEmoji: presentation.emoji,
              tileId: target.tile.id,
              tileLevel: target.tile.level,
              sourceSummary: hotseatBuildSourceSummary(plan.sources),
              totalCost: plan.totalCost,
              moneyChange: plan.moneyChange,
              selection: plan.selection,
            }));
          });
        const selectedBuildPlanId = normalizeHotseatBuildPlanId(
          selectedHotseatBuildPlanId(privateView.draft),
          buildPlans.map((plan) => plan.id),
        );
        const developOptions = getGameV2DevelopLegalOptions(
          state,
          privateView.seat,
          selectedCardId,
        );
        const developPlans: HotseatPrototypeDevelopPlan[] =
          developOptions.plans.map((plan) => ({
            id: hotseatDevelopPlanId(plan.selection),
            tiles: plan.tiles.map((tile) => {
              const presentation = industryPresentation(tile.industry);
              return {
                id: tile.id,
                industryLabel: presentation.label,
                industryEmoji: presentation.emoji,
                level: tile.level,
              };
            }),
            ironSummary: hotseatDevelopIronSummary(
              plan.iron.boardSources,
              plan.iron.market,
            ),
            boardIronSources: plan.iron.boardSources.map((source) => ({
              locationLabel: source.locationLabel,
              owner: source.owner,
              unitsConsumed: source.unitsConsumed,
              cubesRemaining: source.cubesRemaining,
            })),
            marketIronUnits: plan.iron.market.unitsPurchased,
            marketIronCost: plan.iron.market.totalCost,
            totalCost: plan.moneySpent,
            selection: plan.selection,
          }));
        const selectedDevelopPlanId = normalizeHotseatDevelopPlanId(
          selectedHotseatDevelopPlanId(privateView.draft),
          developPlans.map((plan) => plan.id),
        );
        const merchantOptions = options.merchantFreeDevelop;
        const merchantSelections: HotseatPrototypeMerchantFreeDevelopSelection[] =
          merchantOptions.legalTileIdSelections.map((tileIds) => ({
            id: hotseatMerchantFreeDevelopSelectionId(tileIds),
            tileIds: [...tileIds],
            tiles: tileIds.map((tileId) => {
              const tile = INDUSTRY_TILE_BY_ID[tileId];
              const presentation = industryPresentation(tile.industry);
              return {
                id: tileId,
                industryLabel: presentation.label,
                industryEmoji: presentation.emoji,
                level: tile.level,
              };
            }),
            skippedCount: merchantOptions.bonusCount - tileIds.length,
          }));
        const selectedMerchantSelectionId =
          normalizeHotseatMerchantFreeDevelopSelectionId(
            selectedHotseatMerchantFreeDevelopSelectionId(privateView.draft),
            merchantSelections.map((selection) => selection.id),
          );

        return {
          mode: state.progress.phase === "merchant_free_develop"
            ? "merchant_free_develop" as const
            : "action" as const,
          seat: privateView.seat,
          cards: privateView.hand.map((id) => ({
            id,
            label: hotseatCardLabel(id),
            canPass: options.passCardIds.includes(id),
            canLoan: options.loanCardIds.includes(id),
            canScout: options.scout.reason === null &&
              options.scout.selectableRegularCardIds.includes(id),
            canNetwork: options.network.selectableCardIds.includes(id),
            canDevelop: developAction !== undefined &&
              developAction.availability !== "disabled",
          })),
          selectedCardId,
          selectedScoutCardIds: scoutCardIds,
          selectedNetworkLinkId,
          selectedBuildPlanId,
          selectedDevelopPlanId,
          merchantFreeDevelop: state.progress.phase === "merchant_free_develop"
            ? {
                availability: merchantOptions.availability,
                requiredCount: merchantOptions.bonusCount,
                selections: merchantSelections,
                selectedSelectionId: selectedMerchantSelectionId,
                selectionIsLegal: merchantOptions.availability === "exact" &&
                  selectedMerchantSelectionId !== null,
                reason: merchantOptions.reason,
              }
            : null,
          legal: {
            pass: {
              selectedIsLegal: selectedCardId !== null &&
                options.passCardIds.includes(selectedCardId),
              reason: pass?.reason ?? null,
            },
            loan: {
              selectedIsLegal: selectedCardId !== null &&
                options.loanCardIds.includes(selectedCardId),
              reason: loan?.reason ?? null,
            },
            scout: {
              selectionIsLegal: legalHotseatScoutTriple(
                scoutCardIds,
                options.scout.cardTriples,
              ) !== null,
              reason: options.scout.reason,
            },
            network: {
              availability: options.network.availability,
              selectedCardIsLegal: selectedNetworkCardIsLegal,
              selectionIsLegal: options.network.availability === "exact" &&
                selectedNetworkCardIsLegal &&
                selectedNetworkLinkId !== null,
              links: networkLinks,
              reason: options.network.reason,
            },
            build: {
              availability: buildOptions.availability,
              selectionIsLegal: buildOptions.availability === "exact" &&
                selectedBuildPlanId !== null,
              plans: buildPlans,
              reason: buildOptions.reason,
            },
            develop: {
              availability: developOptions.availability,
              selectionIsLegal: developOptions.availability === "exact" &&
                selectedDevelopPlanId !== null,
              plans: developPlans,
              reason: developOptions.reason,
            },
          },
        };
      })();

  const placedIndustries: HotseatPrototypePlacedIndustry[] =
    view.public.board.placedIndustries.map((placement) => {
      const tile = INDUSTRY_TILE_BY_ID[
        placement.tileId as keyof typeof INDUSTRY_TILE_BY_ID
      ];
      const presentation = industryPresentation(tile?.industry ?? "industry");
      const location = BOARD_V2.locations[
        placement.locationId as keyof typeof BOARD_V2.locations
      ];
      return {
        buildSpaceId: placement.spaceId,
        locationLabel: location?.label ?? placement.locationId,
        owner: placement.owner,
        industryLabel: presentation.label,
        industryEmoji: presentation.emoji,
        tileId: placement.tileId,
        tileLevel: tile?.level ?? 0,
        resourceSummary: hotseatPlacedResourceSummary(placement.resources),
        flipped: placement.flipped,
      };
    });
  const playerIndustryInventories: HotseatPrototypePlayerInventory[] =
    view.public.players.map((player) => ({
      seat: player.seat,
      industries: player.industry.map((stack) => {
        const tile = stack.nextTileId === null
          ? undefined
          : INDUSTRY_TILE_BY_ID[
              stack.nextTileId as keyof typeof INDUSTRY_TILE_BY_ID
            ];
        const presentation = industryPresentation(stack.kind);
        return {
          kind: stack.kind,
          industryLabel: presentation.label,
          industryEmoji: presentation.emoji,
          remaining: stack.remaining,
          nextTileLevel: tile?.level ?? null,
        };
      }),
    }));

  return {
    public: view.public,
    handoff: isPrivatePlayerPhase &&
        view.visibility.kind === "handoff" &&
        view.visibility.nextSeat !== null
      ? { nextSeat: view.visibility.nextSeat }
      : null,
    private: privateModel,
    placedIndustries,
    playerIndustryInventories,
    boundary: boundaryFor(view.public),
    feedback,
  };
}

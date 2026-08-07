import type {
  NetworkActionSelection,
  NetworkCoalChoice,
} from "@/engine/actions-v2/network";
import type { PlayableCardId } from "@/engine/cards-v2/types";
import type { GameV2PlayerCommand } from "@/engine/game-v2/commands";
import {
  getGameV2RailNetworkLegalOptions,
  type GameV2RailNetworkDisabledReason,
  type GameV2RailNetworkPlan,
} from "@/engine/game-v2/rail-network-legal";
import type { GameStateV2 } from "@/engine/game-v2/state";
import type { HotseatDraft } from "@/ui/hotseat-session";

export type HotseatRailNetworkCommand = Extract<
  GameV2PlayerCommand,
  { readonly type: "NETWORK" }
>;

export type HotseatRailNetworkSavedPrefixStatus =
  | "empty"
  | "accepted"
  | "stale_card"
  | "malformed"
  | "rejected";

export type HotseatRailNetworkLocalDisabledReason = {
  readonly code: "MALFORMED_SAVED_PREFIX" | "UNSAFE_RAIL_NETWORK_PLAN";
  readonly message: string;
};

export type HotseatRailNetworkDisabledReason =
  | GameV2RailNetworkDisabledReason
  | HotseatRailNetworkLocalDisabledReason;

export type HotseatRailNetworkPlanModel = {
  /** Stable structural ID independent of display ordering. */
  readonly id: string;
  /** Exact authoritative selection; retained only in the revealed private model. */
  readonly selection: HotseatRailNetworkCommand["selection"];
  readonly linkCount: 1 | 2;
  readonly links: readonly {
    readonly linkId: string;
    readonly order: number;
    readonly endpointLabel: string;
  }[];
  readonly coalSources: readonly (
    | {
        readonly kind: "mine";
        readonly linkId: string;
        readonly industryId: string;
        readonly owner: string;
        readonly locationLabel: string;
        readonly cubesRemaining: number;
        readonly depleted: boolean;
        readonly summary: string;
      }
    | {
        readonly kind: "market";
        readonly linkId: string;
        readonly unitPrice: number;
        readonly summary: string;
      }
  )[];
  readonly beerSource: {
    readonly industryId: string;
    readonly owner: string;
    readonly locationLabel: string;
    readonly barrelsRemaining: number;
    readonly depleted: boolean;
    readonly summary: string;
  } | null;
  readonly flippedIndustryIds: readonly string[];
  readonly incomeAwards: readonly {
    readonly buildSpaceId: string;
    readonly tileId: string;
    readonly owner: string;
    readonly printedSpaces: number;
    readonly fromMarkerSpace: number;
    readonly toMarkerSpace: number;
    readonly spacesAdvanced: number;
  }[];
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
  readonly outcomeSummary: string;
};

export type HotseatRailNetworkModel = {
  readonly availability: "exact" | "disabled";
  readonly actorSeat: string | null;
  readonly cardId: PlayableCardId | null;
  /** Explains how an opaque persisted prefix was treated without echoing it. */
  readonly savedPrefixStatus: HotseatRailNetworkSavedPrefixStatus;
  readonly selectedPrefix: NetworkActionSelection | null;
  /** The accepted one-link plan after choosing "add another link". */
  readonly currentPlan: HotseatRailNetworkPlanModel | null;
  /** Initial one-link plans, or exact ordered two-link continuations. */
  readonly nextPlans: readonly HotseatRailNetworkPlanModel[];
  readonly selectedNextPlanId: string | null;
  readonly selectedNextIsLegal: boolean;
  /** Selected next plan wins; otherwise the accepted one-link plan submits. */
  readonly submissionPlan: HotseatRailNetworkPlanModel | null;
  readonly reason: HotseatRailNetworkDisabledReason | null;
};

type SavedPrefixRead =
  | {
      readonly status: "empty" | "stale_card";
      readonly selection: null;
    }
  | {
      readonly status: "malformed";
      readonly selection: null;
    }
  | {
      readonly status: "accepted";
      readonly selection: NetworkActionSelection;
    };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCoalChoice(value: unknown): NetworkCoalChoice | null {
  if (!isRecord(value)) return null;
  if (value.kind === "market") return { kind: "market" };
  return value.kind === "mine" &&
      typeof value.industryId === "string" &&
      value.industryId.length > 0
    ? { kind: "mine", industryId: value.industryId }
    : null;
}

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

/**
 * Reads only the bounded one-link prefix shape this controller writes.
 * Arbitrary persisted values are never asserted into a domain selection.
 */
function readSavedPrefix(
  draft: HotseatDraft | null,
  selectedCardId: PlayableCardId | null,
): SavedPrefixRead {
  const value = draft?.fields.railNetworkPrefix;
  if (value === undefined) return { status: "empty", selection: null };
  if (!isRecord(value)) return { status: "malformed", selection: null };

  if (value.cardId !== selectedCardId) {
    return { status: "stale_card", selection: null };
  }
  if (selectedCardId === null) {
    return { status: "stale_card", selection: null };
  }
  if (
    !Array.isArray(value.linkIds) ||
    value.linkIds.length !== 1 ||
    typeof value.linkIds[0] !== "string" ||
    value.linkIds[0].length === 0 ||
    !Array.isArray(value.coalSources) ||
    value.coalSources.length !== 1 ||
    value.beerSourceId !== null
  ) {
    return { status: "malformed", selection: null };
  }
  const coalChoice = readCoalChoice(value.coalSources[0]);
  if (coalChoice === null) {
    return { status: "malformed", selection: null };
  }
  return {
    status: "accepted",
    selection: {
      linkIds: [value.linkIds[0]],
      coalSources: [coalChoice],
      beerSourceId: null,
      cardId: selectedCardId,
    },
  };
}

export function selectedHotseatRailNetworkNextPlanId(
  draft: HotseatDraft | null,
): string | null {
  const value = draft?.fields.railNetworkNextPlanId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function hotseatRailNetworkPlanId(
  selection: NetworkActionSelection,
): string {
  return JSON.stringify({
    cardId: selection.cardId,
    linkIds: [...selection.linkIds],
    coalSources: selection.coalSources.map(cloneCoalChoice),
    beerSourceId: selection.beerSourceId,
  });
}

function projectPlan(plan: GameV2RailNetworkPlan): HotseatRailNetworkPlanModel {
  const coalSources = plan.coalSources.map((source) =>
    source.kind === "market"
      ? {
          kind: "market" as const,
          linkId: source.linkId,
          unitPrice: source.unitPrice,
          summary: `Market coal £${source.unitPrice}`,
        }
      : {
          kind: "mine" as const,
          linkId: source.linkId,
          industryId: source.industryId,
          owner: source.owner,
          locationLabel: source.locationLabel,
          cubesRemaining: source.coalRemaining,
          depleted: source.depleted,
          summary: `${source.owner}'s ${source.locationLabel} Coal Mine (${source.coalRemaining} remaining)`,
        }
  );
  const beerSource = plan.beerSource === null
    ? null
    : {
        industryId: plan.beerSource.industryId,
        owner: plan.beerSource.owner,
        locationLabel: plan.beerSource.locationLabel,
        barrelsRemaining: plan.beerSource.beerRemaining,
        depleted: plan.beerSource.depleted,
        summary: `Own ${plan.beerSource.locationLabel} Brewery (${plan.beerSource.beerRemaining} remaining)`,
      };
  return {
    id: hotseatRailNetworkPlanId(plan.selection),
    selection: cloneSelection(plan.selection),
    linkCount: plan.linkCount,
    links: plan.links.map((link) => ({
      linkId: link.linkId,
      order: link.order,
      endpointLabel: link.endpoints.map((endpoint) => endpoint.locationLabel)
        .join(" ↔ "),
    })),
    coalSources,
    beerSource,
    flippedIndustryIds: [...plan.flippedIndustryIds],
    incomeAwards: plan.incomeAwards.map((award) => ({ ...award })),
    costs: { ...plan.costs },
    playerResult: { ...plan.playerResult },
    marketResult: { ...plan.marketResult },
    outcomeSummary: [
      `£${plan.costs.total}`,
      `${plan.playerResult.linkTokensUsed} link token${plan.playerResult.linkTokensUsed === 1 ? "" : "s"}`,
      `${plan.marketResult.coalPurchased} market coal`,
    ].join(" · "),
  };
}

function malformedModel(
  actorSeat: string | null,
  selectedCardId: PlayableCardId | null,
): HotseatRailNetworkModel {
  return {
    availability: "disabled",
    actorSeat,
    cardId: selectedCardId,
    savedPrefixStatus: "malformed",
    selectedPrefix: null,
    currentPlan: null,
    nextPlans: [],
    selectedNextPlanId: null,
    selectedNextIsLegal: false,
    submissionPlan: null,
    reason: {
      code: "MALFORMED_SAVED_PREFIX",
      message: "The saved Rail Network draft is malformed; clear it and restart.",
    },
  };
}

/**
 * Produces a private, presentation-only Rail Network model. It deliberately
 * contains no hand other than the selected action card, no draw order, and no
 * authoritative state reference.
 */
export function toHotseatRailNetworkModel(
  state: GameStateV2,
  actorSeat: string | null,
  selectedCardId: PlayableCardId | null,
  draft: HotseatDraft | null,
): HotseatRailNetworkModel {
  const saved = readSavedPrefix(draft, selectedCardId);
  if (saved.status === "malformed") {
    return malformedModel(actorSeat, selectedCardId);
  }
  const legal = getGameV2RailNetworkLegalOptions(
    state,
    actorSeat,
    selectedCardId,
    saved.selection,
  );
  const savedPrefixStatus = saved.status === "accepted" &&
      legal.reason?.code === "INVALID_NETWORK_PREFIX"
    ? "rejected" as const
    : saved.status;
  const unsafeBeer = [legal.currentPlan, ...legal.nextPlans].find(
    (plan) =>
      plan !== null &&
      plan.beerSource !== null &&
      plan.beerSource.owner !== actorSeat,
  );
  if (unsafeBeer !== undefined) {
    return {
      availability: "disabled",
      actorSeat,
      cardId: selectedCardId,
      savedPrefixStatus,
      selectedPrefix: null,
      currentPlan: null,
      nextPlans: [],
      selectedNextPlanId: null,
      selectedNextIsLegal: false,
      submissionPlan: null,
      reason: {
        code: "UNSAFE_RAIL_NETWORK_PLAN",
        message: "An exact Rail plan attempted to use another player's beer.",
      },
    };
  }

  const currentPlan = legal.currentPlan === null
    ? null
    : projectPlan(legal.currentPlan);
  const nextPlans = legal.nextPlans.map(projectPlan);
  const selectedCandidate = selectedHotseatRailNetworkNextPlanId(draft);
  const selectedNextPlan = nextPlans.find(
    (plan) => plan.id === selectedCandidate,
  ) ?? null;
  return {
    availability: legal.availability,
    actorSeat: legal.actorSeat,
    cardId: legal.cardId,
    savedPrefixStatus,
    selectedPrefix: legal.selectedPrefix === null
      ? null
      : cloneSelection(legal.selectedPrefix),
    currentPlan,
    nextPlans,
    selectedNextPlanId: selectedNextPlan?.id ?? null,
    selectedNextIsLegal: selectedNextPlan !== null,
    submissionPlan: selectedNextPlan ?? currentPlan,
    reason: legal.reason,
  };
}

export function selectHotseatRailNetworkNextPlan(
  draft: HotseatDraft | null,
  planId: string,
  legalPlanIds: readonly string[],
): HotseatDraft {
  const fields: Record<string, unknown> = { ...draft?.fields };
  if (legalPlanIds.includes(planId)) {
    fields.railNetworkNextPlanId = planId;
  } else {
    delete fields.railNetworkNextPlanId;
  }
  return { commandType: "NETWORK", fields };
}

export function clearHotseatRailNetworkDraft(
  draft: HotseatDraft | null,
): HotseatDraft | null {
  if (draft === null) return null;
  const fields: Record<string, unknown> = { ...draft.fields };
  delete fields.railNetworkPrefix;
  delete fields.railNetworkNextPlanId;
  return { ...draft, fields };
}

/** Clears stale or malformed persistence and drops a no-longer-legal choice. */
export function normalizeHotseatRailNetworkDraft(
  draft: HotseatDraft | null,
  model: HotseatRailNetworkModel,
): HotseatDraft | null {
  if (draft === null) return null;
  if (
    model.savedPrefixStatus === "stale_card" ||
    model.savedPrefixStatus === "malformed" ||
    model.savedPrefixStatus === "rejected"
  ) {
    return clearHotseatRailNetworkDraft(draft);
  }
  const fields: Record<string, unknown> = { ...draft.fields };
  if (model.selectedPrefix === null) {
    delete fields.railNetworkPrefix;
  } else {
    fields.railNetworkPrefix = cloneSelection(model.selectedPrefix);
  }
  if (model.selectedNextPlanId === null) {
    delete fields.railNetworkNextPlanId;
  } else {
    fields.railNetworkNextPlanId = model.selectedNextPlanId;
  }
  return { ...draft, fields };
}

/**
 * Promotes a selected legal one-link candidate to the extension prefix. A
 * selected two-link candidate is already complete and is never persisted as a
 * prefix the engine would reject.
 */
export function appendSelectedHotseatRailNetworkPlan(
  draft: HotseatDraft | null,
  model: HotseatRailNetworkModel,
): HotseatDraft | null {
  const selected = model.nextPlans.find(
    (plan) => plan.id === model.selectedNextPlanId,
  );
  if (
    selected === undefined ||
    !model.selectedNextIsLegal ||
    selected.linkCount !== 1
  ) return draft;
  const fields: Record<string, unknown> = {
    ...draft?.fields,
    railNetworkPrefix: cloneSelection(selected.selection),
  };
  delete fields.railNetworkNextPlanId;
  return { commandType: "NETWORK", fields };
}

export function selectedHotseatRailNetworkCommand(
  model: HotseatRailNetworkModel,
): HotseatRailNetworkCommand | null {
  return model.availability === "exact" && model.submissionPlan !== null
    ? { type: "NETWORK", selection: cloneSelection(model.submissionPlan.selection) }
    : null;
}

import type { PlayableCardId } from "@/engine/cards-v2/types";
import type {
  GameV2CommandOutcome,
  GameV2PlayerCommand,
} from "@/engine/game-v2/commands";
import {
  getGameV2LegalOptions,
  type GameV2LegalityDisabledReason,
} from "@/engine/game-v2/legal";
import type { GameStateV2 } from "@/engine/game-v2/state";
import { incomeLevelAt } from "@/engine/economy/income";
import type { LiquidationChoicesV2 } from "@/engine/game-v2/turn-lifecycle";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
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

export type HotseatPrototypeNetworkLink = {
  readonly linkId: string;
  readonly endpointLabel: string;
  readonly cost: number;
  readonly selection: Omit<HotseatNetworkCommand["selection"], "cardId">;
};

export type HotseatPrototypePrivateModel = {
  readonly seat: string;
  readonly cards: readonly {
    readonly id: PlayableCardId;
    readonly label: string;
    readonly canPass: boolean;
    readonly canLoan: boolean;
    readonly canScout: boolean;
    readonly canNetwork: boolean;
  }[];
  readonly selectedCardId: PlayableCardId | null;
  readonly selectedScoutCardIds: readonly PlayableCardId[];
  readonly selectedNetworkLinkId: string | null;
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

  const privateView = view.public.progress.phase === "action" &&
      view.private !== null &&
      view.public.identity.gameId === state.gameId &&
      view.public.identity.revision === state.revision &&
      view.private.seat === state.currentSeat
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
        const selectedCardCandidate = selectedHotseatCardId(privateView.draft);
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

        return {
          seat: privateView.seat,
          cards: privateView.hand.map((id) => ({
            id,
            label: hotseatCardLabel(id),
            canPass: options.passCardIds.includes(id),
            canLoan: options.loanCardIds.includes(id),
            canScout: options.scout.reason === null &&
              options.scout.selectableRegularCardIds.includes(id),
            canNetwork: options.network.selectableCardIds.includes(id),
          })),
          selectedCardId,
          selectedScoutCardIds: scoutCardIds,
          selectedNetworkLinkId,
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
          },
        };
      })();

  return {
    public: view.public,
    handoff: view.public.progress.phase === "action" &&
        view.visibility.kind === "handoff" &&
        view.visibility.nextSeat !== null
      ? { nextSeat: view.visibility.nextSeat }
      : null,
    private: privateModel,
    boundary: boundaryFor(view.public),
    feedback,
  };
}

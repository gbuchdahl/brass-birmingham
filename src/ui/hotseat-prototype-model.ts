import type { PlayableCardId } from "@/engine/cards-v2/types";
import type {
  GameV2CommandOutcome,
  GameV2PlayerCommand,
} from "@/engine/game-v2/commands";
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
  readonly private: {
    readonly seat: string;
    readonly cards: readonly {
      readonly id: PlayableCardId;
      readonly label: string;
    }[];
    readonly selectedCardId: PlayableCardId | null;
  } | null;
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

export function selectedHotseatCardId(
  draft: HotseatDraft | null,
): PlayableCardId | null {
  const cardId = draft?.fields.cardId;
  return typeof cardId === "string" && cardId.length > 0
    ? cardId as PlayableCardId
    : null;
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

  return {
    public: view.public,
    handoff: view.public.progress.phase === "action" &&
        view.visibility.kind === "handoff" &&
        view.visibility.nextSeat !== null
      ? { nextSeat: view.visibility.nextSeat }
      : null,
    private: view.public.progress.phase !== "action" || view.private === null
      ? null
      : {
          seat: view.private.seat,
          cards: view.private.hand.map((id) => ({
            id,
            label: hotseatCardLabel(id),
          })),
          selectedCardId: selectedHotseatCardId(view.private.draft),
        },
    boundary: boundaryFor(view.public),
    feedback,
  };
}

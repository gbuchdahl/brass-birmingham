import { getGameV2BuildLegalOptions } from "../../src/engine/game-v2/build-legal";
import type { PlayableCardId } from "../../src/engine/cards-v2/types";
import type { GameV2Command } from "../../src/engine/game-v2/commands";
import { getGameV2LegalOptions } from "../../src/engine/game-v2/legal";
import { getGameV2SellLegalOptions } from "../../src/engine/game-v2/sell-legal";
import { createGameV2 } from "../../src/engine/game-v2/state";
import { serializeHotseatSession } from "../../src/ui/hotseat-persistence";
import {
  createHotseatSession,
  submitHotseatCommand,
  type HotseatSession,
} from "../../src/ui/hotseat-session";

export const MERCHANT_PENDING_SEED = "game-v2-dev-alpha";
export const MERCHANT_PENDING_REVISION = 7;

function submitAccepted(
  session: HotseatSession,
  command: GameV2Command,
): HotseatSession {
  const acceptedCount = session.acceptedCommands.length;
  const next = submitHotseatCommand(session, command);
  if (next.acceptedCommands.length !== acceptedCount + 1) {
    const detail = next.lastResult?.ok === false
      ? `${next.lastResult.error.source}:${next.lastResult.error.code} ${next.lastResult.error.message}`
      : "command did not append to accepted history";
    throw new Error(`Merchant browser fixture rejected ${command.type}: ${detail}`);
  }
  return next;
}

function requireCard(
  session: HotseatSession,
  seat: string,
  cardId: PlayableCardId,
): void {
  if (!session.state.cards.hands[seat]?.includes(cardId)) {
    throw new Error(`Merchant browser fixture expected ${seat} to hold ${cardId}`);
  }
}

/**
 * Builds a real Gloucester free-Develop save exclusively through reducer-ready
 * commands and the production hot-seat serializer. No authoritative state is
 * patched or bypassed.
 */
export function createMerchantFreeDevelopSave(): string {
  let session = createHotseatSession(
    createGameV2(["Player 1", "Player 2"], MERCHANT_PENDING_SEED),
  );

  const buildCard = "location-worcester-02";
  requireCard(session, "Player 1", buildCard);
  const buildTarget = getGameV2BuildLegalOptions(
    session.state,
    "Player 1",
    buildCard,
  ).targets.find((target) =>
    target.buildSpaceId === "worcester_1" && target.industry === "cotton"
  );
  const buildPlan = buildTarget?.resourcePlans[0];
  if (buildPlan === undefined) {
    throw new Error("Merchant browser fixture expected the Worcester Cotton build");
  }
  session = submitAccepted(session, {
    type: "BUILD",
    selection: buildPlan.selection,
  });

  const playerTwoFirstPass = "location-redditch-01";
  requireCard(session, "Player 2", playerTwoFirstPass);
  session = submitAccepted(session, {
    type: "PASS",
    cardId: playerTwoFirstPass,
  });
  session = submitAccepted(session, {
    type: "SETTLE_ROUND",
    liquidationChoices: {},
  });

  for (const cardId of [
    "industry-brewery-02",
    "location-wolverhampton-01",
  ] as const) {
    requireCard(session, "Player 2", cardId);
    session = submitAccepted(session, { type: "PASS", cardId });
  }

  const networkCard = "location-cannock-02";
  requireCard(session, "Player 1", networkCard);
  const canalLink = getGameV2LegalOptions(session.state, "Player 1")
    .network.canalLinks.find((option) =>
      option.linkId === "link_gloucester_worcester"
    );
  if (canalLink === undefined) {
    throw new Error("Merchant browser fixture expected Gloucester–Worcester Canal");
  }
  session = submitAccepted(session, {
    type: "NETWORK",
    selection: { ...canalLink.selection, cardId: networkCard },
  });

  const sellCard = "industry-brewery-03";
  requireCard(session, "Player 1", sellCard);
  const gloucesterSale = getGameV2SellLegalOptions(
    session.state,
    "Player 1",
    sellCard,
  ).nextSales.find((option) =>
    option.industry.industryId === "worcester_1" &&
    option.merchant.merchantSpaceId === "merchant_gloucester_2" &&
    option.beer.kind === "merchant" &&
    option.plan.pendingFollowUp?.kind === "free_develop"
  );
  if (gloucesterSale === undefined) {
    throw new Error("Merchant browser fixture expected a Gloucester free-Develop Sell");
  }
  session = submitAccepted(session, {
    type: "SELL",
    selection: gloucesterSale.plan.selection,
  });

  if (
    session.state.revision !== MERCHANT_PENDING_REVISION ||
    session.state.progress.phase !== "merchant_free_develop" ||
    session.state.progress.pending.seat !== "Player 1"
  ) {
    throw new Error("Merchant browser fixture did not reach the expected pending phase");
  }
  return serializeHotseatSession(session);
}

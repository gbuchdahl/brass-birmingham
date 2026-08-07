import type { PlayableCardId } from "../../src/engine/cards-v2/types";
import type { GameV2Command } from "../../src/engine/game-v2/commands";
import { getGameV2BuildLegalOptions } from "../../src/engine/game-v2/build-legal";
import { getGameV2LiquidationLegalOptions } from "../../src/engine/game-v2/liquidation-legal";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "../../src/engine/game-v2/state";
import type { LiquidationChoicesV2 } from "../../src/engine/game-v2/turn-lifecycle";
import { DEFAULT_HOTSEAT_STORAGE_KEY } from "../../src/ui/browser-hotseat-storage";
import { serializeHotseatSession } from "../../src/ui/hotseat-persistence";
import {
  createHotseatSession,
  revealHotseatHand,
  submitHotseatCommand,
  type HotseatSession,
} from "../../src/ui/hotseat-session";
import {
  toHotseatRailNetworkModel,
  type HotseatRailNetworkPlanModel,
} from "../../src/ui/hotseat-rail-network-model";

const PLAYER_ONE = "Player 1";
const PLAYER_TWO = "Player 2";

export type RailTwoLinkBrowserFixture = {
  readonly storageKey: string;
  readonly serializedSession: string;
  readonly actorSeat: string;
  readonly nextSeat: string;
  readonly cardId: PlayableCardId;
  readonly baseline: {
    readonly revision: number;
    readonly round: number;
    readonly money: number;
    readonly linkTokens: number;
    readonly marketCoal: number;
    readonly builtLinks: number;
    readonly brewerySpaceId: string;
    readonly breweryBeer: number;
  };
  readonly firstPlan: {
    readonly id: string;
    readonly endpointLabel: string;
    readonly coalSummary: string;
  };
  readonly secondPlan: {
    readonly id: string;
    readonly endpointLabels: readonly string[];
    readonly coalSummaries: readonly string[];
    readonly beerSummary: string;
    readonly totalCost: number;
  };
  readonly expected: {
    readonly revision: number;
    readonly money: number;
    readonly linkTokens: number;
    readonly marketCoal: number;
    readonly builtLinks: number;
    readonly breweryBeer: number;
  };
};

function requireValid(state: GameStateV2, checkpoint: string): void {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(
      `${checkpoint}: ${validation.errors.map((error) =>
        `${error.path}: ${error.message}`
      ).join("; ")}`,
    );
  }
}

function submitAccepted(
  session: HotseatSession,
  command: GameV2Command,
  checkpoint: string,
): HotseatSession {
  const playerCommand = command.type !== "SETTLE_ROUND" &&
    command.type !== "RESOLVE_ERA";
  const prepared = playerCommand && session.visibility.kind !== "revealed"
    ? revealHotseatHand(session)
    : session;
  const submitted = submitHotseatCommand(prepared, command);
  if (submitted.lastResult?.ok !== true) {
    const detail = submitted.lastResult === null
      ? "no command result"
      : `${submitted.lastResult.error.source}:${submitted.lastResult.error.code} ${submitted.lastResult.error.message}`;
    throw new Error(`${checkpoint}: ${detail}`);
  }
  requireValid(submitted.state, checkpoint);
  return submitted;
}

function firstCard(state: GameStateV2): PlayableCardId {
  const cardId = state.cards.hands[state.currentSeat][0];
  if (cardId === undefined) {
    throw new Error(`${state.currentSeat} has no action card.`);
  }
  return cardId;
}

function pass(session: HotseatSession, checkpoint: string): HotseatSession {
  return submitAccepted(
    session,
    { type: "PASS", cardId: firstCard(session.state) },
    checkpoint,
  );
}

function exactSettlementChoices(state: GameStateV2): LiquidationChoicesV2 {
  let partial: LiquidationChoicesV2 = {};
  for (let step = 0; step < 16; step += 1) {
    const options = getGameV2LiquidationLegalOptions(state, partial);
    if (options.availability !== "exact") {
      throw new Error(
        `Settlement fixture rejected: ${options.reason?.code} ${options.reason?.message}`,
      );
    }
    if (options.ready && options.liquidationChoices !== null) {
      return options.liquidationChoices;
    }
    const pending = options.seats.find((seat) => !seat.ready);
    if (pending === undefined) {
      throw new Error("Settlement fixture has no appendable incomplete seat.");
    }
    if (
      pending.coverage === "covered_by_cash" ||
      pending.coverage === "assets_exhausted"
    ) {
      partial = { ...partial, [pending.seat]: [] };
      continue;
    }
    const next = pending.nextChoices[0];
    if (next === undefined) {
      throw new Error(`Settlement fixture cannot cover ${pending.seat}.`);
    }
    partial = { ...partial, [pending.seat]: next.choicesAfterAppend };
  }
  throw new Error("Settlement fixture exceeded its bounded choice walk.");
}

function settle(session: HotseatSession, checkpoint: string): HotseatSession {
  return submitAccepted(
    session,
    {
      type: "SETTLE_ROUND",
      liquidationChoices: exactSettlementChoices(session.state),
    },
    checkpoint,
  );
}

function finishCurrentRound(
  session: HotseatSession,
  checkpoint: string,
): HotseatSession {
  const startingEra = session.state.era;
  const startingRound = session.state.round;
  for (let step = 0; step < 32; step += 1) {
    if (
      session.state.era !== startingEra ||
      session.state.round !== startingRound ||
      session.state.progress.phase === "era_transition"
    ) return session;
    if (session.state.progress.phase === "action") {
      session = pass(session, `${checkpoint} pass ${step + 1}`);
      continue;
    }
    if (session.state.progress.phase === "round_settlement") {
      session = settle(session, `${checkpoint} settlement`);
      continue;
    }
    throw new Error(
      `${checkpoint}: unexpected phase ${session.state.progress.phase}.`,
    );
  }
  throw new Error(`${checkpoint}: round did not complete.`);
}

function advanceToSeat(
  session: HotseatSession,
  seat: string,
  checkpoint: string,
): HotseatSession {
  for (let step = 0; step < 16; step += 1) {
    if (
      session.state.progress.phase === "action" &&
      session.state.currentSeat === seat
    ) return session;
    if (session.state.progress.phase === "action") {
      session = pass(session, `${checkpoint} pass ${step + 1}`);
      continue;
    }
    if (session.state.progress.phase === "round_settlement") {
      session = settle(session, `${checkpoint} settlement`);
      continue;
    }
    throw new Error(
      `${checkpoint}: cannot advance through ${session.state.progress.phase}.`,
    );
  }
  throw new Error(`${checkpoint}: ${seat} did not become active.`);
}

function takeLoan(session: HotseatSession, checkpoint: string): HotseatSession {
  return submitAccepted(
    session,
    { type: "LOAN", cardId: firstCard(session.state) },
    checkpoint,
  );
}

function buildLevelTwoBrewery(
  session: HotseatSession,
  checkpoint: string,
): {
  readonly session: HotseatSession;
  readonly buildSpaceId: string;
  readonly cardId: PlayableCardId;
  readonly first: HotseatRailNetworkPlanModel;
  readonly second: HotseatRailNetworkPlanModel;
} {
  const seat = session.state.currentSeat;
  for (const cardId of session.state.cards.hands[seat]) {
    const options = getGameV2BuildLegalOptions(
      session.state,
      seat,
      cardId,
    );
    for (const target of options.targets) {
      if (target.industry !== "brewery" || target.tile.level !== 2) continue;
      for (const plan of target.resourcePlans) {
        const builtSession = submitAccepted(
          session,
          { type: "BUILD", selection: plan.selection },
          checkpoint,
        );
        if (
          builtSession.state.progress.phase !== "action" ||
          builtSession.state.currentSeat !== PLAYER_ONE ||
          builtSession.state.actionsUsed !== 1
        ) continue;
        for (const networkCardId of builtSession.state.cards.hands[seat]) {
          const progressive = findProgressiveRailPlans(
            builtSession,
            networkCardId,
          );
          if (progressive === null) continue;
          return {
            session: builtSession,
            buildSpaceId: target.buildSpaceId,
            cardId: networkCardId,
            ...progressive,
          };
        }
      }
    }
  }
  throw new Error(
    `${checkpoint}: no level-2 Brewery Build supports a progressive Rail action.`,
  );
}

function findProgressiveRailPlans(
  session: HotseatSession,
  cardId: PlayableCardId,
): {
  readonly first: HotseatRailNetworkPlanModel;
  readonly second: HotseatRailNetworkPlanModel;
} | null {
  const initial = toHotseatRailNetworkModel(
    session.state,
    PLAYER_ONE,
    cardId,
    { commandType: "NETWORK", fields: { cardId } },
  );
  if (initial.availability !== "exact") return null;
  const orderedFirstPlans = [
    ...initial.nextPlans.filter((plan) =>
      plan.coalSources.every((source) => source.kind === "market")
    ),
    ...initial.nextPlans.filter((plan) =>
      !plan.coalSources.every((source) => source.kind === "market")
    ),
  ];
  for (const first of orderedFirstPlans) {
    const extension = toHotseatRailNetworkModel(
      session.state,
      PLAYER_ONE,
      cardId,
      {
        commandType: "NETWORK",
        fields: { cardId, railNetworkPrefix: first.selection },
      },
    );
    if (extension.availability !== "exact") continue;
    const second = extension.nextPlans.find((plan) =>
      plan.linkCount === 2 &&
      plan.beerSource?.owner === PLAYER_ONE &&
      plan.coalSources.every((source) => source.kind === "market")
    ) ?? extension.nextPlans.find((plan) =>
      plan.linkCount === 2 && plan.beerSource?.owner === PLAYER_ONE
    );
    if (second !== undefined) return { first, second };
  }
  return null;
}

/**
 * Builds a replay-authoritative Rail save exclusively through public commands,
 * then serializes it through the same persistence boundary used by `/dev`.
 */
export function createRailTwoLinkBrowserFixture(): RailTwoLinkBrowserFixture {
  const origin = createGameV2(
    [PLAYER_ONE, PLAYER_TWO],
    "e2e-rail-two-link",
  );
  let session = revealHotseatHand(createHotseatSession(origin));
  session = takeLoan(session, "Canal opening loan");

  while (session.state.era === "canal") {
    if (session.state.progress.phase === "era_transition") {
      session = submitAccepted(
        session,
        { type: "RESOLVE_ERA" },
        "Resolve Canal Era",
      );
      break;
    }
    session = finishCurrentRound(
      session,
      `Canal round ${session.state.round}`,
    );
  }
  if (session.state.era !== "rail" || session.state.round !== 1) {
    throw new Error("Fixture did not reach Rail round 1.");
  }

  // Canal scoring authoritatively purges every level-1 inventory tile, so the
  // top Brewery is now level 2 without any fixture-side state manipulation.
  session = advanceToSeat(session, PLAYER_ONE, "Rail round 1 Player 1");
  session = takeLoan(session, "Rail round 1 loan");
  session = finishCurrentRound(session, "Rail round 1");

  session = advanceToSeat(session, PLAYER_ONE, "Rail round 2 Player 1");
  const built = buildLevelTwoBrewery(session, "Rail round 2 Brewery Build");
  session = built.session;
  if (
    session.state.progress.phase !== "action" ||
    session.state.currentSeat !== PLAYER_ONE ||
    session.state.actionsUsed !== 1 ||
    session.state.actionLimit !== 2
  ) {
    throw new Error("Brewery Build did not leave Player 1's second action open.");
  }

  const cardId = built.cardId;
  const plans = { first: built.first, second: built.second };
  const brewery = session.state.board.placedIndustries[built.buildSpaceId];
  if (
    brewery === undefined ||
    brewery.owner !== PLAYER_ONE ||
    brewery.resources.beer < 1
  ) {
    throw new Error("Rail fixture Brewery is not an active own beer source.");
  }
  const baseline = {
    revision: session.state.revision,
    round: session.state.round,
    money: session.state.players[PLAYER_ONE].money,
    linkTokens: session.state.players[PLAYER_ONE].linkTokensRemaining,
    marketCoal: session.state.market.coal,
    builtLinks: Object.keys(session.state.board.builtLinks).length,
    brewerySpaceId: built.buildSpaceId,
    breweryBeer: brewery.resources.beer,
  };
  const preview = submitAccepted(
    session,
    { type: "NETWORK", selection: plans.second.selection },
    "Preview exact two-link Rail command",
  );
  const previewBrewery = preview.state.board.placedIndustries[built.buildSpaceId];
  if (previewBrewery === undefined) {
    throw new Error("Rail preview lost its Brewery unexpectedly.");
  }

  return {
    storageKey: DEFAULT_HOTSEAT_STORAGE_KEY,
    serializedSession: serializeHotseatSession(session),
    actorSeat: PLAYER_ONE,
    nextSeat: preview.state.currentSeat,
    cardId,
    baseline,
    firstPlan: {
      id: plans.first.id,
      endpointLabel: plans.first.links[0].endpointLabel,
      coalSummary: plans.first.coalSources[0].summary,
    },
    secondPlan: {
      id: plans.second.id,
      endpointLabels: plans.second.links.map((link) => link.endpointLabel),
      coalSummaries: plans.second.coalSources.map((source) => source.summary),
      beerSummary: plans.second.beerSource?.summary ?? "",
      totalCost: plans.second.costs.total,
    },
    expected: {
      revision: preview.state.revision,
      money: preview.state.players[PLAYER_ONE].money,
      linkTokens: preview.state.players[PLAYER_ONE].linkTokensRemaining,
      marketCoal: preview.state.market.coal,
      builtLinks: Object.keys(preview.state.board.builtLinks).length,
      breweryBeer: previewBrewery.resources.beer,
    },
  };
}

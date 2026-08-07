import type { PlayableCardId } from "../../src/engine/cards-v2/types";
import {
  getGameV2BuildLegalOptions,
} from "../../src/engine/game-v2/build-legal";
import type { GameV2Command } from "../../src/engine/game-v2/commands";
import {
  getGameV2LiquidationLegalOptions,
} from "../../src/engine/game-v2/liquidation-legal";
import { getGameV2LegalOptions } from "../../src/engine/game-v2/legal";
import { createGameV2 } from "../../src/engine/game-v2/state";
import {
  createHotseatSession,
  submitHotseatCommand,
  type HotseatSession,
} from "../../src/ui/hotseat-session";
import { serializeHotseatSession } from "../../src/ui/hotseat-persistence";

const PLAYER_1 = "Player 1";
const PLAYER_2 = "Player 2";
const FIXTURE_SEED = "game-v2-dev-alpha";

function require(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(`Liquidation fixture: ${message}`);
}

function submit(
  session: HotseatSession,
  command: GameV2Command,
): HotseatSession {
  const next = submitHotseatCommand(session, command);
  require(next.lastResult?.ok, `${command.type} command was rejected`);
  require(
    next.state.revision === session.state.revision + 1,
    `${command.type} did not advance exactly one revision`,
  );
  return next;
}

function submitPass(session: HotseatSession): HotseatSession {
  const legal = getGameV2LegalOptions(session.state, session.state.currentSeat);
  const cardId = legal.passCardIds[0];
  require(cardId !== undefined, `${session.state.currentSeat} has no Pass card`);
  return submit(session, { type: "PASS", cardId });
}

function submitLoan(
  session: HotseatSession,
  cardId: PlayableCardId,
): HotseatSession {
  const legal = getGameV2LegalOptions(session.state, session.state.currentSeat);
  require(
    legal.loanCardIds.includes(cardId),
    `${cardId} is not an exact Loan card for ${session.state.currentSeat}`,
  );
  return submit(session, { type: "LOAN", cardId });
}

function submitBuild(
  session: HotseatSession,
  cardId: PlayableCardId,
  buildSpaceId: string,
  industry: string,
  expectedTotalCost: number,
): HotseatSession {
  const options = getGameV2BuildLegalOptions(
    session.state,
    session.state.currentSeat,
    cardId,
  );
  require(options.availability === "exact", options.reason?.message ?? "Build disabled");
  const target = options.targets.find((candidate) =>
    candidate.buildSpaceId === buildSpaceId && candidate.industry === industry
  );
  require(target !== undefined, `${industry} at ${buildSpaceId} is not an exact Build target`);
  const plan = target.resourcePlans.find((candidate) =>
    candidate.totalCost === expectedTotalCost
  );
  require(
    plan !== undefined,
    `${industry} at ${buildSpaceId} has no £${expectedTotalCost} resource plan`,
  );
  return submit(session, { type: "BUILD", selection: plan.selection });
}

function submitCanalNetwork(
  session: HotseatSession,
  cardId: PlayableCardId,
  linkId: string,
): HotseatSession {
  const legal = getGameV2LegalOptions(session.state, session.state.currentSeat);
  require(
    legal.network.availability === "exact",
    legal.network.reason?.message ?? "Canal Network disabled",
  );
  require(
    legal.network.selectableCardIds.includes(cardId),
    `${cardId} is not selectable for Canal Network`,
  );
  const link = legal.network.canalLinks.find((candidate) =>
    candidate.linkId === linkId
  );
  require(link !== undefined, `${linkId} is not an exact Canal Network choice`);
  return submit(session, {
    type: "NETWORK",
    selection: { ...link.selection, cardId },
  });
}

function settleCashCoveredRound(session: HotseatSession): HotseatSession {
  require(
    session.state.progress.phase === "round_settlement",
    "cash-covered settlement was requested outside a round boundary",
  );
  const options = getGameV2LiquidationLegalOptions(session.state, {
    [PLAYER_1]: [],
  });
  require(options.availability === "exact", options.reason?.message ?? "Settlement disabled");
  require(options.ready, "cash-covered settlement was not reducer-ready");
  require(options.liquidationChoices !== null, "cash-covered choices were omitted");
  return submit(session, {
    type: "SETTLE_ROUND",
    liquidationChoices: options.liquidationChoices,
  });
}

export type CashShortLiquidationFixture = {
  readonly serializedSession: string;
  readonly expected: {
    readonly seat: typeof PLAYER_1;
    readonly boundaryRevision: 12;
    readonly nextRevision: 13;
    readonly boundaryRound: 3;
    readonly nextRound: 4;
    readonly cashBefore: 0;
    readonly initialShortfall: 3;
    readonly firstBuildSpaceId: "stone_1";
    readonly firstLiquidationLabel: "Liquidate Stone brewery level 1 for £2";
    readonly secondBuildSpaceId: "worcester_1";
    readonly secondLiquidationLabel: "Liquidate Worcester cotton level 1 for £6";
    readonly survivingBuildSpaceId: "stafford_2";
    readonly saleProceeds: 8;
    readonly cashAfter: 5;
    readonly victoryPointsAfter: 0;
    readonly unpaidAfter: 0;
  };
};

/**
 * Creates a replay-authoritative round-settlement save entirely through typed
 * commands and exact selectors. No fixture state is patched or bypassed.
 */
export function createCashShortLiquidationFixture(): CashShortLiquidationFixture {
  let session = createHotseatSession(
    createGameV2([PLAYER_1, PLAYER_2], FIXTURE_SEED),
  );

  // Round 1: take one Loan and pay its first £3 negative-income installment.
  session = submitLoan(session, "location-cannock-02");
  session = submitPass(session);
  session = settleCashCoveredRound(session);

  // Round 2: leave two useful industries while reducing Player 1 to £10.
  require(session.state.currentSeat === PLAYER_1, "Player 1 did not open round 2");
  session = submitBuild(
    session,
    "location-worcester-02",
    "worcester_1",
    "cotton",
    12,
  );
  session = submitBuild(
    session,
    "location-stafford-02",
    "stafford_2",
    "pottery",
    19,
  );
  require(session.state.currentSeat === PLAYER_2, "Player 2 did not follow Player 1");
  session = submitPass(session);
  session = submitPass(session);
  session = settleCashCoveredRound(session);

  // Round 3: Player 2 acts first; Player 1 spends the remaining £10 exactly.
  require(session.state.currentSeat === PLAYER_2, "Player 2 did not open round 3");
  session = submitPass(session);
  session = submitPass(session);
  require(session.state.currentSeat === PLAYER_1, "Player 1 did not follow Player 2");
  session = submitCanalNetwork(
    session,
    "location-coalbrookdale-01",
    "link_stafford_stone",
  );
  session = submitBuild(
    session,
    "industry-brewery-03",
    "stone_1",
    "brewery",
    7,
  );

  const state = session.state;
  require(state.progress.phase === "round_settlement", "fixture did not reach settlement");
  require(state.revision === 12, `expected revision 12, got ${state.revision}`);
  require(state.round === 3, `expected round 3, got ${state.round}`);
  require(state.players[PLAYER_1].money === 0, "Player 1 must enter settlement with £0");
  for (const buildSpaceId of ["worcester_1", "stafford_2", "stone_1"]) {
    require(
      state.board.placedIndustries[buildSpaceId]?.owner === PLAYER_1,
      `${buildSpaceId} is not owned by Player 1`,
    );
  }

  const initial = getGameV2LiquidationLegalOptions(state, {});
  const initialSeat = initial.seats.find((seat) => seat.seat === PLAYER_1);
  require(initialSeat?.initialShortfall === 3, "initial shortfall must be £3");
  const first = initialSeat.nextChoices.find((choice) =>
    choice.buildSpaceId === "stone_1"
  );
  require(first?.liquidationValue === 2, "Stone brewery must liquidate for £2");
  require(first.remainingShortfallAfterAppend === 1, "first choice must leave £1 short");

  const partial = getGameV2LiquidationLegalOptions(state, {
    [PLAYER_1]: first.choicesAfterAppend,
  });
  require(!partial.ready, "one low-value asset must not complete settlement");
  const partialSeat = partial.seats.find((seat) => seat.seat === PLAYER_1);
  const second = partialSeat?.nextChoices.find((choice) =>
    choice.buildSpaceId === "worcester_1"
  );
  require(second?.liquidationValue === 6, "Worcester cotton must liquidate for £6");

  const ready = getGameV2LiquidationLegalOptions(state, {
    [PLAYER_1]: second.choicesAfterAppend,
  });
  const readySeat = ready.seats.find((seat) => seat.seat === PLAYER_1);
  require(ready.ready, "two selected assets must complete settlement");
  require(
    JSON.stringify(ready.liquidationChoices?.[PLAYER_1]) ===
      JSON.stringify(["stone_1", "worcester_1"]),
    "liquidation order must be Stone brewery then Worcester cotton",
  );
  require(readySeat?.liquidationProceeds === 8, "sale proceeds must be £8");
  require(readySeat.preview.moneyAfter === 5, "cash preview must be £5");
  require(readySeat.preview.victoryPointsAfter === 0, "VP preview must remain 0");
  require(readySeat.preview.unpaidShortfall === 0, "unpaid preview must be £0");

  return {
    serializedSession: serializeHotseatSession(session),
    expected: {
      seat: PLAYER_1,
      boundaryRevision: 12,
      nextRevision: 13,
      boundaryRound: 3,
      nextRound: 4,
      cashBefore: 0,
      initialShortfall: 3,
      firstBuildSpaceId: "stone_1",
      firstLiquidationLabel: "Liquidate Stone brewery level 1 for £2",
      secondBuildSpaceId: "worcester_1",
      secondLiquidationLabel: "Liquidate Worcester cotton level 1 for £6",
      survivingBuildSpaceId: "stafford_2",
      saleProceeds: 8,
      cashAfter: 5,
      victoryPointsAfter: 0,
      unpaidAfter: 0,
    },
  };
}

import { describe, expect, it } from "vitest";
import {
  executeGameV2Command,
  type GameV2CommandEnvelope,
  type GameV2CommandResult,
} from "@/engine/game-v2/commands";
import { createGameV2, type GameStateV2 } from "@/engine/game-v2/state";
import {
  createHotseatSession,
  hideHotseatHand,
  nextHotseatCommandId,
  resetHotseatSession,
  revealHotseatHand,
  setHotseatBoundaryDraft,
  setHotseatDraft,
  submitHotseatCommand,
  toHotseatPublicModel,
  toHotseatViewModel,
  type HotseatSession,
} from "@/ui/hotseat-session";

function expectAccepted(
  result: GameV2CommandResult,
): asserts result is Extract<GameV2CommandResult, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
}

function passEnvelope(
  state: GameStateV2,
  commandId: string,
): GameV2CommandEnvelope {
  return {
    schemaVersion: 1,
    commandId,
    gameId: state.gameId,
    expectedRevision: state.revision,
    actorSeat: state.currentSeat,
    command: {
      type: "PASS",
      cardId: state.cards.hands[state.currentSeat][0],
    },
  };
}

function roundSettlementState(): GameStateV2 {
  const initial = createGameV2(["alice", "bob"], "hotseat-round-two");
  const alice = executeGameV2Command(initial, passEnvelope(initial, "setup-alice"));
  expectAccepted(alice);
  const bob = executeGameV2Command(
    alice.state,
    passEnvelope(alice.state, "setup-bob"),
  );
  expectAccepted(bob);
  expect(bob.state.progress).toEqual({ phase: "round_settlement" });
  return bob.state;
}

function roundTwoState(): GameStateV2 {
  const boundary = roundSettlementState();
  const settlement = executeGameV2Command(boundary, {
    schemaVersion: 1,
    commandId: "setup-settle",
    gameId: boundary.gameId,
    expectedRevision: boundary.revision,
    actorSeat: null,
    command: { type: "SETTLE_ROUND", liquidationChoices: {} },
  });
  expectAccepted(settlement);
  expect(settlement.state.actionLimit).toBe(2);
  return settlement.state;
}

function revealedSession(state: GameStateV2): HotseatSession {
  return revealHotseatHand(createHotseatSession(state));
}

describe("hot-seat privacy projections", () => {
  it("omits every hand card ID from public and handoff models", () => {
    const state = createGameV2(["alice", "bob"], "hotseat-public-privacy");
    const allHandCardIds = Object.values(state.cards.hands).flat();
    const session = createHotseatSession(state);
    const publicJson = JSON.stringify(toHotseatPublicModel(state));
    const handoffJson = JSON.stringify(toHotseatViewModel(session));

    expect(toHotseatViewModel(session).private).toBeNull();
    for (const cardId of allHandCardIds) {
      expect(publicJson).not.toContain(cardId);
      expect(handoffJson).not.toContain(cardId);
    }
  });

  it("reveals only the current seat's hand and never an opponent card ID", () => {
    const state = createGameV2(["alice", "bob"], "hotseat-private-privacy");
    const view = toHotseatViewModel(revealedSession(state));
    const privateJson = JSON.stringify(view.private);

    expect(view.private?.seat).toBe("alice");
    expect(view.private?.hand).toEqual(state.cards.hands.alice);
    for (const cardId of state.cards.hands.bob) {
      expect(privateJson).not.toContain(cardId);
    }
  });

  it("clears private draft state when a player manually hides the hand", () => {
    const state = createGameV2(["alice", "bob"], "hotseat-manual-hide");
    const withDraft = setHotseatDraft(revealedSession(state), {
      commandType: "PASS",
      fields: { cardId: state.cards.hands.alice[0] },
    });
    const hidden = hideHotseatHand(withDraft);

    expect(hidden.visibility).toEqual({ kind: "handoff", nextSeat: "alice" });
    expect(hidden.draft).toBeNull();
    expect(toHotseatViewModel(hidden).private).toBeNull();
  });

  it("stores only public settlement drafts at an unrevealed round boundary", () => {
    const boundary = createHotseatSession(roundSettlementState());
    const settlementDraft = {
      commandType: "SETTLE_ROUND" as const,
      fields: { liquidationChoices: { alice: [] } },
    };
    const withBoundaryDraft = setHotseatBoundaryDraft(
      boundary,
      settlementDraft,
    );

    expect(boundary.visibility).toEqual({ kind: "handoff", nextSeat: null });
    expect(setHotseatDraft(boundary, settlementDraft)).toBe(boundary);
    expect(withBoundaryDraft.draft).toBe(settlementDraft);
    expect(toHotseatViewModel(withBoundaryDraft).private).toBeNull();
    expect(JSON.stringify(toHotseatViewModel(withBoundaryDraft)))
      .not.toContain("liquidationChoices");
    expect(setHotseatBoundaryDraft(withBoundaryDraft, {
      commandType: "PASS",
      fields: {},
    })).toBe(withBoundaryDraft);

    const actionState = createHotseatSession(
      createGameV2(["alice", "bob"], "hotseat-boundary-reject"),
    );
    expect(setHotseatBoundaryDraft(actionState, settlementDraft))
      .toBe(actionState);
    expect(setHotseatBoundaryDraft(withBoundaryDraft, null).draft).toBeNull();
  });
});

describe("hot-seat command session", () => {
  it("preserves authoritative state, accepted history, visibility, and draft on rejection", () => {
    const state = createGameV2(["alice", "bob"], "hotseat-rejection");
    const draft = {
      commandType: "PASS" as const,
      fields: { cardId: "missing-card" },
    };
    const initial = setHotseatDraft(revealedSession(state), draft);
    const rejected = submitHotseatCommand(initial, {
      type: "PASS",
      cardId: "missing-card" as GameStateV2["cards"]["hands"][string][number],
    });

    expect(rejected.state).toBe(initial.state);
    expect(rejected.acceptedCommands).toBe(initial.acceptedCommands);
    expect(rejected.visibility).toBe(initial.visibility);
    expect(rejected.draft).toBe(draft);
    expect(rejected.lastResult).toMatchObject({
      ok: false,
      commandId: `${nextHotseatCommandId(initial)}`,
      error: { code: "CARD_NOT_IN_HAND" },
    });
    expect(rejected.nextCommandOrdinal).toBe(2);
  });

  it("keeps a revealed player visible for their second action", () => {
    const state = roundTwoState();
    const initial = revealedSession(state);
    const cardId = state.cards.hands.alice[0];
    const accepted = submitHotseatCommand(initial, { type: "PASS", cardId });

    expect(accepted.state.currentSeat).toBe("alice");
    expect(accepted.state.actionsUsed).toBe(1);
    expect(accepted.visibility).toEqual({ kind: "revealed", seat: "alice" });
    expect(toHotseatViewModel(accepted).private?.hand).toEqual(
      accepted.state.cards.hands.alice,
    );
    expect(accepted.acceptedCommands).toHaveLength(1);
    expect(accepted.acceptedCommands[0].commandId).toBe(
      `hotseat:${state.gameId}:000001`,
    );
  });

  it("hides all hands when an accepted action changes seats", () => {
    const state = createGameV2(["alice", "bob"], "hotseat-seat-change");
    const cardId = state.cards.hands.alice[0];
    const accepted = submitHotseatCommand(revealedSession(state), {
      type: "PASS",
      cardId,
    });

    expect(accepted.state.currentSeat).toBe("bob");
    expect(accepted.visibility).toEqual({ kind: "handoff", nextSeat: "bob" });
    expect(accepted.draft).toBeNull();
    expect(toHotseatViewModel(accepted).private).toBeNull();
    expect(accepted.lastResult).toMatchObject({
      ok: true,
      outcome: { kind: "player_action", actionType: "PASS" },
    });
  });

  it("resets all UI and replay state around a replacement game", () => {
    const initialState = createGameV2(["alice", "bob"], "hotseat-reset-old");
    const progressed = submitHotseatCommand(revealedSession(initialState), {
      type: "PASS",
      cardId: initialState.cards.hands.alice[0],
    });
    const replacement = createGameV2(
      ["Player 1", "Player 2", "Player 3"],
      "hotseat-reset-new",
    );
    const reset = resetHotseatSession(progressed, replacement);

    expect(reset.state).toBe(replacement);
    expect(reset.acceptedCommands).toEqual([]);
    expect(reset.visibility).toEqual({ kind: "handoff", nextSeat: "Player 1" });
    expect(reset.draft).toBeNull();
    expect(reset.lastResult).toBeNull();
    expect(reset.nextCommandOrdinal).toBe(1);
    expect(nextHotseatCommandId(reset)).toBe(
      `hotseat:${replacement.gameId}:000001`,
    );
  });
});

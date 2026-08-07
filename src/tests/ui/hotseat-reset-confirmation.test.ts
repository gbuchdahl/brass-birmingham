import { describe, expect, it } from "vitest";
import {
  cancelHotseatResetConfirmation,
  confirmHotseatResetConfirmation,
  idleHotseatResetConfirmation,
  requestHotseatResetConfirmation,
  type HotseatResetContext,
} from "@/ui/hotseat-reset-confirmation";

function context(
  overrides: {
    readonly currentGame?: Partial<HotseatResetContext["currentGame"]>;
    readonly requestedGame?: Partial<HotseatResetContext["requestedGame"]>;
    readonly localSavePresent?: boolean;
  } = {},
): HotseatResetContext {
  return {
    currentGame: {
      gameId: "game-alpha",
      revision: 12,
      playerCount: 2,
      seed: "old-seed",
      ...overrides.currentGame,
    },
    requestedGame: {
      playerCount: 3,
      seed: "new-seed",
      ...overrides.requestedGame,
    },
    localSavePresent: overrides.localSavePresent ?? true,
  };
}

describe("hot-seat reset confirmation", () => {
  it("captures a two-step warning with current save and requested settings", () => {
    const source = context();
    const confirmation = requestHotseatResetConfirmation(source);

    expect(confirmation).toMatchObject({
      status: "pending",
      snapshot: source,
      warning: {
        title: "Replace the current hot-seat game?",
        currentGameId: "game-alpha",
        currentRevision: 12,
        currentPlayerCount: 2,
        currentSeed: "old-seed",
        requestedPlayerCount: 3,
        requestedSeed: "new-seed",
        replacesLocalSave: true,
      },
    });
    if (confirmation.status !== "pending") {
      throw new Error("Expected a pending reset confirmation");
    }
    expect(confirmation.warning.message).toContain("local autosave");
    expect(confirmation.warning.message).toContain("revision 12");
    expect(confirmation.warning.message).toContain("3 players");

    (source.currentGame as { seed: string }).seed = "mutated";
    expect(confirmation.snapshot.currentGame.seed).toBe("old-seed");
  });

  it("confirms once when revision and all settings are unchanged", () => {
    const live = context();
    const pending = requestHotseatResetConfirmation(live);
    const decision = confirmHotseatResetConfirmation(pending, context());

    expect(decision).toEqual({
      status: "confirmed",
      nextState: { status: "idle" },
      requestedGame: { playerCount: 3, seed: "new-seed" },
    });
    expect(confirmHotseatResetConfirmation(
      decision.nextState,
      context(),
    )).toMatchObject({
      status: "rejected",
      reason: "NO_PENDING_CONFIRMATION",
    });
  });

  it("rejects a revision, identity, or current-settings change", () => {
    const pending = requestHotseatResetConfirmation(context());
    for (const changed of [
      context({ currentGame: { revision: 13 } }),
      context({ currentGame: { gameId: "game-beta" } }),
      context({ currentGame: { playerCount: 4 } }),
      context({ currentGame: { seed: "different-current-seed" } }),
    ]) {
      expect(confirmHotseatResetConfirmation(pending, changed)).toMatchObject({
        status: "rejected",
        nextState: { status: "idle" },
        reason: "CURRENT_GAME_CHANGED",
      });
    }
  });

  it("rejects changed requested player or seed settings", () => {
    const pending = requestHotseatResetConfirmation(context());
    for (const changed of [
      context({ requestedGame: { playerCount: 4 } }),
      context({ requestedGame: { seed: "another-new-seed" } }),
    ]) {
      expect(confirmHotseatResetConfirmation(pending, changed)).toMatchObject({
        status: "rejected",
        nextState: { status: "idle" },
        reason: "REQUESTED_SETTINGS_CHANGED",
      });
    }
  });

  it("rejects a changed local-save context", () => {
    const pending = requestHotseatResetConfirmation(context());
    expect(confirmHotseatResetConfirmation(
      pending,
      context({ localSavePresent: false }),
    )).toMatchObject({
      status: "rejected",
      reason: "SAVE_CONTEXT_CHANGED",
      nextState: { status: "idle" },
    });
  });

  it("cancels to idle and cannot execute after cancellation", () => {
    const canceled = cancelHotseatResetConfirmation();

    expect(canceled).toEqual({ status: "idle" });
    expect(confirmHotseatResetConfirmation(canceled, context())).toMatchObject({
      status: "rejected",
      reason: "NO_PENDING_CONFIRMATION",
    });
  });

  it("fails closed when request or confirmation context is malformed", () => {
    const malformed = context({ currentGame: { revision: -1 } });
    const invalid = requestHotseatResetConfirmation(malformed);
    expect(invalid).toMatchObject({
      status: "invalid",
      message: expect.stringContaining("current game"),
    });
    expect(confirmHotseatResetConfirmation(invalid, context())).toMatchObject({
      status: "rejected",
      reason: "INVALID_CONTEXT",
      nextState: { status: "idle" },
    });

    const pending = requestHotseatResetConfirmation(context());
    const invalidLive = {
      ...context(),
      requestedGame: { playerCount: 5, seed: "new-seed" },
    } as unknown as HotseatResetContext;
    expect(confirmHotseatResetConfirmation(
      pending,
      invalidLive,
    )).toMatchObject({
      status: "rejected",
      reason: "INVALID_CONTEXT",
      nextState: { status: "idle" },
    });
  });

  it("provides an explicit initial idle state", () => {
    expect(idleHotseatResetConfirmation()).toEqual({ status: "idle" });
  });
});

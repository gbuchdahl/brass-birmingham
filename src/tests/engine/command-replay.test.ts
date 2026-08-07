import { describe, expect, it } from "vitest";
import {
  createGame,
  deserializeGame,
  DeserializeGameError,
  executeCommand,
  replayCommands,
  serializeGame,
  type CommandEnvelope,
} from "@/engine";

function endTurnCommand(expectedRevision: number, player = "A"): CommandEnvelope {
  return {
    schemaVersion: 1,
    id: `end-turn-${expectedRevision}`,
    expectedRevision,
    action: { type: "END_TURN", player },
  };
}

describe("versioned command execution", () => {
  it("increments revision and records the command only after an accepted action", () => {
    const initial = {
      ...createGame(["A", "B"], "command-success"),
      actionsTakenThisTurn: 1,
    };
    const result = executeCommand(initial, endTurnCommand(0));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.revision).toBe(1);
    expect(result.state.log.at(-1)).toMatchObject({
      type: "COMMAND_APPLIED",
      data: { commandId: "end-turn-0", revision: 1 },
    });
  });

  it("rejects stale commands without mutating state", () => {
    const state = createGame(["A", "B"], "stale-command");
    const result = executeCommand(state, endTurnCommand(3));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT" },
    });
    expect(result.state).toBe(state);
  });

  it("rejects illegal actions without mutating state or revision", () => {
    const state = createGame(["A", "B"], "atomic-rejection");
    const result = executeCommand(state, endTurnCommand(0, "B"));

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_CURRENT_PLAYER" },
    });
    expect(result.state).toBe(state);
    expect(result.state.revision).toBe(0);
  });

  it("replays the same commands to the same serialized result", () => {
    const initial = {
      ...createGame(["A", "B"], "replay-seed"),
      actionsTakenThisTurn: 1,
    };
    const commands = [endTurnCommand(0)];

    const first = replayCommands(initial, commands);
    const second = replayCommands(initial, commands);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(serializeGame(first.state)).toBe(serializeGame(second.state));
  });
});

describe("game-state serialization", () => {
  it("round-trips a deterministic game state", () => {
    const state = createGame(["A", "B", "C"], "serialize-seed");
    expect(deserializeGame(serializeGame(state))).toEqual(state);
  });

  it("rejects states from another ruleset", () => {
    const state = createGame(["A", "B"], "wrong-ruleset");
    const serialized = JSON.stringify({
      ...state,
      ruleset: { ...state.ruleset, version: "future-rules" },
    });

    expect(() => deserializeGame(serialized)).toThrowError(DeserializeGameError);
    try {
      deserializeGame(serialized);
    } catch (error) {
      expect(error).toMatchObject({ code: "RULESET_MISMATCH" });
    }
  });
});

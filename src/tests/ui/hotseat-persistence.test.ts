import { describe, expect, it } from "vitest";
import {
  executeGameV2Command,
  type GameV2CommandEnvelope,
  type GameV2CommandResult,
} from "@/engine/game-v2/commands";
import { serializeGameV2 } from "@/engine/game-v2/serialization";
import {
  GAME_STATE_V2_SCHEMA_VERSION,
  createGameV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import {
  createHotseatSession,
  nextHotseatCommandId,
  revealHotseatHand,
  setHotseatDraft,
  submitHotseatCommand,
} from "@/ui/hotseat-session";
import {
  HOTSEAT_SAVE_FORMAT,
  HOTSEAT_SAVE_SCHEMA_VERSION,
  HotseatPersistenceError,
  deserializeHotseatSession,
  serializeHotseatSession,
} from "@/ui/hotseat-persistence";

function expectAccepted(
  result: GameV2CommandResult,
): asserts result is Extract<GameV2CommandResult, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
}

function parsedSave(serialized: string): Record<string, unknown> {
  return JSON.parse(serialized) as Record<string, unknown>;
}

function persistedSession() {
  const state = createGameV2(["alice", "bob"], "hotseat-persist");
  const revealed = setHotseatDraft(
    revealHotseatHand(createHotseatSession(state)),
    {
      commandType: "PASS",
      fields: { cardId: "not-a-real-card" },
    },
  );
  const rejected = submitHotseatCommand(revealed, {
    type: "PASS",
    cardId: "not-a-real-card" as GameStateV2["cards"]["hands"][string][number],
  });
  return submitHotseatCommand(rejected, {
    type: "PASS",
    cardId: state.cards.hands.alice[0],
  });
}

function replaceSaveField(
  serialized: string,
  field: string,
  value: unknown,
): string {
  return JSON.stringify({ ...parsedSave(serialized), [field]: value });
}

describe("hot-seat persistence", () => {
  it("round-trips replay data and restores only a privacy-safe handoff", () => {
    const session = persistedSession();
    const serialized = serializeHotseatSession(session);
    const document = parsedSave(serialized);
    const restored = deserializeHotseatSession(serialized);

    expect(HOTSEAT_SAVE_SCHEMA_VERSION).toBe(1);
    expect(document.format).toBe(HOTSEAT_SAVE_FORMAT);
    expect(GAME_STATE_V2_SCHEMA_VERSION).not.toBe(HOTSEAT_SAVE_SCHEMA_VERSION);
    expect(document).not.toHaveProperty("visibility");
    expect(document).not.toHaveProperty("draft");
    expect(document).not.toHaveProperty("lastResult");
    expect(typeof document.origin).toBe("string");
    expect(typeof document.head).toBe("string");
    expect(serializeGameV2(restored.replayOrigin)).toBe(document.origin);
    expect(serializeGameV2(restored.state)).toBe(document.head);
    expect(restored.acceptedCommands).toEqual(session.acceptedCommands);
    expect(restored.nextCommandOrdinal).toBe(3);
    expect(restored.visibility).toEqual({ kind: "handoff", nextSeat: "bob" });
    expect(restored.draft).toBeNull();
    expect(restored.lastResult).toBeNull();
    expect(nextHotseatCommandId(restored)).toMatch(/:000003$/);
  });

  it("starts beyond hot-seat IDs already present in a progressed state", () => {
    const state = createGameV2(["alice", "bob"], "hotseat-progressed");
    const envelope: GameV2CommandEnvelope = {
      schemaVersion: 1,
      commandId: `hotseat:${state.gameId}:000007`,
      gameId: state.gameId,
      expectedRevision: state.revision,
      actorSeat: state.currentSeat,
      command: { type: "PASS", cardId: state.cards.hands.alice[0] },
    };
    const progressed = executeGameV2Command(state, envelope);
    expectAccepted(progressed);

    const session = createHotseatSession(progressed.state);
    expect(session.replayOrigin).toBe(progressed.state);
    expect(session.nextCommandOrdinal).toBe(8);
    expect(nextHotseatCommandId(session)).toBe(
      `hotseat:${state.gameId}:000008`,
    );
  });

  it("rejects a valid but divergent saved head after replay", () => {
    const session = persistedSession();
    const serialized = serializeHotseatSession(session);
    const divergentHead = serializeGameV2(session.replayOrigin);

    expect(() => deserializeHotseatSession(
      replaceSaveField(serialized, "head", divergentHead),
    )).toThrowError(
      expect.objectContaining({ code: "HEAD_MISMATCH" }),
    );
  });

  it("byte-compares the saved head rather than trusting semantic JSON equality", () => {
    const serialized = serializeHotseatSession(persistedSession());
    const document = parsedSave(serialized);
    const sameHeadWithWhitespace = JSON.stringify(
      JSON.parse(document.head as string),
      null,
      2,
    );

    expect(() => deserializeHotseatSession(
      replaceSaveField(serialized, "head", sameHeadWithWhitespace),
    )).toThrowError(
      expect.objectContaining({ code: "HEAD_MISMATCH" }),
    );
  });

  it("reports the exact rejected command when history is corrupt", () => {
    const serialized = serializeHotseatSession(persistedSession());
    const document = parsedSave(serialized);
    const commands = [...document.acceptedCommands as unknown[]];
    commands[0] = { nonsense: true };

    let error: unknown;
    try {
      deserializeHotseatSession(
        replaceSaveField(serialized, "acceptedCommands", commands),
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(HotseatPersistenceError);
    expect(error).toMatchObject({
      code: "COMMAND_REPLAY_FAILED",
      failedCommandIndex: 0,
      commandError: { source: "command", code: "UNSUPPORTED_COMMAND_SCHEMA" },
    });
  });

  it("distinguishes save-schema, nested-state, shape, and ordinal corruption", () => {
    const serialized = serializeHotseatSession(persistedSession());
    const document = parsedSave(serialized);
    const origin = JSON.parse(document.origin as string) as Record<string, unknown>;

    expect(() => deserializeHotseatSession("not json")).toThrowError(
      expect.objectContaining({ code: "INVALID_SAVE_JSON" }),
    );
    expect(() => deserializeHotseatSession(JSON.stringify([]))).toThrowError(
      expect.objectContaining({ code: "INVALID_SAVE_SHAPE" }),
    );
    expect(() => deserializeHotseatSession(
      replaceSaveField(serialized, "format", "unrelated-v1-document"),
    )).toThrowError(
      expect.objectContaining({ code: "INVALID_SAVE_FORMAT" }),
    );
    const withoutFormat = { ...parsedSave(serialized) };
    Reflect.deleteProperty(withoutFormat, "format");
    expect(() => deserializeHotseatSession(
      JSON.stringify(withoutFormat),
    )).toThrowError(
      expect.objectContaining({ code: "INVALID_SAVE_FORMAT" }),
    );
    expect(() => deserializeHotseatSession(
      replaceSaveField(serialized, "schemaVersion", 99),
    )).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_SAVE_SCHEMA" }),
    );
    expect(() => deserializeHotseatSession(
      replaceSaveField(
        serialized,
        "origin",
        JSON.stringify({ ...origin, schemaVersion: 99 }),
      ),
    )).toThrowError(
      expect.objectContaining({ code: "INVALID_REPLAY_ORIGIN" }),
    );
    expect(() => deserializeHotseatSession(
      replaceSaveField(serialized, "nextCommandOrdinal", 2),
    )).toThrowError(
      expect.objectContaining({ code: "INVALID_NEXT_COMMAND_ORDINAL" }),
    );
  });

  it("refuses to serialize an internally inconsistent session", () => {
    const session = persistedSession();
    expect(() => serializeHotseatSession({
      ...session,
      acceptedCommands: [],
    })).toThrowError(
      expect.objectContaining({ code: "HEAD_MISMATCH" }),
    );
  });
});

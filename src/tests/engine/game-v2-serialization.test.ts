import { describe, expect, it } from "vitest";
import {
  DeserializeGameV2Error,
  deserializeGameV2,
  serializeGameV2,
} from "@/engine/game-v2/serialization";
import { createGameV2, type GameStateV2 } from "@/engine/game-v2/state";

describe("GameStateV2 serialization", () => {
  it.each([2, 3, 4] as const)(
    "round-trips a deterministic %i-player state exactly",
    (playerCount) => {
      const seats = Array.from(
        { length: playerCount },
        (_, index) => `seat-${index + 1}`,
      );
      const state = createGameV2(seats, `serialization-${playerCount}`);
      const serialized = serializeGameV2(state);

      expect(deserializeGameV2(serialized)).toEqual(state);
      expect(serializeGameV2(deserializeGameV2(serialized))).toBe(serialized);
    },
  );

  it("round-trips an authoritative pending Merchant follow-up", () => {
    const initial = createGameV2(["alice", "bob"], "serialization-pending");
    const merchant = initial.merchants.spaces.find(
      (space) => space.active && space.locationId === "merchant_gloucester",
    );
    if (!merchant) throw new Error("Expected an active Gloucester Merchant");
    const pending: GameStateV2 = {
      ...initial,
      progress: {
        phase: "merchant_free_develop",
        pending: {
          seat: "alice",
          count: 1,
          source: "merchant_bonus",
          merchantSpaceIds: [merchant.merchantSpaceId],
        },
      },
      merchants: {
        ...initial.merchants,
        spaces: initial.merchants.spaces.map((space) =>
          space.merchantSpaceId === merchant.merchantSpaceId
            ? { ...space, beer: 0 }
            : space
        ),
      },
    };

    expect(deserializeGameV2(serializeGameV2(pending))).toEqual(pending);
  });

  it("rejects invalid JSON and non-object JSON with typed errors", () => {
    for (const [serialized, code] of [
      ["{", "INVALID_JSON"],
      ["null", "INVALID_GAME_STATE"],
      ["[]", "INVALID_GAME_STATE"],
    ] as const) {
      expect(() => deserializeGameV2(serialized)).toThrowError(
        DeserializeGameV2Error,
      );
      try {
        deserializeGameV2(serialized);
      } catch (error) {
        expect(error).toMatchObject({ code });
      }
    }
  });

  it("distinguishes unsupported schemas and generated-rules mismatches", () => {
    const state = createGameV2(["alice", "bob"], "serialization-metadata");
    const unsupported = JSON.stringify({ ...state, schemaVersion: 99 });
    const legacyWithoutProgress = JSON.stringify({
      ...state,
      schemaVersion: 2,
      progress: undefined,
    });
    const wrongRules = JSON.stringify({
      ...state,
      ruleset: { ...state.ruleset, version: "future" },
    });

    try {
      deserializeGameV2(unsupported);
      throw new Error("Expected unsupported schema failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "UNSUPPORTED_STATE_SCHEMA" });
    }
    try {
      deserializeGameV2(legacyWithoutProgress);
      throw new Error("Expected legacy schema failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "UNSUPPORTED_STATE_SCHEMA" });
    }
    try {
      deserializeGameV2(wrongRules);
      throw new Error("Expected ruleset failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "RULESET_MISMATCH" });
    }
  });

  it("rejects conservation corruption on deserialize and serialize", () => {
    const state = createGameV2(["alice", "bob"], "serialization-corruption");
    const corrupt = structuredClone(state);
    corrupt.cards.hands.alice.pop();

    for (const operation of [
      () => deserializeGameV2(JSON.stringify(corrupt)),
      () => serializeGameV2(corrupt),
    ]) {
      try {
        operation();
        throw new Error("Expected invalid state failure");
      } catch (error) {
        expect(error).toMatchObject({ code: "INVALID_GAME_STATE" });
        expect(
          (error as DeserializeGameV2Error).validationErrors.map(
            (validationError) => validationError.code,
          ),
        ).toContain("CARD_CONSERVATION");
      }
    }
  });

  it("rejects non-JSON-safe state values before stringify can coerce them", () => {
    const state = createGameV2(["alice", "bob"], "serialization-non-json");
    (state as unknown as { playerCount?: number }).playerCount = Number.NaN;

    expect(() => serializeGameV2(state as GameStateV2)).toThrowError(
      DeserializeGameV2Error,
    );
    try {
      serializeGameV2(state as GameStateV2);
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_GAME_STATE",
        validationErrors: expect.arrayContaining([
          expect.objectContaining({ code: "NOT_JSON_SAFE" }),
        ]),
      });
    }
  });
});

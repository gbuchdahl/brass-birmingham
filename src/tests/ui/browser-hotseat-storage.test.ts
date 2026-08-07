import { describe, expect, it } from "vitest";
import { createGameV2 } from "@/engine/game-v2/state";
import {
  HotseatStorageError,
  clearHotseatSessionStorage,
  loadHotseatSessionFromStorage,
  saveHotseatSessionToStorage,
  type HotseatStorageAdapter,
} from "@/ui/browser-hotseat-storage";
import { HotseatPersistenceError } from "@/ui/hotseat-persistence";
import { createHotseatSession } from "@/ui/hotseat-session";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  let removeCalls = 0;
  const adapter: HotseatStorageAdapter = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      removeCalls += 1;
      values.delete(key);
    },
  };
  return {
    adapter,
    values,
    removeCalls: () => removeCalls,
  };
}

describe("browser hot-seat storage", () => {
  it("saves and loads through an injected storage adapter", () => {
    const storage = memoryStorage();
    const session = createHotseatSession(
      createGameV2(["alice", "bob"], "browser-storage"),
    );

    expect(loadHotseatSessionFromStorage(storage.adapter)).toBeNull();
    saveHotseatSessionToStorage(storage.adapter, session);
    const restored = loadHotseatSessionFromStorage(storage.adapter);

    expect(restored?.state).toEqual(session.state);
    expect(restored?.visibility).toEqual({
      kind: "handoff",
      nextSeat: "alice",
    });
  });

  it("never clears corrupt data implicitly", () => {
    const key = "corrupt-save";
    const storage = memoryStorage({ [key]: "{broken" });

    expect(() => loadHotseatSessionFromStorage(
      storage.adapter,
      key,
    )).toThrowError(HotseatPersistenceError);
    expect(storage.values.get(key)).toBe("{broken");
    expect(storage.removeCalls()).toBe(0);

    clearHotseatSessionStorage(storage.adapter, key);
    expect(storage.values.has(key)).toBe(false);
    expect(storage.removeCalls()).toBe(1);
  });

  it.each([
    ["READ_FAILED", "getItem"],
    ["WRITE_FAILED", "setItem"],
    ["CLEAR_FAILED", "removeItem"],
  ] as const)("wraps %s adapter failures", (code, failingMethod) => {
    const failure = new Error("storage unavailable");
    const storage: HotseatStorageAdapter = {
      getItem: () => {
        if (failingMethod === "getItem") throw failure;
        return null;
      },
      setItem: () => {
        if (failingMethod === "setItem") throw failure;
      },
      removeItem: () => {
        if (failingMethod === "removeItem") throw failure;
      },
    };
    const session = createHotseatSession(
      createGameV2(["alice", "bob"], `storage-${code}`),
    );

    let error: unknown;
    try {
      if (code === "READ_FAILED") loadHotseatSessionFromStorage(storage);
      if (code === "WRITE_FAILED") saveHotseatSessionToStorage(storage, session);
      if (code === "CLEAR_FAILED") clearHotseatSessionStorage(storage);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HotseatStorageError);
    expect(error).toMatchObject({ code, causeValue: failure });
  });
});

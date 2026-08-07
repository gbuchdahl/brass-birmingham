import {
  deserializeHotseatSession,
  serializeHotseatSession,
} from "./hotseat-persistence";
import type { HotseatSession } from "./hotseat-session";

export const DEFAULT_HOTSEAT_STORAGE_KEY =
  "brass-birmingham:hotseat-session:v1";

/** The synchronous subset shared by browser localStorage and test adapters. */
export type HotseatStorageAdapter = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
};

export type HotseatStorageErrorCode =
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "CLEAR_FAILED";

export class HotseatStorageError extends Error {
  readonly code: HotseatStorageErrorCode;
  readonly storageKey: string;
  readonly causeValue: unknown;

  constructor(
    code: HotseatStorageErrorCode,
    storageKey: string,
    message: string,
    cause: unknown,
  ) {
    super(message);
    this.name = "HotseatStorageError";
    this.code = code;
    this.storageKey = storageKey;
    this.causeValue = cause;
  }
}

/** Returns null only when no save exists; corrupt saves throw and remain stored. */
export function loadHotseatSessionFromStorage(
  storage: HotseatStorageAdapter,
  key = DEFAULT_HOTSEAT_STORAGE_KEY,
): HotseatSession | null {
  let serialized: string | null;
  try {
    serialized = storage.getItem(key);
  } catch (cause) {
    throw new HotseatStorageError(
      "READ_FAILED",
      key,
      `Could not read hot-seat save from ${key}.`,
      cause,
    );
  }
  // Deliberately do not catch persistence errors or remove the value. Callers
  // must distinguish corruption from absence and choose explicitly what to do.
  return serialized === null ? null : deserializeHotseatSession(serialized);
}

export function saveHotseatSessionToStorage(
  storage: HotseatStorageAdapter,
  session: HotseatSession,
  key = DEFAULT_HOTSEAT_STORAGE_KEY,
): void {
  const serialized = serializeHotseatSession(session);
  try {
    storage.setItem(key, serialized);
  } catch (cause) {
    throw new HotseatStorageError(
      "WRITE_FAILED",
      key,
      `Could not write hot-seat save to ${key}.`,
      cause,
    );
  }
}

/** Clearing a save is always an explicit user/application action. */
export function clearHotseatSessionStorage(
  storage: HotseatStorageAdapter,
  key = DEFAULT_HOTSEAT_STORAGE_KEY,
): void {
  try {
    storage.removeItem(key);
  } catch (cause) {
    throw new HotseatStorageError(
      "CLEAR_FAILED",
      key,
      `Could not clear hot-seat save at ${key}.`,
      cause,
    );
  }
}

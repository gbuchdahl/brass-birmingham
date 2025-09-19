import { describe, expect, it } from "vitest";
import { reduce } from "@/engine";

describe("reduce", () => {
  it("returns a state when starting the game", () => {
    const state = reduce(null, { type: "START_GAME" });

    expect(state).not.toBeNull();
  });
});

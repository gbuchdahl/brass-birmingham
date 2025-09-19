import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "@/engine";

describe("reduce", () => {
  it("returns the existing state when given a placeholder action", () => {
    const initial = createInitialState();

    const next = reduce(initial, { type: "NOOP" });

    expect(next).toBe(initial);
  });
});

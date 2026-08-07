import { describe, expect, it } from "vitest";
import {
  createRandomState,
  nextRandom,
  nextRandomUint32,
  randomInt,
  shuffleWithState,
} from "@/engine/util/random-state";

describe("serializable deterministic random state", () => {
  it("keeps a fixed regression vector for the established mulberry32 stream", () => {
    let state = createRandomState("brass-seed");
    expect(state).toEqual({
      algorithm: "mulberry32",
      value: 912623471,
      draws: 0,
    });

    const values: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const step = nextRandomUint32(state);
      values.push(step.value);
      state = step.state;
    }

    expect(values).toEqual([
      1823857586, 193667323, 1360420142, 660957912, 1978539818,
    ]);
    expect(state.draws).toBe(5);
  });

  it("can pause through JSON and resume the exact stream", () => {
    const initial = createRandomState("pause-resume");
    const first = nextRandom(initial);
    const restored = JSON.parse(JSON.stringify(first.state));

    expect(nextRandom(restored)).toEqual(nextRandom(first.state));
    expect(first.state).not.toBe(initial);
    expect(initial.draws).toBe(0);
  });

  it("returns floating-point samples in [0, 1)", () => {
    let state = createRandomState("float-bounds");
    for (let index = 0; index < 1_000; index += 1) {
      const step = nextRandom(state);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(1);
      state = step.state;
    }
  });

  it("samples bounded integers and validates the bound", () => {
    let state = createRandomState("integer-bounds");
    for (let index = 0; index < 1_000; index += 1) {
      const step = randomInt(state, 7);
      expect(Number.isInteger(step.value)).toBe(true);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(7);
      state = step.state;
    }

    expect(() => randomInt(state, 0)).toThrow(RangeError);
    expect(() => randomInt(state, 1.5)).toThrow(RangeError);
    expect(() => randomInt(state, 0x1_0000_0001)).toThrow(RangeError);
  });

  it("shuffles deterministically without mutating the input", () => {
    const input = Object.freeze(["a", "b", "c", "d", "e"]);
    const first = shuffleWithState(createRandomState("shuffle"), input);
    const second = shuffleWithState(createRandomState("shuffle"), input);
    const different = shuffleWithState(createRandomState("other"), input);

    expect(first).toEqual(second);
    expect(different.value).not.toEqual(first.value);
    expect([...first.value].sort()).toEqual([...input].sort());
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
    expect(first.state.draws).toBe(input.length - 1);
  });

  it("does not consume randomness when shuffling fewer than two items", () => {
    const state = createRandomState("small-shuffle");
    expect(shuffleWithState(state, []).state).toEqual(state);
    expect(shuffleWithState(state, ["only"]).state).toEqual(state);
  });
});

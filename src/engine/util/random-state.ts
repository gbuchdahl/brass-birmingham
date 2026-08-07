export const RANDOM_ALGORITHM = "mulberry32" as const;

export type RandomState = {
  algorithm: typeof RANDOM_ALGORITHM;
  /** Internal 32-bit accumulator. */
  value: number;
  /** Number of 32-bit samples consumed from this stream. */
  draws: number;
};

export type RandomStep<T> = {
  value: T;
  state: RandomState;
};

const UINT32_RANGE = 0x1_0000_0000;

function hashSeed(seed: string): number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return (hash >>> 0) || 1;
}

export function createRandomState(seed: string): RandomState {
  return {
    algorithm: RANDOM_ALGORITHM,
    value: hashSeed(seed),
    draws: 0,
  };
}

export function nextRandomUint32(state: RandomState): RandomStep<number> {
  const accumulator = (state.value + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(accumulator ^ (accumulator >>> 15), 1 | accumulator);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
  const value = (mixed ^ (mixed >>> 14)) >>> 0;

  return {
    value,
    state: {
      algorithm: RANDOM_ALGORITHM,
      value: accumulator,
      draws: state.draws + 1,
    },
  };
}

export function nextRandom(state: RandomState): RandomStep<number> {
  const step = nextRandomUint32(state);
  return { value: step.value / UINT32_RANGE, state: step.state };
}

/**
 * Samples uniformly from [0, maxExclusive). Rejection sampling avoids modulo
 * bias and records every underlying draw in the returned state.
 */
export function randomInt(
  state: RandomState,
  maxExclusive: number,
): RandomStep<number> {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("maxExclusive must be an integer from 1 through 2^32");
  }

  const acceptanceLimit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let current = state;
  while (true) {
    const step = nextRandomUint32(current);
    current = step.state;
    if (step.value < acceptanceLimit) {
      return { value: step.value % maxExclusive, state: current };
    }
  }
}

export function shuffleWithState<T>(
  state: RandomState,
  input: readonly T[],
): RandomStep<T[]> {
  const items = [...input];
  let current = state;

  for (let index = items.length - 1; index > 0; index -= 1) {
    const step = randomInt(current, index + 1);
    current = step.state;
    [items[index], items[step.value]] = [items[step.value], items[index]];
  }

  return { value: items, state: current };
}

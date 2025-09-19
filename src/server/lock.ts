const locks = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => Promise<T>) {
  const previous = locks.get(key);

  if (previous) {
    await previous;
  }

  let release: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  locks.set(key, current);

  try {
    return await fn();
  } finally {
    release!();
    locks.delete(key);
  }
}

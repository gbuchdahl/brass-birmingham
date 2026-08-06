"use client";

import { useMemo, useState } from "react";
import { createGameV2, type GameStateV2 } from "@/engine/game-v2/state";
import { GameV2DevInspector } from "@/ui/GameV2DevInspector";
import {
  gameV2DevSeats,
  toGameV2DevModel,
  type GameV2DevPlayerCount,
} from "@/ui/game-v2-dev-model";

const DEFAULT_SEED = "game-v2-dev-alpha";

function newGame(playerCount: GameV2DevPlayerCount, seed: string): GameStateV2 {
  return createGameV2(gameV2DevSeats(playerCount), seed);
}

export default function DevPage() {
  const [playerCount, setPlayerCount] = useState<GameV2DevPlayerCount>(2);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [state, setState] = useState<GameStateV2>(() => newGame(2, DEFAULT_SEED));
  const model = useMemo(() => toGameV2DevModel(state), [state]);

  function reset(nextPlayerCount = playerCount): void {
    setState(newGame(nextPlayerCount, seed));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 dark:bg-neutral-900 dark:text-neutral-100 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <section className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-neutral-300">
              Players
              <select
                aria-label="Player count"
                className="rounded border border-slate-400 bg-white px-3 py-2 text-sm font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                onChange={(event) => {
                  const count = Number(event.target.value) as GameV2DevPlayerCount;
                  setPlayerCount(count);
                  reset(count);
                }}
                value={playerCount}
              >
                <option value={2}>2 players</option>
                <option value={3}>3 players</option>
                <option value={4}>4 players</option>
              </select>
            </label>

            <label className="grid min-w-64 flex-1 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-neutral-300">
              Deterministic seed
              <input
                className="rounded border border-slate-400 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                onChange={(event) => setSeed(event.target.value)}
                spellCheck={false}
                value={seed}
              />
            </label>

            <button
              className="rounded border border-slate-500 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:border-neutral-500 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
              onClick={() => reset()}
              type="button"
            >
              Reset snapshot
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
            Player-count changes reset immediately. Seed edits apply when you reset.
          </p>
        </section>

        <GameV2DevInspector model={model} />
      </div>
    </main>
  );
}

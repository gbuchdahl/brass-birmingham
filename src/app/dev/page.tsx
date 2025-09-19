"use client";

import { useState } from "react";
import { createGame, reduce, type GameState } from "@/engine";

export default function DevPage() {
  const [state, setState] = useState<GameState>(() =>
    createGame(["A", "B", "C", "D"]),
  );

  return (
    <main className="min-h-screen space-y-6 bg-white p-6 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      <h1 className="text-2xl font-semibold">Dev Sandbox</h1>

      <button
        className="rounded-lg border border-gray-300 px-3 py-2 font-medium transition hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-neutral-900"
        onClick={() =>
          setState((s) => reduce(s, { type: "END_TURN", player: s.currentPlayer }))
        }
      >
        End Turn (player {state.currentPlayer})
      </button>

      <pre className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-100 shadow-inner dark:bg-neutral-900 dark:text-neutral-100">
        {JSON.stringify(state, null, 2)}
      </pre>
    </main>
  );
}

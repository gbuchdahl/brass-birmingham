"use client";

import { useState } from "react";
import {
  createInitialState,
  reduce,
  type Action,
  type GameState,
} from "@/engine";

const noopAction: Action = { type: "NOOP" };

export default function DevPage() {
  const [state, setState] = useState<GameState>(() => createInitialState());

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dev Sandbox</h1>
      <button
        className="rounded bg-blue-600 px-3 py-1 text-white"
        onClick={() => setState(reduce(state, noopAction))}
      >
        Run reduce()
      </button>
      <pre className="rounded bg-gray-900 p-4 text-sm text-white">
        {JSON.stringify(state, null, 2)}
      </pre>
    </main>
  );
}

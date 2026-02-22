"use client";

import { useEffect, useRef, useState } from "react";
import { createGame, reduce, type Action, type GameState, type ReduceResult } from "@/engine";
import { DevActionPanel, type DevSelectionState } from "@/ui/DevActionPanel";
import { DevLegalPanel } from "@/ui/DevLegalPanel";
import { DevStatePanel } from "@/ui/DevStatePanel";

function initialSelection(state: GameState): DevSelectionState {
  const nodes = [...state.board.topology.cities, ...state.board.topology.ports];
  const hand = state.players[state.currentPlayer].hand;
  return {
    from: nodes[0],
    to: nodes[1] ?? nodes[0],
    cardId: hand[0] ?? "",
    city: state.board.topology.cities[0],
    industry: "coal",
    level: 1,
  };
}

function createInitialDevState() {
  const game = createGame(["A", "B", "C", "D"]);
  return {
    game,
    selection: initialSelection(game),
  };
}

export default function DevPage() {
  const initialRef = useRef<ReturnType<typeof createInitialDevState> | null>(null);
  if (!initialRef.current) {
    initialRef.current = createInitialDevState();
  }

  const [state, setState] = useState<GameState>(() => initialRef.current!.game);
  const [lastResult, setLastResult] = useState<ReduceResult | null>(null);
  const [selection, setSelection] = useState<DevSelectionState>(
    () => initialRef.current!.selection,
  );

  useEffect(() => {
    const hand = state.players[state.currentPlayer].hand;
    if (selection.cardId && hand.includes(selection.cardId)) {
      return;
    }
    if (hand[0]) {
      setSelection((prev) => ({ ...prev, cardId: hand[0] }));
    }
  }, [selection.cardId, state.currentPlayer, state.players]);

  const dispatchAction = (action: Action) => {
    setState((previous) => {
      const result = reduce(previous, action);
      setLastResult(result);
      return result.state;
    });
  };

  return (
    <main className="min-h-screen space-y-4 bg-white p-4 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dev Sandbox</h1>
        <button
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          onClick={() => {
            const next = createGame(["A", "B", "C", "D"]);
            setState(next);
            setSelection(initialSelection(next));
            setLastResult(null);
          }}
        >
          Reset Game
        </button>
      </header>

      <DevActionPanel
        state={state}
        selection={selection}
        onSelectionChange={setSelection}
        onDispatch={dispatchAction}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DevLegalPanel
          state={state}
          onDispatchLink={(from, to) =>
            dispatchAction({
              type: "BUILD_LINK",
              player: state.currentPlayer,
              from,
              to,
            })
          }
          onPrefillSelection={(next) =>
            setSelection((prev) => ({
              ...prev,
              ...next,
            }))
          }
        />
        <DevStatePanel state={state} lastResult={lastResult} />
      </div>
    </main>
  );
}

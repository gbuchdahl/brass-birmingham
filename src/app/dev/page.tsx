"use client";

import { useEffect, useMemo, useState } from "react";
import { createGame, reduce, type Action, type GameState, type ReduceResult } from "@/engine";
import { describeCard } from "@/engine/cards";
import type { CityId, NodeId } from "@/engine/board/topology";
import { DevBoardGraph } from "@/ui/DevBoardGraph";

function createInitialState() {
  return createGame(["A", "B", "C", "D"]);
}

function requiredActionsThisTurn(state: GameState): number {
  return state.round === 1 ? 1 : 2;
}

export default function DevPage() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [lastResult, setLastResult] = useState<ReduceResult | null>(null);

  const [selectedNodes, setSelectedNodes] = useState<NodeId[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityId | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [industry, setIndustry] = useState<"coal" | "iron">("coal");
  const [level, setLevel] = useState(1);

  const hand = state.players[state.currentPlayer].hand;
  const requiredActions = requiredActionsThisTurn(state);
  const actionsRemaining = Math.max(0, requiredActions - state.actionsTakenThisTurn);

  useEffect(() => {
    if (hand.length === 0) {
      setSelectedCardId("");
      return;
    }
    if (!selectedCardId || !hand.includes(selectedCardId)) {
      setSelectedCardId(hand[0]);
    }
  }, [hand, selectedCardId]);

  useEffect(() => {
    if (!selectedCity) {
      setSelectedCity(state.board.topology.cities[0]);
    }
  }, [selectedCity, state.board.topology.cities]);

  const latestInvalid = useMemo(
    () => [...state.log].reverse().find((event) => event.type === "INVALID_ACTION"),
    [state.log],
  );

  function dispatch(action: Action) {
    setState((previous) => {
      const result = reduce(previous, action);
      setLastResult(result);
      return result.state;
    });
  }

  function onSelectNode(node: NodeId) {
    setSelectedNodes((previous) => {
      if (previous.includes(node)) {
        return previous.filter((n) => n !== node);
      }
      if (previous.length >= 2) {
        return [previous[1], node];
      }
      return [...previous, node];
    });
  }

  function resetGame() {
    const next = createInitialState();
    setState(next);
    setLastResult(null);
    setSelectedNodes([]);
    setSelectedCity(next.board.topology.cities[0]);
    setSelectedCardId(next.players[next.currentPlayer].hand[0] ?? "");
    setIndustry("coal");
    setLevel(1);
  }

  return (
    <main className="min-h-screen space-y-4 bg-white p-4 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dev Sandbox</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded bg-gray-100 px-2 py-1 dark:bg-neutral-900">
            Player: {state.currentPlayer}
          </span>
          <span className="rounded bg-gray-100 px-2 py-1 dark:bg-neutral-900">
            Turn: {state.turn}
          </span>
          <span className="rounded bg-gray-100 px-2 py-1 dark:bg-neutral-900">
            Phase: {state.phase}
          </span>
          <span className="rounded bg-gray-100 px-2 py-1 dark:bg-neutral-900">
            Actions: {state.actionsTakenThisTurn}/{requiredActions}
          </span>
          <button
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            onClick={resetGame}
          >
            Reset
          </button>
        </div>
      </header>

      <DevBoardGraph
        state={state}
        selectedNodes={selectedNodes}
        selectedCity={selectedCity}
        onSelectNode={onSelectNode}
        onSelectCity={setSelectedCity}
      />

      <section className="rounded-lg border border-gray-200 p-4 dark:border-neutral-800">
        <h2 className="mb-2 text-lg font-semibold">Current Hand</h2>
        <div className="flex flex-wrap gap-2">
          {hand.map((cardId) => {
            const card = state.deck.byId[cardId];
            const active = selectedCardId === cardId;
            return (
              <button
                key={cardId}
                className={`rounded border px-2 py-1 text-sm ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200"
                    : "border-gray-300 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                }`}
                onClick={() => setSelectedCardId(cardId)}
              >
                {cardId}: {describeCard(card)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-gray-200 p-4 dark:border-neutral-800 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Actions</h2>

          <div className="rounded border border-gray-200 p-3 dark:border-neutral-800">
            <p className="mb-2 text-sm font-medium">Build Link</p>
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              Selected nodes: {selectedNodes.length > 0 ? selectedNodes.join(" -> ") : "none"}
            </p>
            <button
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              disabled={selectedNodes.length !== 2}
              onClick={() => {
                const [from, to] = selectedNodes;
                if (!from || !to) return;
                dispatch({ type: "BUILD_LINK", player: state.currentPlayer, from, to });
              }}
            >
              Build Selected Link
            </button>
          </div>

          <div className="rounded border border-gray-200 p-3 dark:border-neutral-800">
            <p className="mb-2 text-sm font-medium">Build Industry</p>
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              City: {selectedCity ?? "none"} | Card: {selectedCardId || "none"}
            </p>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <label>Industry</label>
              <select
                className="rounded border border-gray-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                value={industry}
                onChange={(event) => setIndustry(event.target.value as "coal" | "iron")}
              >
                <option value="coal">coal</option>
                <option value="iron">iron</option>
              </select>
              <label>Level</label>
              <input
                className="w-16 rounded border border-gray-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                type="number"
                min={1}
                value={level}
                onChange={(event) => setLevel(Number(event.target.value) || 1)}
              />
            </div>
            <button
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              disabled={!selectedCity || !selectedCardId}
              onClick={() => {
                if (!selectedCity || !selectedCardId) return;
                dispatch({
                  type: "BUILD_INDUSTRY",
                  player: state.currentPlayer,
                  city: selectedCity,
                  industry,
                  level,
                  cardId: selectedCardId,
                });
              }}
            >
              Build Industry At Selected City
            </button>
          </div>

          <div className="rounded border border-gray-200 p-3 dark:border-neutral-800">
            <p className="mb-2 text-sm font-medium">Turn</p>
            <button
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              disabled={actionsRemaining > 0}
              onClick={() => dispatch({ type: "END_TURN", player: state.currentPlayer })}
            >
              End Turn
            </button>
            {actionsRemaining > 0 ? (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {actionsRemaining} action(s) remaining this turn.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Feedback</h2>
          <div className="rounded border border-gray-200 p-3 text-sm dark:border-neutral-800">
            <p>
              <strong>Last reduce:</strong>{" "}
              {lastResult ? (lastResult.ok ? "ok" : `error:${lastResult.error.code}`) : "n/a"}
            </p>
            <p>
              <strong>Coal market:</strong> {state.market.coal.units} (fallback £{state.market.coal.fallbackPrice})
            </p>
            <p>
              <strong>Iron market:</strong> {state.market.iron.units} (fallback £{state.market.iron.fallbackPrice})
            </p>
          </div>
          <div className="rounded border border-gray-200 p-3 text-sm dark:border-neutral-800">
            <p className="mb-1 font-medium">Latest invalid action</p>
            {latestInvalid ? (
              <pre className="overflow-auto text-xs">{JSON.stringify(latestInvalid.data, null, 2)}</pre>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400">No invalid actions yet.</p>
            )}
          </div>
          <div className="max-h-56 overflow-auto rounded border border-gray-200 p-3 text-xs dark:border-neutral-800">
            <p className="mb-1 font-medium">Recent Events</p>
            {state.log.slice(-8).map((event) => (
              <div key={event.idx} className="mb-2 rounded bg-gray-50 p-2 dark:bg-neutral-900">
                <p className="font-medium">
                  #{event.idx} {event.type}
                </p>
                {event.data ? <pre className="overflow-auto">{JSON.stringify(event.data, null, 2)}</pre> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

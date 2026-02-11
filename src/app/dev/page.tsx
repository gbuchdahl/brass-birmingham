"use client";

import { useState } from "react";
import { createGame, reduce, type GameState } from "@/engine";
import type { Card } from "@/engine/cards";

export default function DevPage() {
  const [state, setState] = useState<GameState>(() =>
    createGame(["A", "B", "C", "D"]),
  );

  const describeCard = (card?: Card) => {
    if (!card) return "Unknown card";
    switch (card.kind) {
      case "Location":
        return `Location: ${card.payload?.city ?? "Unknown"}`;
      case "Industry":
        return `Industry: ${card.payload?.industry ?? "Unknown"}`;
      case "Wild":
        return "Wild Card";
      default:
        return card.id;
    }
  };

  return (
    <main className="min-h-screen space-y-6 bg-white p-6 text-gray-900 dark:bg-neutral-950 dark:text-gray-100">
      <h1 className="text-2xl font-semibold">Dev Sandbox</h1>

      <button
        className="rounded-lg border border-gray-300 px-3 py-2 font-medium transition hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-neutral-900"
        onClick={() =>
          setState((s) => reduce(s, { type: "END_TURN", player: s.currentPlayer }).state)
        }
      >
        End Turn (player {state.currentPlayer})
      </button>

      <section className="space-y-4">
        {state.seatOrder.map((playerId) => {
          const hand = state.players[playerId].hand;
          return (
            <div key={playerId} className="rounded-lg border border-gray-200 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
              <h2 className="text-lg font-semibold">Player {playerId}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Hand size: {hand.length}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {hand.map((cardId) => {
                  const card = state.deck.byId[cardId];
                  return (
                    <li
                      key={cardId}
                      className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200"
                    >
                      {describeCard(card)}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <pre className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-100 shadow-inner dark:bg-neutral-900 dark:text-neutral-100">
        {JSON.stringify(state, null, 2)}
      </pre>
    </main>
  );
}

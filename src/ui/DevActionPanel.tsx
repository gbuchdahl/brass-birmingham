import type { Action, GameState } from "@/engine";
import type { CityId, NodeId } from "@/engine/board/topology";
import { describeCard } from "@/engine/cards";

export type DevSelectionState = {
  from: string;
  to: string;
  cardId: string;
  city: string;
  industry: "coal" | "iron";
  level: number;
};

type DevActionPanelProps = {
  state: GameState;
  selection: DevSelectionState;
  onSelectionChange: (next: DevSelectionState) => void;
  onDispatch: (action: Action) => void;
};

export function DevActionPanel({
  state,
  selection,
  onSelectionChange,
  onDispatch,
}: DevActionPanelProps) {
  const nodes = [...state.board.topology.cities, ...state.board.topology.ports];
  const hand = state.players[state.currentPlayer].hand;

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Actions</h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">From</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={selection.from}
            onChange={(event) =>
              onSelectionChange({ ...selection, from: event.target.value })
            }
          >
            {nodes.map((node) => (
              <option key={`from-${node}`} value={node}>
                {node}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">To</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={selection.to}
            onChange={(event) =>
              onSelectionChange({ ...selection, to: event.target.value })
            }
          >
            {nodes.map((node) => (
              <option key={`to-${node}`} value={node}>
                {node}
              </option>
            ))}
          </select>
        </div>

        <button
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          onClick={() =>
            onDispatch({
              type: "BUILD_LINK",
              player: state.currentPlayer,
              from: selection.from as NodeId,
              to: selection.to as NodeId,
            })
          }
        >
          Build Link
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Card</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={selection.cardId}
            onChange={(event) =>
              onSelectionChange({ ...selection, cardId: event.target.value })
            }
          >
            {hand.map((cardId) => (
              <option key={cardId} value={cardId}>
                {cardId}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">City</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={selection.city}
            onChange={(event) =>
              onSelectionChange({ ...selection, city: event.target.value })
            }
          >
            {state.board.topology.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Industry</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={selection.industry}
            onChange={(event) =>
              onSelectionChange({
                ...selection,
                industry: event.target.value as "coal" | "iron",
              })
            }
          >
            <option value="coal">coal</option>
            <option value="iron">iron</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Level</label>
          <input
            className="w-16 rounded border border-gray-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            type="number"
            min={1}
            value={selection.level}
            onChange={(event) =>
              onSelectionChange({
                ...selection,
                level: Number(event.target.value) || 1,
              })
            }
          />
        </div>

        <button
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          onClick={() =>
            onDispatch({
              type: "BUILD_INDUSTRY",
              player: state.currentPlayer,
              city: selection.city as CityId,
              industry: selection.industry,
              level: selection.level,
              cardId: selection.cardId,
            })
          }
          disabled={hand.length === 0}
        >
          Build Industry
        </button>

        <button
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          onClick={() =>
            onDispatch({
              type: "END_TURN",
              player: state.currentPlayer,
            })
          }
        >
          End Turn
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">Quick card pick</p>
        <div className="flex flex-wrap gap-2">
          {hand.map((cardId) => {
            const card = state.deck.byId[cardId];
            const active = selection.cardId === cardId;
            return (
              <button
                key={`quick-${cardId}`}
                className={`rounded border px-2 py-1 text-xs ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200"
                    : "border-gray-300 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                }`}
                onClick={() => onSelectionChange({ ...selection, cardId })}
              >
                {cardId}: {describeCard(card)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import type { GameState, ReduceResult } from "@/engine";
import { describeCard } from "@/engine/cards";

type DevStatePanelProps = {
  state: GameState;
  lastResult: ReduceResult | null;
};

export function DevStatePanel({ state, lastResult }: DevStatePanelProps) {
  const latestInvalid = [...state.log].reverse().find((event) => event.type === "INVALID_ACTION");
  const recentLog = state.log.slice(Math.max(0, state.log.length - 10));

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">State</h2>

      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div>
          <p>
            <strong>Current:</strong> {state.currentPlayer}
          </p>
          <p>
            <strong>Turn:</strong> {state.turn}
          </p>
          <p>
            <strong>Phase:</strong> {state.phase}
          </p>
        </div>
        <div>
          <p>
            <strong>Coal Market:</strong> {state.market.coal.units} (fallback £{state.market.coal.fallbackPrice})
          </p>
          <p>
            <strong>Iron Market:</strong> {state.market.iron.units} (fallback £{state.market.iron.fallbackPrice})
          </p>
        </div>
        <div>
          <p>
            <strong>Last Reduce:</strong> {lastResult ? (lastResult.ok ? "ok" : `error:${lastResult.error.code}`) : "n/a"}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">Players</h3>
        <div className="space-y-1 rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
          {state.seatOrder.map((player) => (
            <div key={player}>
              <strong>{player}</strong> money £{state.players[player].money}, income {state.players[player].income}, hand [{state.players[player].hand.map((cardId) => describeCard(state.deck.byId[cardId])).join("; ")}]
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">Tiles</h3>
        <div className="max-h-40 space-y-1 overflow-auto rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
          {Object.values(state.board.tiles).map((tile) => (
            <div key={tile.id}>
              {tile.id}: {tile.city} {tile.industry} L{tile.level} owner={tile.owner ?? "-"} remaining={tile.resourcesRemaining} flipped={String(tile.flipped)}
            </div>
          ))}
          {Object.keys(state.board.tiles).length === 0 ? <p>No tiles</p> : null}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">Recent Log</h3>
        <div className="max-h-44 space-y-1 overflow-auto rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
          {recentLog.map((event) => (
            <div
              key={event.idx}
              className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{event.type}</span>
                <span className="text-gray-500">#{event.idx}</span>
              </div>
              {event.data ? (
                <pre className="mt-1 overflow-auto text-[11px]">{JSON.stringify(event.data, null, 2)}</pre>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">Latest Invalid Action</h3>
        <div className="rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
          {latestInvalid ? (
            <div className="space-y-1">
              <p>
                <strong>Code:</strong>{" "}
                {(latestInvalid.data as { code?: string })?.code ?? "unknown"}
              </p>
              <p>
                <strong>Message:</strong>{" "}
                {(latestInvalid.data as { message?: string })?.message ?? "unknown"}
              </p>
            </div>
          ) : (
            <p>No invalid actions yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

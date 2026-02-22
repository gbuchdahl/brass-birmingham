import { getLegalMoves, type GameState } from "@/engine";
import { describeCard } from "@/engine/cards";
import type { CardId } from "@/engine/cards";
import type { DevSelectionState } from "./DevActionPanel";

type DevLegalPanelProps = {
  state: GameState;
  onDispatchLink: (from: string, to: string) => void;
  onPrefillSelection: (next: Partial<DevSelectionState>) => void;
};

export function DevLegalPanel({
  state,
  onDispatchLink,
  onPrefillSelection,
}: DevLegalPanelProps) {
  const legalMoves = getLegalMoves(state, state.currentPlayer);
  const hand = state.players[state.currentPlayer].hand;

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Legal / Assist</h2>

      <div>
        <h3 className="mb-2 text-sm font-medium">Legal Link Moves ({legalMoves.length})</h3>
        <div className="max-h-40 space-y-1 overflow-auto rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
          {legalMoves.map((move, index) => {
            if (move.type !== "BUILD_LINK") {
              return null;
            }
            return (
              <div key={`${move.from}-${move.to}-${index}`} className="flex items-center justify-between gap-2">
                <span>
                  {move.from} - {move.to}
                </span>
                <div className="space-x-1">
                  <button
                    className="rounded border border-gray-300 px-2 py-0.5 dark:border-neutral-700"
                    onClick={() => onPrefillSelection({ from: move.from, to: move.to })}
                  >
                    Prefill
                  </button>
                  <button
                    className="rounded border border-gray-300 px-2 py-0.5 dark:border-neutral-700"
                    onClick={() => onDispatchLink(move.from, move.to)}
                  >
                    Run
                  </button>
                </div>
              </div>
            );
          })}
          {legalMoves.length === 0 ? <p>No legal link moves.</p> : null}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Current Hand ({hand.length})</h3>
        <div className="max-h-40 space-y-1 overflow-auto rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
          {hand.map((cardId: CardId) => {
            const card = state.deck.byId[cardId];
            return (
              <div key={cardId} className="flex items-center justify-between gap-2">
                <span>
                  {cardId}: {describeCard(card)}
                </span>
                <button
                  className="rounded border border-gray-300 px-2 py-0.5 dark:border-neutral-700"
                  onClick={() => onPrefillSelection({ cardId })}
                >
                  Use
                </button>
              </div>
            );
          })}
          {hand.length === 0 ? <p>No cards in hand.</p> : null}
        </div>
      </div>
    </section>
  );
}

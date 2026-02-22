import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import { withSingleCardInHand } from "@/tests/engine/helpers";

describe("invariants", () => {
  it("keeps tile flip/resource states consistent", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "invariant-industry-build"), "A", {
      id: "wild",
      kind: "Wild",
    });

    const result = reduce(state, {
      type: "BUILD_INDUSTRY",
      player: "A",
      city: "Stafford",
      industry: "coal",
      level: 1,
      cardId: "wild",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const tile of Object.values(result.state.board.tiles)) {
      if (tile.resourcesRemaining === 0) {
        expect(tile.flipped).toBe(true);
      }
      if (tile.resourcesRemaining > 0) {
        expect(tile.flipped).toBe(false);
      }
    }
  });

  it("preserves card-zone conservation after BUILD_INDUSTRY", () => {
    const state = withSingleCardInHand(createGame(["A", "B"], "invariant-card-zones"), "A", {
      id: "wild-2",
      kind: "Wild",
    });

    const cardIdsBefore = new Set<string>([
      ...state.players.A.hand,
      ...state.players.B.hand,
      ...state.deck.draw,
      ...state.deck.discard,
      ...state.deck.removed,
    ]);

    const result = reduce(state, {
      type: "BUILD_INDUSTRY",
      player: "A",
      city: "Stafford",
      industry: "coal",
      level: 1,
      cardId: "wild-2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cardIdsAfter = new Set<string>([
      ...result.state.players.A.hand,
      ...result.state.players.B.hand,
      ...result.state.deck.draw,
      ...result.state.deck.discard,
      ...result.state.deck.removed,
    ]);

    expect(cardIdsAfter).toEqual(cardIdsBefore);
  });
});

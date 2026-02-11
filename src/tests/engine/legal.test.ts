import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import { getLegalMoves } from "@/engine/legal";

describe("getLegalMoves", () => {
  it("returns build-link actions for the active player", () => {
    const state = createGame(["A", "B"], "legal-moves-active");
    const moves = getLegalMoves(state, "A");

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.type === "BUILD_LINK")).toBe(true);
    expect(
      moves.every(
        (move) =>
          move.type === "BUILD_LINK" &&
          move.player === "A",
      ),
    ).toBe(true);
  });

  it("returns no moves for inactive players", () => {
    const state = createGame(["A", "B"], "legal-moves-inactive");
    const moves = getLegalMoves(state, "B");
    expect(moves).toEqual([]);
  });

  it("shrinks available link moves after a successful build", () => {
    const state = createGame(["A", "B"], "legal-moves-shrink");
    const initialMoves = getLegalMoves(state, "A");
    expect(initialMoves.length).toBeGreaterThan(0);

    const first = initialMoves[0];
    if (first.type !== "BUILD_LINK") return;

    const next = reduce(state, first);
    const nextMoves = getLegalMoves(next, "A");

    expect(nextMoves.length).toBe(initialMoves.length - 1);
    expect(
      nextMoves.some(
        (move) =>
          move.type === "BUILD_LINK" &&
          move.from === first.from &&
          move.to === first.to,
      ),
    ).toBe(false);
  });
});

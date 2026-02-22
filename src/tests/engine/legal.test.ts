import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import { getLegalMoves } from "@/engine/legal";
import { isLegalLink } from "@/engine/board/api";

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
          move.player === "A" &&
          isLegalLink(state, move.from, move.to, state.phase),
      ),
    ).toBe(true);
  });

  it("returns no moves for inactive players", () => {
    const state = createGame(["A", "B"], "legal-moves-inactive");
    const moves = getLegalMoves(state, "B");
    expect(moves).toEqual([]);
  });

  it("respects current phase when enumerating legal links", () => {
    const state = {
      ...createGame(["A", "B"], "legal-moves-rail-phase"),
      phase: "rail" as const,
    };
    const moves = getLegalMoves(state, "A");
    expect(moves.length).toBeGreaterThan(0);
    expect(
      moves.every(
        (move) =>
          move.type === "BUILD_LINK" &&
          isLegalLink(state, move.from, move.to, "rail"),
      ),
    ).toBe(true);
    expect(
      moves.some(
        (move) =>
          move.type === "BUILD_LINK" &&
          !isLegalLink(state, move.from, move.to, "canal"),
      ),
    ).toBe(true);
  });

  it("shrinks available link moves after a successful build", () => {
    const state = { ...createGame(["A", "B"], "legal-moves-shrink"), round: 2 };
    const initialMoves = getLegalMoves(state, "A");
    expect(initialMoves.length).toBeGreaterThan(0);

    const first = initialMoves[0];
    expect(first.type).toBe("BUILD_LINK");
    if (first.type !== "BUILD_LINK") {
      throw new Error("Expected BUILD_LINK move for active player");
    }

    const result = reduce(state, first);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`Expected BUILD_LINK to be valid, got ${result.error.code}`);
    }
    const nextMoves = getLegalMoves(result.state, "A");

    expect(nextMoves.length).toBeLessThan(initialMoves.length);
    expect(nextMoves.length).toBeGreaterThan(0);
    expect(
      nextMoves.some(
        (move) =>
          move.type === "BUILD_LINK" &&
          ((move.from === first.from && move.to === first.to) ||
            (move.from === first.to && move.to === first.from)),
      ),
    ).toBe(false);
    expect(
      nextMoves.every(
        (move) =>
          move.type === "BUILD_LINK" &&
          (move.from === first.from ||
            move.from === first.to ||
            move.to === first.from ||
            move.to === first.to),
      ),
    ).toBe(true);
  });
});

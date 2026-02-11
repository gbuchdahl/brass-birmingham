import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";

describe("invariants", () => {
  it("keeps tile flip/resource states consistent", () => {
    const base = createGame(["A", "B"], "invariant-flip-state");
    const withTile = {
      ...base,
      phase: "rail" as const,
      board: {
        ...base.board,
        tiles: {
          "tile-coal-nuneaton": {
            id: "tile-coal-nuneaton",
            city: "Nuneaton",
            industry: "coal" as const,
            owner: "A",
            level: 1,
            resourcesRemaining: 1,
            incomeOnFlip: 1,
            flipped: false,
          },
        },
      },
    };
    const result = reduce(withTile, {
      type: "BUILD_LINK",
      player: "A",
      from: "Coventry",
      to: "Nuneaton",
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
});

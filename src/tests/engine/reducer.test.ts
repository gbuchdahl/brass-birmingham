import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";

describe("reduce", () => {
  it("cycles to the next player on END_TURN", () => {
    const state = createGame(["A", "B", "C"]);

    const next = reduce(state, { type: "END_TURN", player: state.currentPlayer });

    expect(next.currentPlayer).toBe("B");
    expect(next.turn).toBe(state.turn + 1);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "END_TURN",
      data: { from: "A", to: "B" },
    });
  });

  it("ignores END_TURN from the wrong player", () => {
    const state = createGame(["A", "B"]);

    const next = reduce(state, { type: "END_TURN", player: "B" });

    expect(next).toBe(state);
  });
});

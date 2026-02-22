import { describe, expect, it } from "vitest";
import { createGame, reduce } from "@/engine";
import { makeTile, withTiles } from "./helpers";
import { expectInvalid, expectOk } from "./reducer.shared";

describe("reduce END_TURN", () => {
  it("deals the correct number of cards to each player and starts with 17 money", () => {
    const seats = ["A", "B", "C", "D"] as const;
    const state = createGame([...seats], "test-seed");

    for (const seat of seats) {
      expect(state.players[seat].hand).toHaveLength(8);
      expect(state.players[seat].money).toBe(17);
    }
  });

  it("cycles to the next player on END_TURN", () => {
    const state = createGame(["A", "B", "C"]);
    const next = expectOk(reduce(state, { type: "END_TURN", player: state.currentPlayer }));

    expect(next.currentPlayer).toBe("B");
    expect(next.turn).toBe(state.turn + 1);
    expect(next.log[next.log.length - 1]).toMatchObject({
      type: "END_TURN",
      data: { from: "A", to: "B" },
    });
  });

  it("rejects END_TURN from the wrong player", () => {
    const state = createGame(["A", "B"]);
    const next = expectInvalid(reduce(state, { type: "END_TURN", player: "B" }), state, "NOT_CURRENT_PLAYER");

    expect(next.turn).toBe(state.turn);
    expect(next.currentPlayer).toBe(state.currentPlayer);
  });

  it("returns INVALID_TILE_FLIP_STATE for malformed tile data", () => {
    const base = createGame(["A", "B"], "bad-tile-invariant");
    const badState = withTiles(base, {
      "tile-bad": makeTile("tile-bad", {
        city: "Stafford",
        industry: "coal",
        resourcesRemaining: 0,
        flipped: false,
      }),
    });

    expectInvalid(
      reduce(badState, { type: "END_TURN", player: "A" }),
      badState,
      "INVALID_TILE_FLIP_STATE",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  actionsPerTurn,
  createRoundSpendLedger,
  determineNextTurnOrder,
  nextSeat,
  recordRoundSpending,
} from "@/engine/lifecycle";

describe("round action budgets", () => {
  it("gives one action only in the first Canal round", () => {
    expect(actionsPerTurn("canal", 1)).toBe(1);
    expect(actionsPerTurn("canal", 2)).toBe(2);
    expect(actionsPerTurn("canal", 10)).toBe(2);
  });

  it("gives two actions in every Rail round", () => {
    expect(actionsPerTurn("rail", 1)).toBe(2);
    expect(actionsPerTurn("rail", 8)).toBe(2);
  });

  it("rejects invalid rounds and eras", () => {
    expect(() => actionsPerTurn("canal", 0)).toThrow(RangeError);
    expect(() => actionsPerTurn("canal", 1.5)).toThrow(RangeError);
    expect(() => actionsPerTurn("steam" as never, 1)).toThrow(RangeError);
  });
});

describe("round spending and turn order", () => {
  it("starts every seat at zero without mutating the input", () => {
    const seats = Object.freeze(["a", "b", "c"]);
    const ledger = createRoundSpendLedger(seats);

    expect(ledger).toEqual({ a: 0, b: 0, c: 0 });
    expect(seats).toEqual(["a", "b", "c"]);
  });

  it("records cumulative spend immutably", () => {
    const initial = createRoundSpendLedger(["a", "b"]);
    const once = recordRoundSpending(initial, "a", 3);
    const twice = recordRoundSpending(once, "a", 5);

    expect(initial.a).toBe(0);
    expect(once.a).toBe(3);
    expect(twice.a).toBe(8);
  });

  it("orders least spent first", () => {
    const order = ["a", "b", "c", "d"];
    const ledger = { a: 8, b: 0, c: 5, d: 2 };

    expect(determineNextTurnOrder(order, ledger)).toEqual(["b", "d", "c", "a"]);
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("preserves relative prior order for tied spend", () => {
    const order = ["carol", "alice", "dave", "bob"];
    const ledger = { carol: 4, alice: 1, dave: 4, bob: 1 };

    expect(determineNextTurnOrder(order, ledger)).toEqual([
      "alice",
      "bob",
      "carol",
      "dave",
    ]);
  });

  it("supports object-prototype-looking seat IDs safely", () => {
    const seats = ["__proto__", "constructor"];
    const ledger = recordRoundSpending(createRoundSpendLedger(seats), "__proto__", 2);

    expect(Object.hasOwn(ledger, "__proto__")).toBe(true);
    expect(determineNextTurnOrder(seats, ledger)).toEqual(["constructor", "__proto__"]);
  });

  it("rejects malformed ledgers and spending", () => {
    const ledger = createRoundSpendLedger(["a", "b"]);
    expect(() => recordRoundSpending(ledger, "c", 1)).toThrow(/Unknown seat/);
    expect(() => recordRoundSpending(ledger, "a", -1)).toThrow(RangeError);
    expect(() => determineNextTurnOrder(["a", "b"], { a: 0 })).toThrow(/exactly/);
    expect(() => determineNextTurnOrder(["a", "b"], { a: 0, b: -1 })).toThrow(RangeError);
  });
});

describe("seat advancement", () => {
  it("advances within a round", () => {
    expect(nextSeat(["a", "b", "c"], "a")).toEqual({
      seat: "b",
      roundComplete: false,
    });
  });

  it("wraps and marks the round complete after the last seat", () => {
    expect(nextSeat(["a", "b", "c"], "c")).toEqual({
      seat: "a",
      roundComplete: true,
    });
  });

  it("rejects a current seat outside the order", () => {
    expect(() => nextSeat(["a", "b"], "c")).toThrow(/not in turn order/);
  });
});

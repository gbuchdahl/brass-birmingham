import { describe, expect, it } from "vitest";
import { createGameV2 } from "@/engine/game-v2/state";
import {
  createHotseatSession,
  revealHotseatHand,
  setHotseatDraft,
  submitHotseatCommand,
  toHotseatViewModel,
} from "@/ui/hotseat-session";
import {
  automaticHotseatLiquidationChoices,
  hotseatCardDraft,
  hotseatCardLabel,
  selectedHotseatCardId,
  toHotseatPrototypeModel,
} from "@/ui/hotseat-prototype-model";

describe("hot-seat prototype presentation model", () => {
  it("projects a privacy-safe handoff and a labeled revealed hand", () => {
    const state = createGameV2(["alice", "bob"], "prototype-handoff");
    const session = createHotseatSession(state);
    const handoff = toHotseatPrototypeModel(toHotseatViewModel(session));

    expect(handoff.handoff).toEqual({ nextSeat: "alice" });
    expect(handoff.private).toBeNull();
    for (const cardId of Object.values(state.cards.hands).flat()) {
      expect(JSON.stringify(handoff)).not.toContain(cardId);
    }

    const revealed = toHotseatPrototypeModel(
      toHotseatViewModel(revealHotseatHand(session)),
    );
    expect(revealed.handoff).toBeNull();
    expect(revealed.private?.cards.map((card) => card.id)).toEqual(
      state.cards.hands.alice,
    );
    expect(revealed.private?.cards.every((card) => card.label.length > 0)).toBe(true);
    for (const cardId of state.cards.hands.bob) {
      expect(JSON.stringify(revealed.private)).not.toContain(cardId);
    }
  });

  it("round-trips a selected card through the opaque UI draft", () => {
    const state = createGameV2(["alice", "bob"], "prototype-draft");
    const cardId = state.cards.hands.alice[0];
    const draft = hotseatCardDraft(cardId, "LOAN");
    expect(draft).toEqual({ commandType: "LOAN", fields: { cardId } });
    expect(selectedHotseatCardId(draft)).toBe(cardId);
    expect(selectedHotseatCardId(null)).toBeNull();
    expect(hotseatCardLabel("wild-location")).toBe("Wild location");
  });

  it("maps a typed rejection to alert-ready feedback without losing selection", () => {
    const state = createGameV2(["alice", "bob"], "prototype-error");
    const revealed = revealHotseatHand(createHotseatSession(state));
    const selected = setHotseatDraft(
      revealed,
      hotseatCardDraft(state.cards.hands.alice[0]),
    );
    const rejected = submitHotseatCommand(selected, {
      type: "PASS",
      cardId: "missing-card" as typeof state.cards.hands.alice[number],
    });
    const model = toHotseatPrototypeModel(toHotseatViewModel(rejected));

    expect(model.feedback).toMatchObject({
      kind: "error",
      source: "action",
      code: "CARD_NOT_IN_HAND",
    });
    expect(model.private?.selectedCardId).toBe(state.cards.hands.alice[0]);
  });

  it("summarizes an accepted Pass and exposes only public event types", () => {
    const state = createGameV2(["alice", "bob"], "prototype-pass");
    const accepted = submitHotseatCommand(
      revealHotseatHand(createHotseatSession(state)),
      { type: "PASS", cardId: state.cards.hands.alice[0] },
    );
    const model = toHotseatPrototypeModel(toHotseatViewModel(accepted));

    expect(model.feedback).toMatchObject({
      kind: "accepted",
      message: expect.stringContaining("PASS accepted"),
    });
    expect(model.handoff).toEqual({ nextSeat: "bob" });
    expect(model.public.recentEvents.map((event) => event.type).slice(-2)).toEqual([
      "ACTION_ACCEPTED",
      "COMMAND_APPLIED",
    ]);
    expect(model.private).toBeNull();
  });

  it("projects the round-settlement Continue boundary after every first-round seat acts", () => {
    const state = createGameV2(["alice", "bob"], "prototype-boundary");
    const alice = submitHotseatCommand(
      revealHotseatHand(createHotseatSession(state)),
      { type: "PASS", cardId: state.cards.hands.alice[0] },
    );
    const bob = submitHotseatCommand(revealHotseatHand(alice), {
      type: "PASS",
      cardId: alice.state.cards.hands.bob[0],
    });
    const model = toHotseatPrototypeModel(toHotseatViewModel(bob));

    expect(model.boundary).toEqual({
      kind: "round_settlement",
      automaticLiquidationChoices: {},
    });
    expect(model.handoff).toBeNull();
    expect(model.private).toBeNull();
  });

  it("supplies explicit empty choices for negative income that cash can cover", () => {
    const state = createGameV2(["alice", "bob"], "prototype-loan-settlement");
    const loaned = submitHotseatCommand(
      revealHotseatHand(createHotseatSession(state)),
      { type: "LOAN", cardId: state.cards.hands.alice[0] },
    );
    const bob = submitHotseatCommand(revealHotseatHand(loaned), {
      type: "PASS",
      cardId: loaned.state.cards.hands.bob[0],
    });
    const model = toHotseatPrototypeModel(toHotseatViewModel(bob));

    expect(model.boundary).toEqual({
      kind: "round_settlement",
      automaticLiquidationChoices: { alice: [] },
    });
    expect(automaticHotseatLiquidationChoices(model.public)).toEqual({
      alice: [],
    });
  });
});

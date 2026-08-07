import { describe, expect, it } from "vitest";
import { WILD_LOCATION_CARD_ID } from "@/engine/cards-v2";
import { highestSpaceForIncomeLevel } from "@/engine/economy/income";
import { createGameV2, type GameStateV2 } from "@/engine/game-v2/state";
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
  legalHotseatScoutTriple,
  normalizeHotseatNetworkLinkId,
  normalizeHotseatScoutSelection,
  selectHotseatActionCard,
  selectHotseatNetworkLink,
  selectedHotseatCardId,
  selectedHotseatNetworkCommand,
  selectedHotseatNetworkLinkId,
  selectedHotseatScoutCardIds,
  toggleHotseatScoutCard,
  toHotseatPrototypeModel,
} from "@/ui/hotseat-prototype-model";

describe("hot-seat prototype presentation model", () => {
  it("projects a privacy-safe handoff and a labeled revealed hand", () => {
    const state = createGameV2(["alice", "bob"], "prototype-handoff");
    const session = createHotseatSession(state);
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(handoff.handoff).toEqual({ nextSeat: "alice" });
    expect(handoff.private).toBeNull();
    for (const cardId of Object.values(state.cards.hands).flat()) {
      expect(JSON.stringify(handoff)).not.toContain(cardId);
    }

    const revealed = toHotseatPrototypeModel(
      toHotseatViewModel(revealHotseatHand(session)),
      session.state,
    );
    expect(revealed.handoff).toBeNull();
    expect(revealed.private?.cards.map((card) => card.id)).toEqual(
      state.cards.hands.alice,
    );
    expect(revealed.private?.cards.every((card) => card.label.length > 0)).toBe(true);
    expect(revealed.private?.legal.network.availability).toBe("exact");
    expect(revealed.private?.legal.network.links.length).toBeGreaterThan(0);
    for (const link of revealed.private?.legal.network.links ?? []) {
      expect(JSON.stringify(handoff)).not.toContain(link.linkId);
    }
    for (const cardId of state.cards.hands.bob) {
      expect(JSON.stringify(revealed.private)).not.toContain(cardId);
    }
  });

  it("projects exact Canal endpoints and costs only into the revealed model", () => {
    const state = createGameV2(["alice", "bob"], "prototype-network-options");
    const hidden = createHotseatSession(state);
    const revealed = revealHotseatHand(hidden);
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(revealed),
      revealed.state,
    );

    expect(model.private?.legal.network).toMatchObject({
      availability: "exact",
      selectedCardIsLegal: false,
      selectionIsLegal: false,
      reason: null,
    });
    expect(model.private?.legal.network.links.length).toBeGreaterThan(0);
    expect(model.private?.legal.network.links.every((link) =>
      link.endpointLabel.includes(" ↔ ") &&
      link.cost === 3 &&
      link.selection.linkIds[0] === link.linkId &&
      link.selection.coalSources.length === 0 &&
      link.selection.beerSourceId === null
    )).toBe(true);
    expect(model.private?.cards.every((card) => card.canNetwork)).toBe(true);
  });

  it("normalizes a Network link draft against exact selector choices", () => {
    const selectable = ["link-a", "link-b"];
    const selected = selectHotseatNetworkLink(null, "link-b", selectable);

    expect(selected).toEqual({
      commandType: "NETWORK",
      fields: { networkLinkId: "link-b" },
    });
    expect(selectedHotseatNetworkLinkId(selected)).toBe("link-b");
    expect(normalizeHotseatNetworkLinkId("link-b", selectable)).toBe("link-b");
    expect(normalizeHotseatNetworkLinkId("stale-link", selectable)).toBeNull();
    expect(selectedHotseatNetworkLinkId(
      selectHotseatNetworkLink(selected, "stale-link", selectable),
    )).toBeNull();

    const state = createGameV2(["alice", "bob"], "prototype-network-stale");
    const session = setHotseatDraft(
      revealHotseatHand(createHotseatSession(state)),
      {
        commandType: "NETWORK",
        fields: {
          cardId: state.cards.hands.alice[0],
          networkLinkId: "stale-link",
        },
      },
    );
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    expect(model.private?.selectedNetworkLinkId).toBeNull();
    expect(model.private?.legal.network).toMatchObject({
      selectedCardIsLegal: true,
      selectionIsLegal: false,
    });
  });

  it("accepts an exact initial Canal Network selection and returns to handoff", () => {
    const state = createGameV2(["alice", "bob"], "prototype-network-success");
    const originalHand = state.cards.hands.alice;
    const originalPlayer = state.players.alice;
    let session = revealHotseatHand(createHotseatSession(state));
    session = setHotseatDraft(
      session,
      selectHotseatActionCard(session.draft, originalHand[0]),
    );
    let model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    const firstLink = model.private?.legal.network.links[0];
    if (firstLink === undefined) throw new Error("Expected an initial Canal link");
    session = setHotseatDraft(
      session,
      selectHotseatNetworkLink(
        session.draft,
        firstLink.linkId,
        model.private?.legal.network.links.map((link) => link.linkId) ?? [],
      ),
    );
    model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    const command = model.private === null
      ? null
      : selectedHotseatNetworkCommand(model.private);
    if (command === null) throw new Error("Expected a ready Network command");

    expect(command).toEqual({
      type: "NETWORK",
      selection: {
        ...firstLink.selection,
        cardId: originalHand[0],
      },
    });
    const accepted = submitHotseatCommand(session, command);
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );

    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.players.alice.money).toBe(originalPlayer.money - 3);
    expect(accepted.state.players.alice.linkTokensRemaining).toBe(
      originalPlayer.linkTokensRemaining - 1,
    );
    expect(accepted.state.board.builtLinks[firstLink.linkId]).toBe("alice");
    expect(accepted.state.cards.hands.alice).not.toContain(originalHand[0]);
    expect(accepted.state.cards.discard).toContain(originalHand[0]);
    expect(accepted.state.cards.hands.alice).toHaveLength(originalHand.length);
    expect(accepted.state.cards.draw).toHaveLength(state.cards.draw.length - 1);
    expect(handoff.feedback).toMatchObject({
      kind: "accepted",
      message: expect.stringContaining("NETWORK accepted"),
    });
    expect(handoff.handoff).toEqual({ nextSeat: "bob" });
    expect(handoff.private).toBeNull();
  });

  it("surfaces the exact Canal Network blocker and exposes no target controls", () => {
    const base = createGameV2(["alice", "bob"], "prototype-network-blocker");
    const state: GameStateV2 = {
      ...base,
      players: {
        ...base.players,
        alice: { ...base.players.alice, money: 2 },
      },
    };
    const session = revealHotseatHand(createHotseatSession(state));
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(model.private?.legal.network).toMatchObject({
      availability: "disabled",
      selectedCardIsLegal: false,
      selectionIsLegal: false,
      links: [],
      reason: {
        code: "INSUFFICIENT_NETWORK_MONEY",
        message: "A Canal Network action costs £3.",
      },
    });
    expect(model.private?.cards.every((card) => !card.canNetwork)).toBe(true);
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

  it("normalizes and toggles Scout selections in selector order with a hard limit of three", () => {
    const state = createGameV2(["alice", "bob"], "prototype-scout-draft");
    const selectable = state.cards.hands.alice;
    const missing = "missing-card" as typeof selectable[number];

    expect(normalizeHotseatScoutSelection([
      selectable[3],
      selectable[1],
      selectable[1],
      missing,
      selectable[0],
      selectable[2],
    ], selectable)).toEqual(selectable.slice(0, 3));

    let draft = toggleHotseatScoutCard(null, selectable[2], selectable);
    draft = toggleHotseatScoutCard(draft, selectable[0], selectable);
    draft = toggleHotseatScoutCard(draft, selectable[1], selectable);
    draft = toggleHotseatScoutCard(draft, selectable[3], selectable);
    expect(selectedHotseatScoutCardIds(draft)).toEqual(selectable.slice(0, 3));
    expect(legalHotseatScoutTriple(
      selectedHotseatScoutCardIds(draft),
      [selectable.slice(0, 3) as [
        typeof selectable[number],
        typeof selectable[number],
        typeof selectable[number],
      ]],
    )).toEqual(selectable.slice(0, 3));

    draft = toggleHotseatScoutCard(draft, selectable[1], selectable);
    expect(selectedHotseatScoutCardIds(draft)).toEqual([
      selectable[0],
      selectable[2],
    ]);
  });

  it("uses exact selector card IDs for Pass and Loan and surfaces the Loan floor", () => {
    const base = createGameV2(["alice", "bob"], "prototype-loan-legality");
    const state: GameStateV2 = {
      ...base,
      players: {
        ...base.players,
        alice: {
          ...base.players.alice,
          incomeMarkerSpace: highestSpaceForIncomeLevel(-8),
        },
      },
    };
    const session = setHotseatDraft(
      revealHotseatHand(createHotseatSession(state)),
      hotseatCardDraft(state.cards.hands.alice[0]),
    );
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(model.private?.legal.pass).toEqual({
      selectedIsLegal: true,
      reason: null,
    });
    expect(model.private?.legal.loan).toMatchObject({
      selectedIsLegal: false,
      reason: { code: "LOAN_INCOME_FLOOR" },
    });
    expect(model.private?.cards.every((card) => card.canPass)).toBe(true);
    expect(model.private?.cards.every((card) => !card.canLoan)).toBe(true);
  });

  it("surfaces the selector's specific Scout blocker without enabling card toggles", () => {
    const base = createGameV2(["alice", "bob"], "prototype-scout-blocked");
    const returnedCard = base.cards.hands.alice[0] as
      GameStateV2["cards"]["discard"][number];
    const state: GameStateV2 = {
      ...base,
      cards: {
        ...base.cards,
        hands: {
          ...base.cards.hands,
          alice: [
            ...base.cards.hands.alice.slice(1),
            WILD_LOCATION_CARD_ID,
          ],
        },
        discard: [...base.cards.discard, returnedCard],
        wildSupplies: {
          ...base.cards.wildSupplies,
          location: base.cards.wildSupplies.location - 1,
        },
      },
    };
    const session = revealHotseatHand(createHotseatSession(state));
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(model.private?.legal.scout).toMatchObject({
      selectionIsLegal: false,
      reason: { code: "WILD_CARD_IN_HAND" },
    });
    expect(model.private?.cards.every((card) => !card.canScout)).toBe(true);
  });

  it("accepts a selector-approved Scout, grants both Wilds, then returns to private handoff", () => {
    const state = createGameV2(["alice", "bob"], "prototype-scout-success");
    const revealed = revealHotseatHand(createHotseatSession(state));
    const selectable = state.cards.hands.alice;
    let selected = setHotseatDraft(
      revealed,
      toggleHotseatScoutCard(null, selectable[0], selectable),
    );
    selected = setHotseatDraft(
      selected,
      toggleHotseatScoutCard(selected.draft, selectable[1], selectable),
    );
    selected = setHotseatDraft(
      selected,
      toggleHotseatScoutCard(selected.draft, selectable[2], selectable),
    );
    const ready = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    expect(ready.private?.legal.scout.selectionIsLegal).toBe(true);

    const [first, second, third] = ready.private?.selectedScoutCardIds ?? [];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("Expected a complete Scout selection");
    }
    const accepted = submitHotseatCommand(selected, {
      type: "SCOUT",
      selection: { cardsToDiscard: [first, second, third] },
    });
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );

    expect(accepted.acceptedCommands.at(-1)?.command).toEqual({
      type: "SCOUT",
      selection: { cardsToDiscard: selectable.slice(0, 3) },
    });
    expect(accepted.state.cards.hands.alice).toHaveLength(selectable.length);
    expect(accepted.state.cards.hands.alice).toEqual(expect.arrayContaining([
      ...selectable.slice(3),
      "wild-location",
      "wild-industry",
    ]));
    expect(accepted.state.cards.discard).toEqual(expect.arrayContaining(
      selectable.slice(0, 3),
    ));
    expect(handoff.feedback).toMatchObject({
      kind: "accepted",
      message: expect.stringContaining("SCOUT accepted"),
    });
    expect(handoff.handoff).toEqual({ nextSeat: "bob" });
    expect(handoff.private).toBeNull();
    for (const cardId of accepted.state.cards.hands.alice) {
      expect(JSON.stringify(handoff)).not.toContain(cardId);
    }
  });

  it("retains a legal Scout draft when a malformed Scout command is rejected", () => {
    const state = createGameV2(["alice", "bob"], "prototype-scout-rejected");
    const selectable = state.cards.hands.alice;
    const legalDraft = {
      commandType: "SCOUT" as const,
      fields: { cardsToDiscard: selectable.slice(0, 3) },
    };
    const selected = setHotseatDraft(
      revealHotseatHand(createHotseatSession(state)),
      legalDraft,
    );
    const rejected = submitHotseatCommand(selected, {
      type: "SCOUT",
      selection: {
        cardsToDiscard: [selectable[0], selectable[0], selectable[2]],
      },
    });
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(rejected),
      rejected.state,
    );

    expect(rejected.state).toBe(state);
    expect(rejected.draft).toBe(legalDraft);
    expect(model.feedback).toMatchObject({
      kind: "error",
      source: "action",
      code: "INVALID_SCOUT_DISCARD",
    });
    expect(model.private?.selectedScoutCardIds).toEqual(selectable.slice(0, 3));
    expect(model.private?.legal.scout.selectionIsLegal).toBe(true);
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
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(rejected),
      rejected.state,
    );

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
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );

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
    const model = toHotseatPrototypeModel(toHotseatViewModel(bob), bob.state);

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
    const model = toHotseatPrototypeModel(toHotseatViewModel(bob), bob.state);

    expect(model.boundary).toEqual({
      kind: "round_settlement",
      automaticLiquidationChoices: { alice: [] },
    });
    expect(automaticHotseatLiquidationChoices(model.public)).toEqual({
      alice: [],
    });
  });
});

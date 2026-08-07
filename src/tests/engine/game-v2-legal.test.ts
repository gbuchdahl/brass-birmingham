import { describe, expect, it } from "vitest";
import {
  WILD_LOCATION_CARD_ID,
} from "@/engine/cards-v2";
import { executeGameV2Command } from "@/engine/game-v2/commands";
import { resolveGameEra } from "@/engine/game-v2/era-lifecycle";
import { getGameV2LegalOptions } from "@/engine/game-v2/legal";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import { highestSpaceForIncomeLevel } from "@/engine/economy/income";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import { WILD_CARD_SUPPLY } from "@/engine/rules/generated/cards";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";

function requireValid(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
  expect(validation).toMatchObject({ ok: true });
}

function pendingFreeDevelop(state: GameStateV2): GameStateV2 {
  const merchant = state.merchants.spaces.find((space) => {
    const location = BOARD_V2.locations[
      space.locationId as keyof typeof BOARD_V2.locations
    ];
    return (
      space.active &&
      space.beer === 1 &&
      location.kind === "merchant" &&
      location.merchantBonus.kind === "free_develop"
    );
  });
  if (!merchant) throw new Error("Expected an active Gloucester Merchant");
  const pending: GameStateV2 = {
    ...state,
    progress: {
      phase: "merchant_free_develop",
      pending: {
        seat: state.currentSeat,
        count: 1,
        source: "merchant_bonus",
        merchantSpaceIds: [merchant.merchantSpaceId],
      },
    },
    merchants: {
      ...state.merchants,
      spaces: state.merchants.spaces.map((space) =>
        space.merchantSpaceId === merchant.merchantSpaceId
          ? { ...space, beer: 0 }
          : space
      ),
    },
  };
  requireValid(pending);
  return pending;
}

function completeFirstRound(state: GameStateV2): GameStateV2 {
  let current = state;
  for (const commandId of ["pass-first", "pass-second"]) {
    const seat = current.currentSeat;
    const result = executeGameV2Command(current, {
      schemaVersion: 1,
      commandId,
      gameId: current.gameId,
      expectedRevision: current.revision,
      actorSeat: seat,
      command: { type: "PASS", cardId: current.cards.hands[seat][0] },
    });
    if (!result.ok) throw new Error(result.error.message);
    current = result.state;
  }
  expect(current.progress.phase).toBe("round_settlement");
  return current;
}

function completedEraBoundary(
  state: GameStateV2,
  era: "canal" | "rail" = "canal",
): GameStateV2 {
  const playerCount = state.turnOrder.length as 2 | 3 | 4;
  const finalRound = SETUP_DATA.playerCounts[playerCount].roundsPerEra;
  const allRegularCards = [
    ...state.turnOrder.flatMap((seat) => state.cards.hands[seat]),
    ...state.cards.draw,
    ...state.cards.discard,
  ].filter(
    (cardId) => cardId !== "wild-location" && cardId !== "wild-industry",
  ) as GameStateV2["cards"]["discard"];
  const finalCard = allRegularCards.at(-1);
  const finalSeat = state.turnOrder.at(-1);
  if (!finalCard || !finalSeat) throw new Error("Expected final action fixtures");
  const beforeFinalAction: GameStateV2 = {
    ...state,
    era,
    round: finalRound,
    currentSeat: finalSeat,
    actionsUsed: 1,
    actionLimit: 2,
    progress: { phase: "action" },
    cards: {
      hands: Object.fromEntries(
        state.turnOrder.map((seat) => [
          seat,
          seat === finalSeat ? [finalCard] : [],
        ]),
      ),
      draw: [],
      discard: allRegularCards.slice(0, -1),
      wildSupplies: {
        location: WILD_CARD_SUPPLY.location,
        industry: WILD_CARD_SUPPLY.industry,
      },
    },
  };
  requireValid(beforeFinalAction);
  const accepted = executeGameV2Command(beforeFinalAction, {
    schemaVersion: 1,
    commandId: `final-${era}-pass`,
    gameId: beforeFinalAction.gameId,
    expectedRevision: beforeFinalAction.revision,
    actorSeat: finalSeat,
    command: { type: "PASS", cardId: finalCard },
  });
  if (!accepted.ok) throw new Error(accepted.error.message);
  const settled = executeGameV2Command(accepted.state, {
    schemaVersion: 1,
    commandId: `final-${era}-settlement`,
    gameId: accepted.state.gameId,
    expectedRevision: accepted.state.revision,
    actorSeat: null,
    command: { type: "SETTLE_ROUND", liquidationChoices: {} },
  });
  if (!settled.ok) throw new Error(settled.error.message);
  requireValid(settled.state);
  return settled.state;
}

function withBuiltCanalLinks(
  state: GameStateV2,
  entries: readonly (readonly [string, string])[],
): GameStateV2 {
  const counts = new Map<string, number>();
  for (const [, seat] of entries) {
    counts.set(seat, (counts.get(seat) ?? 0) + 1);
  }
  const linked: GameStateV2 = {
    ...state,
    players: Object.fromEntries(state.turnOrder.map((seat) => [
      seat,
      {
        ...state.players[seat],
        linkTokensRemaining:
          state.players[seat].linkTokensRemaining - (counts.get(seat) ?? 0),
      },
    ])),
    board: {
      ...state.board,
      builtLinks: Object.fromEntries(entries),
    },
  };
  requireValid(linked);
  return linked;
}

describe("GameStateV2 legal action selectors", () => {
  it("enumerates exact simple actions and labels complex actions attemptable", () => {
    const state = createGameV2(["alice", "bob"], "legal-initial");
    const options = getGameV2LegalOptions(state);

    expect(options.phase).toBe("action");
    expect(options.actorSeat).toBe("alice");
    expect(options.legalCommandKinds).toEqual([
      "BUILD",
      "NETWORK",
      "DEVELOP",
      "SELL",
      "LOAN",
      "SCOUT",
      "PASS",
    ]);
    expect(options.playerActions).toEqual([
      expect.objectContaining({ kind: "BUILD", availability: "attemptable" }),
      expect.objectContaining({ kind: "NETWORK", availability: "exact" }),
      expect.objectContaining({ kind: "DEVELOP", availability: "attemptable" }),
      expect.objectContaining({ kind: "SELL", availability: "attemptable" }),
      expect.objectContaining({ kind: "LOAN", availability: "exact" }),
      expect.objectContaining({ kind: "SCOUT", availability: "exact" }),
      expect.objectContaining({ kind: "PASS", availability: "exact" }),
    ]);
    expect(options.passCardIds).toEqual(state.cards.hands.alice);
    expect(options.passCardIds).not.toBe(state.cards.hands.alice);
    expect(options.loanCardIds).toEqual(state.cards.hands.alice);
    expect(options.scout.selectableRegularCardIds).toEqual(
      state.cards.hands.alice,
    );
    expect(options.scout.cardTriples).toHaveLength(56);
    expect(options.scout.cardTriples[0]).toEqual(
      state.cards.hands.alice.slice(0, 3),
    );
  });

  it("disables Loan exactly at the income floor without affecting Pass", () => {
    const base = createGameV2(["alice", "bob"], "legal-loan-floor");
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
    requireValid(state);

    const options = getGameV2LegalOptions(state);
    expect(options.loanCardIds).toEqual([]);
    expect(options.playerActions.find((action) => action.kind === "LOAN"))
      .toMatchObject({
        availability: "disabled",
        reason: { code: "LOAN_INCOME_FLOOR" },
      });
    expect(options.passCardIds).toEqual(state.cards.hands.alice);
    expect(options.legalCommandKinds).not.toContain("LOAN");
    expect(options.legalCommandKinds).toContain("PASS");
  });

  it("reports Scout blockers and never suggests an illegal triple", () => {
    const base = createGameV2(["alice", "bob"], "legal-scout-wild");
    const returnedCard = base.cards.hands.alice[0] as
      GameStateV2["cards"]["discard"][number];
    const holdingWild: GameStateV2 = {
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
    requireValid(holdingWild);
    const wildOptions = getGameV2LegalOptions(holdingWild);
    expect(wildOptions.scout).toMatchObject({
      cardTriples: [],
      reason: { code: "WILD_CARD_IN_HAND" },
    });
    expect(wildOptions.scout.selectableRegularCardIds).toHaveLength(7);

    const supplyBase = createGameV2(["alice", "bob"], "legal-scout-supply");
    const moved = supplyBase.cards.hands.bob.slice(0, 4) as
      GameStateV2["cards"]["discard"];
    const emptyLocationSupply: GameStateV2 = {
      ...supplyBase,
      cards: {
        ...supplyBase.cards,
        hands: {
          ...supplyBase.cards.hands,
          bob: [
            ...supplyBase.cards.hands.bob.slice(4),
            WILD_LOCATION_CARD_ID,
            WILD_LOCATION_CARD_ID,
            WILD_LOCATION_CARD_ID,
            WILD_LOCATION_CARD_ID,
          ],
        },
        discard: [...supplyBase.cards.discard, ...moved],
        wildSupplies: { ...supplyBase.cards.wildSupplies, location: 0 },
      },
    };
    requireValid(emptyLocationSupply);
    expect(getGameV2LegalOptions(emptyLocationSupply).scout).toMatchObject({
      cardTriples: [],
      reason: { code: "WILD_SUPPLY_EMPTY" },
    });

    const shortBase = createGameV2(["alice", "bob"], "legal-scout-short");
    const discarded = shortBase.cards.hands.alice.slice(0, 6) as
      GameStateV2["cards"]["discard"];
    const shortHand: GameStateV2 = {
      ...shortBase,
      cards: {
        ...shortBase.cards,
        hands: {
          ...shortBase.cards.hands,
          alice: shortBase.cards.hands.alice.slice(6),
        },
        discard: [...shortBase.cards.discard, ...discarded],
      },
    };
    requireValid(shortHand);
    expect(getGameV2LegalOptions(shortHand).scout).toMatchObject({
      selectableRegularCardIds: shortHand.cards.hands.alice,
      cardTriples: [],
      reason: { code: "INSUFFICIENT_SCOUT_CARDS" },
    });
  });

  it("disables every player action for the wrong actor or exhausted budget", () => {
    const state = createGameV2(["alice", "bob"], "legal-actor");
    const wrongActor = getGameV2LegalOptions(state, "bob");
    expect(wrongActor.legalCommandKinds).toEqual([]);
    expect(wrongActor.playerActions.every(
      (action) => action.reason?.code === "NOT_CURRENT_ACTOR",
    )).toBe(true);

    const exhausted: GameStateV2 = {
      ...state,
      actionsUsed: state.actionLimit,
    };
    requireValid(exhausted);
    const exhaustedOptions = getGameV2LegalOptions(exhausted);
    expect(exhaustedOptions.legalCommandKinds).toEqual([]);
    expect(exhaustedOptions.playerActions.every(
      (action) => action.reason?.code === "ACTION_LIMIT_REACHED",
    )).toBe(true);
  });

  it("enumerates exact initial Canal links and every option is reducer-accepted", () => {
    const state = createGameV2(["alice", "bob"], "legal-canal-network");
    const options = getGameV2LegalOptions(state);
    const expectedLinkIds = BOARD_V2.links
      .filter((link) => (link.eras as readonly string[]).includes("canal"))
      .map((link) => link.id);

    expect(options.network).toMatchObject({
      availability: "exact",
      selectableCardIds: state.cards.hands.alice,
      reason: null,
    });
    expect(options.network.canalLinks.map((option) => option.linkId)).toEqual(
      expectedLinkIds,
    );
    for (const option of options.network.canalLinks) {
      expect(option.adjacentLocations.every((location) => location.label.length > 0))
        .toBe(true);
      const result = executeGameV2Command(state, {
        schemaVersion: 1,
        commandId: `network-${option.linkId}`,
        gameId: state.gameId,
        expectedRevision: state.revision,
        actorSeat: state.currentSeat,
        command: {
          type: "NETWORK",
          selection: {
            ...option.selection,
            cardId: options.network.selectableCardIds[0],
          },
        },
      });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.outcome).toMatchObject({
        kind: "player_action",
        actionType: "NETWORK",
      });
      expect(result.state.board.builtLinks[option.linkId]).toBe("alice");
    }
  });

  it("restricts Canal links to the actor network and reports exact blockers", () => {
    const base = createGameV2(["alice", "bob"], "legal-network-blockers");
    const canalLinks = BOARD_V2.links.filter(
      (link) => (link.eras as readonly string[]).includes("canal"),
    );
    const anchor = canalLinks[0];
    const connected = withBuiltCanalLinks(base, [[anchor.id, "alice"]]);
    const connectedLocations = new Set(anchor.adjacentLocations);
    const expectedReachable = canalLinks
      .filter((link) =>
        link.id !== anchor.id &&
        link.adjacentLocations.some((location) => connectedLocations.has(location))
      )
      .map((link) => link.id);
    const connectedOptions = getGameV2LegalOptions(connected);
    expect(connectedOptions.network.canalLinks.map((option) => option.linkId))
      .toEqual(expectedReachable);
    expect(connectedOptions.network.canalLinks.map((option) => option.linkId))
      .not.toContain(anchor.id);

    const broke: GameStateV2 = {
      ...base,
      players: {
        ...base.players,
        alice: { ...base.players.alice, money: 2 },
      },
    };
    requireValid(broke);
    expect(getGameV2LegalOptions(broke).network).toMatchObject({
      availability: "disabled",
      reason: { code: "INSUFFICIENT_NETWORK_MONEY" },
    });

    const noTokens = withBuiltCanalLinks(
      base,
      canalLinks.slice(0, base.players.alice.linkTokensRemaining).map(
        (link) => [link.id, "alice"] as const,
      ),
    );
    expect(getGameV2LegalOptions(noTokens).network).toMatchObject({
      availability: "disabled",
      reason: { code: "NO_LINK_TOKENS" },
    });

    const incident = canalLinks.filter((link) =>
      link.adjacentLocations.some((location) => connectedLocations.has(location))
    );
    const surrounded = withBuiltCanalLinks(
      base,
      incident.map((link) => [
        link.id,
        link.id === anchor.id ? "alice" : "bob",
      ] as const),
    );
    expect(getGameV2LegalOptions(surrounded).network).toMatchObject({
      availability: "disabled",
      canalLinks: [],
      reason: { code: "NO_REACHABLE_CANAL_LINK" },
    });
  });

  it("keeps Rail Network explicitly attemptable until resource targets are exact", () => {
    const boundary = completedEraBoundary(
      createGameV2(["alice", "bob"], "legal-rail-network"),
    );
    const rail = resolveGameEra(boundary);
    if (!rail.ok) throw new Error(rail.error.message);
    const options = getGameV2LegalOptions(rail.state);

    expect(options.network).toMatchObject({
      availability: "attemptable",
      canalLinks: [],
      selectableCardIds: rail.state.cards.hands[rail.state.currentSeat],
      reason: { code: "RAIL_NETWORK_OPTIONS_NOT_ENUMERATED" },
    });
    expect(options.playerActions.find((action) => action.kind === "NETWORK"))
      .toMatchObject({ availability: "attemptable" });
    expect(options.legalCommandKinds).toContain("NETWORK");
  });
});

describe("GameStateV2 legal phase selectors", () => {
  it("enumerates Merchant free Develop tops and complete selections", () => {
    const state = pendingFreeDevelop(
      createGameV2(["alice", "bob"], "legal-free-develop"),
    );
    const options = getGameV2LegalOptions(state);

    expect(options.legalCommandKinds).toEqual([
      "RESOLVE_MERCHANT_FREE_DEVELOP",
    ]);
    expect(options.playerActions.every(
      (action) => action.reason?.code === "NOT_ACTION_PHASE",
    )).toBe(true);
    expect(options.merchantFreeDevelop).toMatchObject({
      availability: "exact",
      seat: "alice",
      bonusCount: 1,
    });
    expect(options.merchantFreeDevelop.eligibleTopTileIds).toEqual([
      "manufacturer-1-a",
      "cotton-1-a",
      "brewery-1-a",
      "coal-1-a",
      "iron-1-a",
    ]);
    expect(options.merchantFreeDevelop.legalTileIdSelections).toEqual(
      options.merchantFreeDevelop.eligibleTopTileIds.map((tileId) => [tileId]),
    );

    const wrongActor = getGameV2LegalOptions(state, "bob");
    expect(wrongActor.legalCommandKinds).toEqual([]);
    expect(wrongActor.merchantFreeDevelop).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_PENDING_ACTOR" },
    });

    const player = state.players.alice;
    const removableKinds = [
      "manufacturer",
      "cotton",
      "brewery",
      "coal",
      "iron",
    ] as const;
    const removed = removableKinds.flatMap(
      (kind) => player.industryInventory.stacks[kind],
    );
    const noEligible: GameStateV2 = {
      ...state,
      players: {
        ...state.players,
        alice: {
          ...player,
          industryInventory: {
            ...player.industryInventory,
            stacks: {
              ...player.industryInventory.stacks,
              manufacturer: [],
              cotton: [],
              brewery: [],
              coal: [],
              iron: [],
            },
          },
          removedIndustryTileIds: [
            ...player.removedIndustryTileIds,
            ...removed,
          ],
        },
      },
    };
    requireValid(noEligible);
    expect(getGameV2LegalOptions(noEligible).merchantFreeDevelop).toMatchObject({
      availability: "exact",
      eligibleTopTileIds: [],
      legalTileIdSelections: [[]],
    });
  });

  it("exposes only the required system command at lifecycle boundaries", () => {
    const round = completeFirstRound(
      createGameV2(["alice", "bob"], "legal-round-boundary"),
    );
    const roundOptions = getGameV2LegalOptions(round);
    expect(roundOptions.legalCommandKinds).toEqual(["SETTLE_ROUND"]);
    expect(roundOptions.system).toEqual({
      kind: "SETTLE_ROUND",
      availability: "attemptable",
      reason: null,
    });
    expect(getGameV2LegalOptions(round, "alice").system).toMatchObject({
      availability: "disabled",
      reason: { code: "SYSTEM_ACTOR_NOT_ALLOWED" },
    });

    const era = completedEraBoundary(
      createGameV2(["alice", "bob"], "legal-era-boundary"),
    );
    const eraOptions = getGameV2LegalOptions(era);
    expect(eraOptions.legalCommandKinds).toEqual(["RESOLVE_ERA"]);
    expect(eraOptions.system).toEqual({
      kind: "RESOLVE_ERA",
      availability: "exact",
      reason: null,
    });
  });

  it("returns no commands after final Rail scoring", () => {
    const boundary = completedEraBoundary(
      createGameV2(["alice", "bob"], "legal-ended"),
      "rail",
    );
    const ended = resolveGameEra(boundary);
    if (!ended.ok) throw new Error(ended.error.message);
    const options = getGameV2LegalOptions(ended.state);

    expect(options.phase).toBe("ended");
    expect(options.legalCommandKinds).toEqual([]);
    expect(options.system.reason?.code).toBe("GAME_ALREADY_ENDED");
    expect(options.playerActions.every(
      (action) => action.reason?.code === "GAME_ALREADY_ENDED",
    )).toBe(true);
  });

  it("handles prototype-like seat names without inherited-key behavior", () => {
    const state = createGameV2(
      ["__proto__", "constructor"],
      "legal-special-seats",
    );
    requireValid(state);
    const options = getGameV2LegalOptions(state);

    expect(options.actorSeat).toBe("__proto__");
    expect(options.passCardIds).toEqual(state.cards.hands.__proto__);
    expect(options.legalCommandKinds).toContain("PASS");
    expect(options.legalCommandKinds).toContain("LOAN");
    expect(Object.prototype).not.toHaveProperty("money");
  });

  it("fails closed for invalid authoritative state", () => {
    const base = createGameV2(["alice", "bob"], "legal-invalid");
    const invalid = { ...base, revision: -1 } as GameStateV2;
    const options = getGameV2LegalOptions(invalid);

    expect(options.phase).toBe("invalid");
    expect(options.legalCommandKinds).toEqual([]);
    expect(options.playerActions.every(
      (action) => action.reason?.code === "INVALID_GAME_STATE",
    )).toBe(true);

    const missingPending = {
      ...base,
      progress: { phase: "merchant_free_develop" },
    } as unknown as GameStateV2;
    expect(() => getGameV2LegalOptions(missingPending)).not.toThrow();
    expect(getGameV2LegalOptions(missingPending)).toMatchObject({
      phase: "invalid",
      actorSeat: null,
      legalCommandKinds: [],
    });
  });
});

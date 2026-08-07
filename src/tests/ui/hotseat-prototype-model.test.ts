import { describe, expect, it } from "vitest";
import { WILD_LOCATION_CARD_ID } from "@/engine/cards-v2";
import { highestSpaceForIncomeLevel } from "@/engine/economy/income";
import type { GameV2CommandOutcome } from "@/engine/game-v2/commands";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import type { IndustryTileKind } from "@/engine/rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";
import {
  createHotseatSession,
  hideHotseatHand,
  revealHotseatHand,
  setHotseatBoundaryDraft,
  setHotseatDraft,
  submitHotseatCommand,
  toHotseatViewModel,
} from "@/ui/hotseat-session";
import {
  appendSelectedHotseatSellSale,
  clearHotseatSellDraft,
  describeHotseatOutcome,
  hotseatCardDraft,
  hotseatCardLabel,
  hotseatBuildPlanId,
  hotseatDevelopPlanId,
  hotseatSellPlanId,
  legalHotseatScoutTriple,
  normalizeHotseatNetworkLinkId,
  normalizeHotseatBuildDraft,
  normalizeHotseatDevelopDraft,
  normalizeHotseatSellDraft,
  normalizeHotseatScoutSelection,
  selectHotseatActionCard,
  selectHotseatBuildPlan,
  selectHotseatDevelopPlan,
  selectHotseatNetworkLink,
  selectHotseatSellNextOption,
  selectedHotseatCardId,
  selectedHotseatBuildCommand,
  selectedHotseatBuildPlanId,
  selectedHotseatDevelopCommand,
  selectedHotseatDevelopPlanId,
  selectedHotseatNetworkCommand,
  selectedHotseatNetworkLinkId,
  hotseatMerchantFreeDevelopSelectionId,
  hotseatLiquidationDraft,
  readHotseatLiquidationDraft,
  selectHotseatMerchantFreeDevelopSelection,
  selectHotseatLiquidationPrefix,
  selectedHotseatMerchantFreeDevelopCommand,
  selectedHotseatMerchantFreeDevelopSelectionId,
  selectedHotseatSellCommand,
  selectedHotseatSellNextOptionId,
  selectedHotseatSellPrefix,
  selectedHotseatScoutCardIds,
  toggleHotseatScoutCard,
  toHotseatPrototypeModel,
} from "@/ui/hotseat-prototype-model";
import {
  deserializeHotseatSession,
  serializeHotseatSession,
} from "@/ui/hotseat-persistence";
import {
  submitSelectedHotseatLiquidation,
  submitSelectedHotseatSell,
} from "@/ui/hotseat-prototype-controller";

function pendingFreeDevelop(
  state: GameStateV2,
  noEligible = false,
): GameStateV2 {
  const merchant = state.merchants.spaces.find((space) => {
    const location = BOARD_V2.locations[
      space.locationId as keyof typeof BOARD_V2.locations
    ];
    return space.active && location.kind === "merchant" &&
      location.merchantBonus.kind === "free_develop";
  });
  if (merchant === undefined) {
    throw new Error("Expected an active free-Develop Merchant");
  }
  const player = state.players.alice;
  const removableKinds = [
    "manufacturer",
    "cotton",
    "brewery",
    "coal",
    "iron",
  ] as const;
  const removed = noEligible
    ? removableKinds.flatMap((kind) => player.industryInventory.stacks[kind])
    : [];
  return {
    ...state,
    progress: {
      phase: "merchant_free_develop",
      pending: {
        seat: "alice",
        count: 1,
        source: "merchant_bonus",
        merchantSpaceIds: [merchant.merchantSpaceId],
      },
    },
    players: noEligible
      ? {
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
        }
      : state.players,
    merchants: {
      ...state.merchants,
      spaces: state.merchants.spaces.map((space) =>
        space.merchantSpaceId === merchant.merchantSpaceId
          ? { ...space, beer: 0 }
          : space
      ),
    },
  };
}

function firstExactBuild(state: GameStateV2) {
  const revealed = revealHotseatHand(createHotseatSession(state));
  for (const cardId of state.cards.hands[state.currentSeat]) {
    const session = setHotseatDraft(
      revealed,
      selectHotseatActionCard(revealed.draft, cardId),
    );
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    const plan = model.private?.legal.build.plans[0];
    if (plan !== undefined) return { session, model, plan, cardId };
  }
  throw new Error("Expected at least one exact initial Build plan");
}

function firstExactDevelop(state: GameStateV2) {
  const revealed = revealHotseatHand(createHotseatSession(state));
  const cardId = state.cards.hands[state.currentSeat][0];
  const session = setHotseatDraft(
    revealed,
    selectHotseatActionCard(revealed.draft, cardId),
  );
  const model = toHotseatPrototypeModel(
    toHotseatViewModel(session),
    session.state,
  );
  const plan = model.private?.legal.develop.plans.find(
    (candidate) => candidate.tiles.length === 2,
  );
  if (plan === undefined) throw new Error("Expected an exact two-tile Develop plan");
  return { session, model, plan, cardId };
}

function withBoardIron(state: GameStateV2): GameStateV2 {
  const player = state.players.bob;
  const tileId = player.industryInventory.stacks.iron[0];
  if (tileId === undefined) throw new Error("Expected Bob's top iron tile");
  return {
    ...state,
    players: {
      ...state.players,
      bob: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            iron: player.industryInventory.stacks.iron.slice(1),
          },
        },
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        birmingham_3: {
          owner: "bob",
          tileId,
          locationId: "birmingham",
          spaceId: "birmingham_3",
          resources: { coal: 0, iron: 2, beer: 0 },
          flipped: false,
        },
      },
    },
  };
}

function placeTopTile(
  state: GameStateV2,
  owner: string,
  spaceId: string,
  locationId: string,
  industry: IndustryTileKind,
  beer = 0,
): GameStateV2 {
  const player = state.players[owner];
  const stack = player.industryInventory.stacks[industry];
  const tileId = stack[0];
  if (tileId === undefined) throw new Error(`Expected ${owner}'s ${industry}`);
  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            [industry]: stack.slice(1),
          },
        },
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        [spaceId]: {
          owner,
          tileId,
          locationId,
          spaceId,
          resources: { coal: 0, iron: 0, beer },
          flipped: false,
        },
      },
    },
  };
}

function linkPath(
  from: string,
  to: string,
  era: GameStateV2["era"],
): readonly string[] {
  const queue: Array<{
    readonly locationId: string;
    readonly links: readonly string[];
  }> = [{ locationId: from, links: [] }];
  const visited = new Set([from]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.locationId === to) return current.links;
    for (const link of BOARD_V2.links) {
      if (!(link.eras as readonly string[]).includes(era)) continue;
      if (!(link.adjacentLocations as readonly string[]).includes(
        current.locationId,
      )) continue;
      for (const locationId of link.adjacentLocations) {
        if (visited.has(locationId)) continue;
        visited.add(locationId);
        queue.push({
          locationId,
          links: [...current.links, link.id],
        });
      }
    }
  }
  throw new Error(`No ${era} path from ${from} to ${to}`);
}

function withUniversalMerchantAt(
  state: GameStateV2,
  locationId: string,
): { readonly state: GameStateV2; readonly merchantSpaceId: string } {
  const target = state.merchants.spaces.find(
    (space) => space.active && space.locationId === locationId,
  );
  const donor = state.merchants.spaces.find(
    (space) =>
      space.active && space.demandIndustries.length === 3 && space.beer === 1,
  );
  if (
    target === undefined || donor === undefined ||
    target.tileId === null || donor.tileId === null
  ) throw new Error(`Expected active universal Merchant at ${locationId}`);
  if (target.merchantSpaceId === donor.merchantSpaceId) {
    return { state, merchantSpaceId: target.merchantSpaceId };
  }
  return {
    state: {
      ...state,
      merchants: {
        ...state.merchants,
        spaces: state.merchants.spaces.map((space) => {
          if (space.merchantSpaceId === target.merchantSpaceId) {
            return {
              ...space,
              tileId: donor.tileId,
              demandIndustries: [...donor.demandIndustries],
              beer: donor.beer,
            };
          }
          if (space.merchantSpaceId === donor.merchantSpaceId) {
            return {
              ...space,
              tileId: target.tileId,
              demandIndustries: [...target.demandIndustries],
              beer: target.beer,
            };
          }
          return space;
        }),
      },
    },
    merchantSpaceId: target.merchantSpaceId,
  };
}

function sellFixture(
  seed: string,
  merchantLocationId: "merchant_oxford" | "merchant_gloucester",
  twoProducts = false,
): { readonly state: GameStateV2; readonly merchantSpaceId: string } {
  const merchant = withUniversalMerchantAt(
    createGameV2(["alice", "bob"], seed),
    merchantLocationId,
  );
  let state = placeTopTile(
    merchant.state,
    "alice",
    "birmingham_1",
    "birmingham",
    "manufacturer",
  );
  if (twoProducts) {
    state = placeTopTile(
      state,
      "alice",
      "birmingham_2",
      "birmingham",
      "manufacturer",
    );
    state = placeTopTile(
      state,
      "alice",
      "farm_brewery_cannock_1",
      "farm_brewery_cannock",
      "brewery",
      1,
    );
  }
  const links = linkPath("birmingham", merchantLocationId, state.era);
  state = {
    ...state,
    players: {
      ...state.players,
      bob: {
        ...state.players.bob,
        linkTokensRemaining:
          state.players.bob.linkTokensRemaining - links.length,
      },
    },
    board: {
      ...state.board,
      builtLinks: {
        ...state.board.builtLinks,
        ...Object.fromEntries(links.map((linkId) => [linkId, "bob"])),
      },
    },
  };
  return { state, merchantSpaceId: merchant.merchantSpaceId };
}

function revealedSellFixture(fixture: ReturnType<typeof sellFixture>) {
  const revealed = revealHotseatHand(createHotseatSession(fixture.state));
  const cardId = fixture.state.cards.hands.alice[0];
  const session = setHotseatDraft(
    revealed,
    selectHotseatActionCard(revealed.draft, cardId),
  );
  const model = toHotseatPrototypeModel(
    toHotseatViewModel(session),
    session.state,
  );
  return { ...fixture, session, model, cardId };
}

function requireValidState(state: GameStateV2): GameStateV2 {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) =>
      `${error.path}: ${error.message}`
    ).join("\n"));
  }
  return state;
}

function withPlayerIncome(
  state: GameStateV2,
  seat: string,
  incomeLevel: number,
  money: number,
  victoryPoints: number,
): GameStateV2 {
  return requireValidState({
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...state.players[seat],
        money,
        incomeMarkerSpace: highestSpaceForIncomeLevel(incomeLevel),
        victoryPoints,
      },
    },
  });
}

function completeRoundSession(initial: GameStateV2) {
  let session = createHotseatSession(initial);
  while (session.state.progress.phase === "action") {
    const seat = session.state.currentSeat;
    const cardId = session.state.cards.hands[seat][0];
    if (cardId === undefined) throw new Error(`No Pass card for ${seat}`);
    session = submitHotseatCommand(revealHotseatHand(session), {
      type: "PASS",
      cardId,
    });
  }
  expect(session.state.progress.phase).toBe("round_settlement");
  return session;
}

function withFinalRoundCards(state: GameStateV2): GameStateV2 {
  const regularCards = [
    ...state.turnOrder.flatMap((seat) => state.cards.hands[seat]),
    ...state.cards.draw,
    ...state.cards.discard,
  ].filter((cardId) => !cardId.startsWith("wild-"));
  const cardsNeeded = state.turnOrder.length * state.actionLimit;
  return requireValidState({
    ...state,
    cards: {
      hands: Object.fromEntries(state.turnOrder.map((seat, seatIndex) => [
        seat,
        regularCards.slice(
          seatIndex * state.actionLimit,
          (seatIndex + 1) * state.actionLimit,
        ),
      ])) as GameStateV2["cards"]["hands"],
      draw: [],
      discard: regularCards.slice(cardsNeeded) as GameStateV2["cards"]["discard"],
      wildSupplies: { ...state.cards.wildSupplies },
    },
  });
}

describe("hot-seat prototype presentation model", () => {
  it("explains partial Iron Works production before the tile flips", () => {
    const outcome = {
      kind: "player_action",
      actionType: "BUILD",
      effect: {
        type: "INDUSTRY_BUILT",
        seat: "alice",
        actionsConsumed: 1,
        discardedCardId: "industry-iron-works-01",
        placement: {
          owner: "alice",
          buildSpaceId: "birmingham_3",
          locationId: "birmingham",
          tileId: "iron-1-a",
          faceId: "iron-1",
          industry: "iron",
          level: 1,
          resources: { coal: 0, iron: 2, beer: 0 },
          flipped: false,
        },
        overbuilt: null,
        resourceSources: [
          { resource: "coal", kind: "market", unitPrice: 2 },
        ],
        flippedProviderSpaceIds: [],
        printedBuildCost: 5,
        resourceMarketCost: 2,
        moneySpent: 7,
        productionRevenue: 2,
        moneyChange: -5,
        productionSold: { coal: 0, iron: 2 },
        incomeAwards: [],
      },
      pendingFollowUp: false,
      turnComplete: true,
      roundComplete: false,
      refilledCards: 1,
    } as const satisfies GameV2CommandOutcome;

    expect(describeHotseatOutcome(outcome)).toBe(
      "alice: BUILD accepted. 2 of 4 iron cubes sold to the market for £2. " +
        "2 remain on the Iron Works, so it has not flipped and income has not advanced yet. Turn complete.",
    );
  });

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

  it("keeps Build plans private and projects complete initial choices", () => {
    const state = createGameV2(["alice", "bob"], "prototype-build-options");
    const ready = firstExactBuild(state);
    const build = ready.model.private?.legal.build;

    expect(build).toMatchObject({
      availability: "exact",
      selectionIsLegal: false,
      reason: null,
    });
    expect(build?.plans.length).toBeGreaterThan(0);
    expect(ready.plan).toMatchObject({
      id: hotseatBuildPlanId(ready.plan.selection),
      buildSpaceLabel: expect.any(String),
      locationLabel: expect.any(String),
      industry: expect.any(String),
      industryLabel: expect.any(String),
      industryEmoji: expect.any(String),
      tileLevel: expect.any(Number),
      sourceSummary: expect.any(String),
      totalCost: expect.any(Number),
      selection: { cardId: ready.cardId },
    });
    expect(ready.plan.locationLabel.length).toBeGreaterThan(0);
    expect(ready.plan.tileLevel).toBeGreaterThan(0);
    expect(ready.plan.totalCost).toBeGreaterThanOrEqual(0);

    const hidden = hideHotseatHand(ready.session);
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(hidden),
      hidden.state,
    );
    expect(handoff.private).toBeNull();
    expect(JSON.stringify(handoff)).not.toContain(ready.plan.id);
    expect(JSON.stringify(handoff)).not.toContain(ready.plan.buildSpaceId);
  });

  it("normalizes stale Build plans while preserving a canonical plan across other controls", () => {
    const state = createGameV2(["alice", "bob"], "prototype-build-draft");
    const ready = firstExactBuild(state);
    const planIds = ready.model.private?.legal.build.plans.map((plan) => plan.id) ?? [];
    const selected = selectHotseatBuildPlan(
      ready.session.draft,
      ready.plan.id,
      planIds,
    );
    const scoutChanged = toggleHotseatScoutCard(
      selected,
      state.cards.hands.alice[1],
      state.cards.hands.alice,
    );
    const networkChanged = selectHotseatNetworkLink(
      scoutChanged,
      "link-placeholder",
      ["link-placeholder"],
    );

    expect(selectedHotseatBuildPlanId(selected)).toBe(ready.plan.id);
    expect(selectedHotseatBuildPlanId(scoutChanged)).toBe(ready.plan.id);
    expect(selectedHotseatBuildPlanId(networkChanged)).toBe(ready.plan.id);
    expect(normalizeHotseatBuildDraft(networkChanged, planIds)?.fields)
      .toMatchObject({ buildPlanId: ready.plan.id });
    const stale = normalizeHotseatBuildDraft(networkChanged, []);
    expect(selectedHotseatBuildPlanId(stale)).toBeNull();
    expect(stale?.fields).not.toHaveProperty("buildPlanId");
    expect(selectedHotseatBuildPlanId(
      selectHotseatBuildPlan(selected, "stale-plan", planIds),
    )).toBeNull();
  });

  it("submits an exact Build plan and projects its authoritative public industry", () => {
    const state = createGameV2(["alice", "bob"], "prototype-build-success");
    const ready = firstExactBuild(state);
    const playerBefore = state.players.alice;
    const selected = setHotseatDraft(
      ready.session,
      selectHotseatBuildPlan(
        ready.session.draft,
        ready.plan.id,
        ready.model.private?.legal.build.plans.map((plan) => plan.id) ?? [],
      ),
    );
    const selectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    const command = selectedModel.private === null
      ? null
      : selectedHotseatBuildCommand(selectedModel.private);
    if (command === null) throw new Error("Expected a ready Build command");
    const accepted = submitHotseatCommand(selected, command);
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );
    const placement = accepted.state.board.placedIndustries[
      ready.plan.buildSpaceId
    ];

    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.players.alice.money).toBe(
      playerBefore.money + ready.plan.moneyChange,
    );
    expect(placement).toMatchObject({
      owner: "alice",
      tileId: ready.plan.tileId,
      locationId: expect.any(String),
    });
    expect(accepted.state.cards.discard).toContain(ready.cardId);
    expect(accepted.state.cards.hands.alice).not.toContain(ready.cardId);
    expect(handoff.feedback).toMatchObject({
      kind: "accepted",
      message: expect.stringContaining("BUILD accepted"),
    });
    expect(handoff.handoff).toEqual({ nextSeat: "bob" });
    expect(handoff.private).toBeNull();
    expect(handoff.placedIndustries).toContainEqual(expect.objectContaining({
      buildSpaceId: ready.plan.buildSpaceId,
      locationLabel: ready.plan.locationLabel,
      owner: "alice",
      industryLabel: ready.plan.industryLabel,
      industryEmoji: ready.plan.industryEmoji,
      tileId: ready.plan.tileId,
      tileLevel: ready.plan.tileLevel,
      resourceSummary: expect.any(String),
    }));
  });

  it("surfaces the selected card's exact no-target Build blocker", () => {
    const base = createGameV2(["alice", "bob"], "prototype-build-blocker");
    const state: GameStateV2 = {
      ...base,
      players: {
        ...base.players,
        alice: { ...base.players.alice, money: 0 },
      },
    };
    const session = setHotseatDraft(
      revealHotseatHand(createHotseatSession(state)),
      selectHotseatActionCard(null, state.cards.hands.alice[0]),
    );
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(model.private?.legal.build).toMatchObject({
      availability: "disabled",
      selectionIsLegal: false,
      plans: [],
      reason: {
        code: "NO_LEGAL_BUILD",
        message: "The selected card has no affordable legal Build target.",
      },
    });
  });

  it("projects private exact Develop plans and compact public inventories", () => {
    const state = createGameV2(["alice", "bob"], "prototype-develop-options");
    const hiddenSession = createHotseatSession(state);
    const hidden = toHotseatPrototypeModel(
      toHotseatViewModel(hiddenSession),
      hiddenSession.state,
    );
    const ready = firstExactDevelop(state);
    const develop = ready.model.private?.legal.develop;

    expect(hidden.private).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain("developPlanId");
    expect(develop).toMatchObject({
      availability: "exact",
      selectionIsLegal: false,
      reason: null,
    });
    expect(ready.model.private?.cards.every((card) => card.canDevelop)).toBe(true);
    expect(develop?.plans.some((plan) => plan.tiles.length === 1)).toBe(true);
    expect(develop?.plans.some((plan) => plan.tiles.length === 2)).toBe(true);
    expect(ready.plan.id).toBe(hotseatDevelopPlanId(ready.plan.selection));
    expect(ready.plan.tiles.map((tile) => tile.id)).toEqual(
      ready.plan.selection.tileIds,
    );
    expect(ready.plan.tiles.every((tile) =>
      tile.industryLabel.length > 0 &&
      tile.industryEmoji.length > 0 &&
      tile.level > 0
    )).toBe(true);
    expect(ready.plan.ironSummary).toContain("iron from market");
    expect(ready.plan.marketIronUnits).toBe(2);
    expect(ready.plan.marketIronCost).toBe(ready.plan.totalCost);

    expect(hidden.playerIndustryInventories).toHaveLength(2);
    expect(hidden.playerIndustryInventories[0]).toMatchObject({
      seat: "alice",
      industries: expect.arrayContaining([
        expect.objectContaining({
          kind: "manufacturer",
          industryLabel: "Manufacturer",
          industryEmoji: "🏭",
          remaining: state.players.alice.industryInventory.stacks.manufacturer.length,
          nextTileLevel: 1,
        }),
      ]),
    });
  });

  it("distinguishes board iron from paid market iron in Develop plans", () => {
    const state = withBoardIron(
      createGameV2(["alice", "bob"], "prototype-develop-board-iron"),
    );
    const ready = firstExactDevelop(state);

    expect(ready.plan.boardIronSources).toEqual([
      {
        locationLabel: "Birmingham",
        owner: "bob",
        unitsConsumed: 2,
        cubesRemaining: 0,
      },
    ]);
    expect(ready.plan.marketIronUnits).toBe(0);
    expect(ready.plan.marketIronCost).toBe(0);
    expect(ready.plan.totalCost).toBe(0);
    expect(ready.plan.ironSummary).toBe(
      "⚙️ 2 iron from Birmingham (bob)",
    );
  });

  it("preserves a Develop draft across other controls and clears it when stale", () => {
    const state = createGameV2(["alice", "bob"], "prototype-develop-draft");
    const ready = firstExactDevelop(state);
    const planIds = ready.model.private?.legal.develop.plans.map(
      (plan) => plan.id,
    ) ?? [];
    const selected = selectHotseatDevelopPlan(
      ready.session.draft,
      ready.plan.id,
      planIds,
    );
    const scoutChanged = toggleHotseatScoutCard(
      selected,
      state.cards.hands.alice[1],
      state.cards.hands.alice,
    );
    const networkChanged = selectHotseatNetworkLink(
      scoutChanged,
      "link-placeholder",
      ["link-placeholder"],
    );

    expect(selectedHotseatDevelopPlanId(selected)).toBe(ready.plan.id);
    expect(selectedHotseatDevelopPlanId(scoutChanged)).toBe(ready.plan.id);
    expect(selectedHotseatDevelopPlanId(networkChanged)).toBe(ready.plan.id);
    expect(normalizeHotseatDevelopDraft(networkChanged, planIds)?.fields)
      .toMatchObject({ developPlanId: ready.plan.id });
    expect(selectedHotseatDevelopPlanId(
      normalizeHotseatDevelopDraft(networkChanged, []),
    )).toBeNull();

    const buildPlan = ready.model.private?.legal.build.plans[0];
    if (buildPlan === undefined) throw new Error("Expected a Build plan too");
    const combinedPlans = selectHotseatBuildPlan(
      selected,
      buildPlan.id,
      ready.model.private?.legal.build.plans.map((plan) => plan.id) ?? [],
    );
    const secondCardDraft = selectHotseatActionCard(
      combinedPlans,
      state.cards.hands.alice[1],
    );
    const changedCardSession = setHotseatDraft(ready.session, secondCardDraft);
    const changedCardModel = toHotseatPrototypeModel(
      toHotseatViewModel(changedCardSession),
      changedCardSession.state,
    );
    expect(changedCardModel.private?.selectedDevelopPlanId).toBeNull();
    expect(changedCardModel.private?.selectedBuildPlanId).toBeNull();
    const normalizedBuild = normalizeHotseatBuildDraft(
      secondCardDraft,
      changedCardModel.private?.legal.build.plans.map((plan) => plan.id) ?? [],
    );
    const normalizedChangedCard = normalizeHotseatDevelopDraft(
      normalizedBuild,
      changedCardModel.private?.legal.develop.plans.map((plan) => plan.id) ?? [],
    );
    expect(normalizedChangedCard?.fields).not.toHaveProperty("buildPlanId");
    expect(normalizedChangedCard?.fields).not.toHaveProperty("developPlanId");

    const selectedSession = setHotseatDraft(ready.session, selected);
    const restored = deserializeHotseatSession(
      serializeHotseatSession(selectedSession),
    );
    expect(restored.visibility).toEqual({ kind: "handoff", nextSeat: "alice" });
    expect(restored.draft).toBeNull();
    expect(toHotseatPrototypeModel(
      toHotseatViewModel(restored),
      restored.state,
    ).private).toBeNull();
  });

  it("submits an exact Develop plan through the reducer and returns to handoff", () => {
    const state = createGameV2(["alice", "bob"], "prototype-develop-success");
    const ready = firstExactDevelop(state);
    const selected = setHotseatDraft(
      ready.session,
      selectHotseatDevelopPlan(
        ready.session.draft,
        ready.plan.id,
        ready.model.private?.legal.develop.plans.map((plan) => plan.id) ?? [],
      ),
    );
    const selectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    const command = selectedModel.private === null
      ? null
      : selectedHotseatDevelopCommand(selectedModel.private);
    if (command === null) throw new Error("Expected a ready Develop command");
    expect(command).toEqual({ type: "DEVELOP", selection: ready.plan.selection });
    const accepted = submitHotseatCommand(selected, command);
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );

    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.players.alice.money).toBe(
      state.players.alice.money - ready.plan.totalCost,
    );
    expect(accepted.state.market.iron).toBe(
      state.market.iron - ready.plan.marketIronUnits,
    );
    expect(accepted.state.players.alice.removedIndustryTileIds).toEqual(
      expect.arrayContaining(ready.plan.tiles.map((tile) => tile.id)),
    );
    for (const tile of ready.plan.tiles) {
      expect(Object.values(
        accepted.state.players.alice.industryInventory.stacks,
      ).flat()).not.toContain(tile.id);
    }
    expect(accepted.state.cards.discard).toContain(ready.cardId);
    expect(accepted.state.cards.hands.alice).not.toContain(ready.cardId);
    expect(accepted.state.cards.hands.alice).toHaveLength(
      state.cards.hands.alice.length,
    );
    expect(accepted.state.currentSeat).toBe("bob");
    expect(accepted.lastResult).toMatchObject({
      ok: true,
      outcome: { kind: "player_action", actionType: "DEVELOP" },
    });
    expect(handoff.handoff).toEqual({ nextSeat: "bob" });
    expect(handoff.private).toBeNull();
  });

  it("surfaces the selected card's exact no-Develop blocker", () => {
    const base = createGameV2(["alice", "bob"], "prototype-develop-blocker");
    const state: GameStateV2 = {
      ...base,
      players: {
        ...base.players,
        alice: { ...base.players.alice, money: 0 },
      },
    };
    const session = setHotseatDraft(
      revealHotseatHand(createHotseatSession(state)),
      selectHotseatActionCard(null, state.cards.hands.alice[0]),
    );
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(model.private?.legal.develop).toMatchObject({
      availability: "disabled",
      selectionIsLegal: false,
      plans: [],
      reason: {
        code: "NO_LEGAL_DEVELOP",
        message: "The active player has no affordable legal Develop selection.",
      },
    });
  });

  it("keeps Sell choices private and advances one exact sale layer at a time", () => {
    const fixture = sellFixture(
      "prototype-sell-progressive",
      "merchant_oxford",
      true,
    );
    const hiddenSession = createHotseatSession(fixture.state);
    const hidden = toHotseatPrototypeModel(
      toHotseatViewModel(hiddenSession),
      hiddenSession.state,
    );
    const ready = revealedSellFixture(fixture);
    const initialSell = ready.model.private?.legal.sell;

    expect(hidden.private).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain("sellPrefix");
    expect(JSON.stringify(hidden)).not.toContain("sellNextOptionId");
    expect(ready.model.private?.cards.every((card) => card.canSell)).toBe(true);
    expect(initialSell).toMatchObject({
      availability: "exact",
      selectedSales: [],
      currentPlan: null,
      selectedNextOptionId: null,
      selectedNextIsLegal: false,
      reason: null,
    });
    const first = initialSell?.nextOptions.find(
      (option) =>
        option.sale.productIndustryId === "birmingham_1" &&
        option.plan.selection.sales[0].merchantSpaceId ===
          fixture.merchantSpaceId,
    );
    if (first === undefined) throw new Error("Expected the first exact sale");
    expect(first.id).toBe(hotseatSellPlanId(first.plan.selection));
    expect(first.sale).toMatchObject({
      productLabel: "Manufacturer",
      productEmoji: "🏭",
      productLocationLabel: "Birmingham",
      productLevel: 1,
      merchantLabel: "Oxford",
    });
    expect(first.sale.beerSummary).toContain("mandatory Merchant beer");
    expect(first.sale.incomeSummary).toContain("printed income spaces");

    const withNext = setHotseatDraft(
      ready.session,
      selectHotseatSellNextOption(
        ready.session.draft,
        first.id,
        initialSell?.nextOptions.map((option) => option.id) ?? [],
      ),
    );
    const nextModel = toHotseatPrototypeModel(
      toHotseatViewModel(withNext),
      withNext.state,
    );
    expect(nextModel.private?.legal.sell).toMatchObject({
      selectedNextOptionId: first.id,
      selectedNextIsLegal: true,
    });
    const oneSale = setHotseatDraft(
      withNext,
      nextModel.private === null
        ? withNext.draft
        : appendSelectedHotseatSellSale(withNext.draft, nextModel.private),
    );
    const oneSaleModel = toHotseatPrototypeModel(
      toHotseatViewModel(oneSale),
      oneSale.state,
    );
    const oneSalePlan = oneSaleModel.private?.legal.sell.currentPlan;
    expect(oneSalePlan?.sales).toHaveLength(1);
    expect(oneSaleModel.private?.legal.sell.selectedSales).toEqual(
      oneSalePlan?.selection.sales,
    );
    expect(selectedHotseatSellPrefix(oneSale.draft)).toEqual(
      oneSalePlan?.selection.sales,
    );
    expect(selectedHotseatSellNextOptionId(oneSale.draft)).toBeNull();

    const second = oneSaleModel.private?.legal.sell.nextOptions.find(
      (option) =>
        option.sale.productIndustryId === "birmingham_2" &&
        option.plan.selection.sales.at(-1)?.beerSource.kind === "brewery",
    );
    if (second === undefined) throw new Error("Expected the continuation sale");
    const twoSelected = setHotseatDraft(
      oneSale,
      selectHotseatSellNextOption(
        oneSale.draft,
        second.id,
        oneSaleModel.private?.legal.sell.nextOptions.map((option) => option.id) ?? [],
      ),
    );
    const twoSelectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(twoSelected),
      twoSelected.state,
    );
    const twoSale = setHotseatDraft(
      twoSelected,
      twoSelectedModel.private === null
        ? twoSelected.draft
        : appendSelectedHotseatSellSale(
            twoSelected.draft,
            twoSelectedModel.private,
          ),
    );
    const twoSaleModel = toHotseatPrototypeModel(
      toHotseatViewModel(twoSale),
      twoSale.state,
    );
    expect(twoSaleModel.private?.legal.sell.currentPlan?.sales).toHaveLength(2);
    expect(twoSaleModel.private?.legal.sell.currentPlan?.sales.map(
      (sale) => sale.productIndustryId,
    )).toEqual(["birmingham_1", "birmingham_2"]);
    expect(twoSaleModel.private?.legal.sell.currentPlan?.sales[1].beerSummary)
      .toContain("mandatory Brewery beer");
  });

  it("fails closed for stale Sell state and clears it on an action-card change", () => {
    const fixture = sellFixture(
      "prototype-sell-stale",
      "merchant_oxford",
      true,
    );
    const revealed = revealHotseatHand(createHotseatSession(fixture.state));
    const cardId = fixture.state.cards.hands.alice[0];
    const malformed = setHotseatDraft(revealed, {
      commandType: "SELL",
      fields: {
        cardId,
        buildPlanId: "preserve-unrelated",
        sellPrefix: [{ industryId: "missing", beerSource: null }],
        sellNextOptionId: "stale-next",
      },
    });
    const malformedModel = toHotseatPrototypeModel(
      toHotseatViewModel(malformed),
      malformed.state,
    );

    expect(selectedHotseatSellPrefix(malformed.draft)).toBeNull();
    expect(malformedModel.private?.legal.sell).toMatchObject({
      availability: "disabled",
      currentPlan: null,
      nextOptions: [],
      selectedNextOptionId: null,
      reason: { code: "INVALID_SALE_PREFIX" },
    });
    const normalized = normalizeHotseatSellDraft(
      malformed.draft,
      null,
      [],
    );
    expect(normalized?.fields).not.toHaveProperty("sellPrefix");
    expect(normalized?.fields).not.toHaveProperty("sellNextOptionId");
    expect(normalized?.fields).toMatchObject({
      buildPlanId: "preserve-unrelated",
    });

    const ready = revealedSellFixture(fixture);
    const option = ready.model.private?.legal.sell.nextOptions[0];
    if (option === undefined) throw new Error("Expected a Sell option");
    const selected = selectHotseatSellNextOption(
      ready.session.draft,
      option.id,
      ready.model.private?.legal.sell.nextOptions.map((item) => item.id) ?? [],
    );
    expect(selectedHotseatSellNextOptionId(selected)).toBe(option.id);
    expect(selectedHotseatSellNextOptionId(
      selectHotseatSellNextOption(selected, "stale", [option.id]),
    )).toBeNull();
    const changedCard = selectHotseatActionCard(
      clearHotseatSellDraft(selected),
      fixture.state.cards.hands.alice[1],
    );
    expect(selectedHotseatSellPrefix(changedCard)).toEqual([]);
    expect(selectedHotseatSellNextOptionId(changedCard)).toBeNull();
  });

  it("submits a normal Sell and projects public product, beer, and player changes", () => {
    const fixture = sellFixture(
      "prototype-sell-normal",
      "merchant_oxford",
    );
    const ready = revealedSellFixture(fixture);
    const option = ready.model.private?.legal.sell.nextOptions.find(
      (candidate) =>
        candidate.sale.productIndustryId === "birmingham_1" &&
        candidate.plan.selection.sales[0].merchantSpaceId ===
          fixture.merchantSpaceId &&
        candidate.plan.selection.sales[0].beerSource.kind === "merchant",
    );
    if (option === undefined) throw new Error("Expected a normal Sell option");
    const withNext = setHotseatDraft(
      ready.session,
      selectHotseatSellNextOption(
        ready.session.draft,
        option.id,
        ready.model.private?.legal.sell.nextOptions.map((item) => item.id) ?? [],
      ),
    );
    const nextModel = toHotseatPrototypeModel(
      toHotseatViewModel(withNext),
      withNext.state,
    );
    const selected = setHotseatDraft(
      withNext,
      nextModel.private === null
        ? withNext.draft
        : appendSelectedHotseatSellSale(withNext.draft, nextModel.private),
    );
    const selectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    const plan = selectedModel.private?.legal.sell.currentPlan;
    const command = selectedModel.private === null
      ? null
      : selectedHotseatSellCommand(selectedModel.private);
    if (plan === null || plan === undefined || command === null) {
      throw new Error("Expected a reducer-ready normal Sell");
    }
    const accepted = submitHotseatCommand(selected, command);
    const publicModel = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );
    const merchant = accepted.state.merchants.spaces.find(
      (space) => space.merchantSpaceId === fixture.merchantSpaceId,
    );

    expect(accepted.state.revision).toBe(fixture.state.revision + 1);
    expect(accepted.state.board.placedIndustries.birmingham_1.flipped).toBe(true);
    expect(merchant?.beer).toBe(0);
    expect(accepted.state.players.alice.money).toBe(
      fixture.state.players.alice.money + plan.moneyChange,
    );
    expect(accepted.state.players.alice.victoryPoints).toBe(
      fixture.state.players.alice.victoryPoints + plan.victoryPointsChange,
    );
    expect(accepted.state.players.alice.incomeMarkerSpace).toBe(
      fixture.state.players.alice.incomeMarkerSpace +
        plan.incomeMarkerSpacesAdvanced,
    );
    expect(accepted.state.cards.discard).toContain(ready.cardId);
    expect(accepted.state.cards.hands.alice).not.toContain(ready.cardId);
    expect(accepted.state.currentSeat).toBe("bob");
    expect(accepted.lastResult).toMatchObject({
      ok: true,
      outcome: { kind: "player_action", actionType: "SELL" },
    });
    expect(publicModel.handoff).toEqual({ nextSeat: "bob" });
    expect(publicModel.private).toBeNull();
    expect(publicModel.placedIndustries).toContainEqual(expect.objectContaining({
      buildSpaceId: "birmingham_1",
      flipped: true,
    }));
    expect(publicModel.public.merchants).toContainEqual(expect.objectContaining({
      merchantSpaceId: fixture.merchantSpaceId,
      beer: 0,
    }));
    expect(publicModel.public.players.find((player) => player.seat === "alice"))
      .toMatchObject({
        money: accepted.state.players.alice.money,
        incomeMarkerSpace: accepted.state.players.alice.incomeMarkerSpace,
        victoryPoints: accepted.state.players.alice.victoryPoints,
      });
  });

  it("hides Gloucester pending state, reloads it, then completes its parent Sell once", () => {
    const fixture = sellFixture(
      "prototype-sell-gloucester",
      "merchant_gloucester",
    );
    const ready = revealedSellFixture(fixture);
    const option = ready.model.private?.legal.sell.nextOptions.find(
      (candidate) =>
        candidate.sale.productIndustryId === "birmingham_1" &&
        candidate.plan.pendingFreeDevelopCount === 1,
    );
    if (option === undefined) throw new Error("Expected Gloucester free Develop");
    const withNext = setHotseatDraft(
      ready.session,
      selectHotseatSellNextOption(
        ready.session.draft,
        option.id,
        ready.model.private?.legal.sell.nextOptions.map((item) => item.id) ?? [],
      ),
    );
    const nextModel = toHotseatPrototypeModel(
      toHotseatViewModel(withNext),
      withNext.state,
    );
    const selected = setHotseatDraft(
      withNext,
      nextModel.private === null
        ? withNext.draft
        : appendSelectedHotseatSellSale(withNext.draft, nextModel.private),
    );
    const selectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    const sellCommand = selectedModel.private === null
      ? null
      : selectedHotseatSellCommand(selectedModel.private);
    if (sellCommand === null) throw new Error("Expected a Gloucester Sell command");
    const sold = submitSelectedHotseatSell(selected);
    const pending = toHotseatPrototypeModel(
      toHotseatViewModel(sold),
      sold.state,
    );

    expect(sold.state.progress.phase).toBe("merchant_free_develop");
    expect(sold.state.revision).toBe(1);
    expect(sold.state.events.filter((event) => event.type === "ACTION_ACCEPTED"))
      .toHaveLength(0);
    expect(sold.state.board.placedIndustries.birmingham_1.flipped).toBe(true);
    expect(pending.handoff).toEqual({ nextSeat: "alice" });
    expect(pending.private).toBeNull();
    expect(sold.draft).toBeNull();

    const restored = deserializeHotseatSession(serializeHotseatSession(sold));
    expect(restored.state.progress.phase).toBe("merchant_free_develop");
    expect(restored.visibility).toEqual({ kind: "handoff", nextSeat: "alice" });
    expect(restored.draft).toBeNull();
    const followUpRevealed = revealHotseatHand(restored);
    const followUpModel = toHotseatPrototypeModel(
      toHotseatViewModel(followUpRevealed),
      followUpRevealed.state,
    );
    const followUp = followUpModel.private?.merchantFreeDevelop;
    const tileSelection = followUp?.selections[0];
    if (followUp === null || followUp === undefined || tileSelection === undefined) {
      throw new Error("Expected the existing Merchant follow-up selector");
    }
    const followUpSelected = setHotseatDraft(
      followUpRevealed,
      selectHotseatMerchantFreeDevelopSelection(
        followUpRevealed.draft,
        tileSelection.id,
        followUp.selections.map((selection) => selection.id),
      ),
    );
    const followUpSelectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(followUpSelected),
      followUpSelected.state,
    );
    const followUpCommand = followUpSelectedModel.private === null
      ? null
      : selectedHotseatMerchantFreeDevelopCommand(
          followUpSelectedModel.private,
        );
    if (followUpCommand === null) throw new Error("Expected follow-up command");
    const resolved = submitHotseatCommand(followUpSelected, followUpCommand);

    expect(resolved.state.progress).toEqual({ phase: "action" });
    expect(resolved.state.currentSeat).toBe("bob");
    expect(resolved.state.revision).toBe(2);
    expect(resolved.acceptedCommands.map((envelope) => envelope.command.type))
      .toEqual(["SELL", "RESOLVE_MERCHANT_FREE_DEVELOP"]);
    expect(resolved.state.events.filter(
      (event) => event.type === "ACTION_ACCEPTED",
    )).toHaveLength(1);
    expect(resolved.state.events.slice(-3).map((event) => event.type)).toEqual([
      "MERCHANT_FREE_DEVELOP_RESOLVED",
      "ACTION_ACCEPTED",
      "COMMAND_APPLIED",
    ]);
    expect(resolved.state.cards.hands.alice).toHaveLength(
      fixture.state.cards.hands.alice.length,
    );
    expect(toHotseatPrototypeModel(
      toHotseatViewModel(resolved),
      resolved.state,
    ).handoff).toEqual({ nextSeat: "bob" });
  });

  it("keeps the pending Merchant follow-up behind a privacy-safe handoff", () => {
    const state = pendingFreeDevelop(
      createGameV2(["alice", "bob"], "prototype-merchant-handoff"),
    );
    const session = createHotseatSession(state);
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );

    expect(session.visibility).toEqual({ kind: "handoff", nextSeat: "alice" });
    expect(model.handoff).toEqual({ nextSeat: "alice" });
    expect(model.boundary).toMatchObject({
      kind: "merchant_free_develop",
      seat: "alice",
      count: 1,
    });
    expect(model.private).toBeNull();
    expect(JSON.stringify(model)).not.toContain(
      "merchantFreeDevelopSelectionId",
    );
  });

  it("projects exact Merchant tile selections, requires one, and clears stale choices", () => {
    const state = pendingFreeDevelop(
      createGameV2(["alice", "bob"], "prototype-merchant-options"),
    );
    const revealed = revealHotseatHand(createHotseatSession(state));
    let model = toHotseatPrototypeModel(
      toHotseatViewModel(revealed),
      revealed.state,
    );
    const followUp = model.private?.merchantFreeDevelop;
    if (followUp === null || followUp === undefined) {
      throw new Error("Expected revealed Merchant free Develop options");
    }

    expect(model.private?.mode).toBe("merchant_free_develop");
    expect(followUp).toMatchObject({
      availability: "exact",
      requiredCount: 1,
      selectedSelectionId: null,
      selectionIsLegal: false,
      reason: null,
    });
    expect(followUp.selections).toHaveLength(5);
    expect(followUp.selections.every((selection) =>
      selection.tileIds.length === 1 &&
      selection.id === hotseatMerchantFreeDevelopSelectionId(selection.tileIds) &&
      selection.tiles.length === 1 &&
      selection.tiles[0].industryLabel.length > 0 &&
      selection.tiles[0].industryEmoji.length > 0 &&
      selection.tiles[0].level > 0 &&
      selection.skippedCount === 0
    )).toBe(true);
    expect(model.private === null
      ? null
      : selectedHotseatMerchantFreeDevelopCommand(model.private)).toBeNull();

    const stale = selectHotseatMerchantFreeDevelopSelection(
      revealed.draft,
      "stale-selection",
      followUp.selections.map((selection) => selection.id),
    );
    expect(selectedHotseatMerchantFreeDevelopSelectionId(stale)).toBeNull();
    expect(stale.fields).not.toHaveProperty("merchantFreeDevelopSelectionId");

    const first = followUp.selections[0];
    const selected = setHotseatDraft(
      revealed,
      selectHotseatMerchantFreeDevelopSelection(
        revealed.draft,
        first.id,
        followUp.selections.map((selection) => selection.id),
      ),
    );
    model = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    expect(model.private?.merchantFreeDevelop).toMatchObject({
      selectedSelectionId: first.id,
      selectionIsLegal: true,
    });
    expect(model.private === null
      ? null
      : selectedHotseatMerchantFreeDevelopCommand(model.private)).toEqual({
        type: "RESOLVE_MERCHANT_FREE_DEVELOP",
        selection: { tileIds: first.tileIds },
      });

    const restored = deserializeHotseatSession(
      serializeHotseatSession(selected),
    );
    expect(restored.state.progress.phase).toBe("merchant_free_develop");
    expect(restored.visibility).toEqual({ kind: "handoff", nextSeat: "alice" });
    expect(restored.draft).toBeNull();
    expect(toHotseatPrototypeModel(
      toHotseatViewModel(restored),
      restored.state,
    ).private).toBeNull();
  });

  it("resolves the free Develop and completes its parent Sell exactly once", () => {
    const state = pendingFreeDevelop(
      createGameV2(["alice", "bob"], "prototype-merchant-success"),
    );
    const initialAcceptedActions = state.events.filter(
      (event) => event.type === "ACTION_ACCEPTED",
    ).length;
    const revealed = revealHotseatHand(createHotseatSession(state));
    const revealedModel = toHotseatPrototypeModel(
      toHotseatViewModel(revealed),
      revealed.state,
    );
    const followUp = revealedModel.private?.merchantFreeDevelop;
    const first = followUp?.selections[0];
    if (followUp === null || followUp === undefined || first === undefined) {
      throw new Error("Expected a Merchant free Develop selection");
    }
    const selected = setHotseatDraft(
      revealed,
      selectHotseatMerchantFreeDevelopSelection(
        revealed.draft,
        first.id,
        followUp.selections.map((selection) => selection.id),
      ),
    );
    const selectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    const command = selectedModel.private === null
      ? null
      : selectedHotseatMerchantFreeDevelopCommand(selectedModel.private);
    if (command === null) throw new Error("Expected a ready follow-up command");
    const accepted = submitHotseatCommand(selected, command);
    const handoff = toHotseatPrototypeModel(
      toHotseatViewModel(accepted),
      accepted.state,
    );

    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.progress).toEqual({ phase: "action" });
    expect(accepted.state.currentSeat).toBe("bob");
    expect(accepted.state.players.alice.removedIndustryTileIds)
      .toContain(first.tileIds[0]);
    expect(accepted.state.events.filter(
      (event) => event.type === "ACTION_ACCEPTED",
    )).toHaveLength(initialAcceptedActions + 1);
    expect(accepted.state.events.slice(-3).map((event) => event.type)).toEqual([
      "MERCHANT_FREE_DEVELOP_RESOLVED",
      "ACTION_ACCEPTED",
      "COMMAND_APPLIED",
    ]);
    expect(accepted.acceptedCommands).toHaveLength(1);
    expect(handoff.feedback).toMatchObject({
      kind: "accepted",
      message: expect.stringContaining("Merchant free Develop resolved"),
    });
    expect(handoff.handoff).toEqual({ nextSeat: "bob" });
    expect(handoff.private).toBeNull();
  });

  it("offers and accepts the exact empty skip when no eligible top tile remains", () => {
    const state = pendingFreeDevelop(
      createGameV2(["alice", "bob"], "prototype-merchant-skip"),
      true,
    );
    const removedBefore = state.players.alice.removedIndustryTileIds.length;
    const revealed = revealHotseatHand(createHotseatSession(state));
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(revealed),
      revealed.state,
    );
    const followUp = model.private?.merchantFreeDevelop;
    const skip = followUp?.selections[0];
    if (followUp === null || followUp === undefined || skip === undefined) {
      throw new Error("Expected an empty Merchant skip selection");
    }

    expect(followUp.requiredCount).toBe(1);
    expect(followUp.selections).toEqual([expect.objectContaining({
      id: "[]",
      tileIds: [],
      tiles: [],
      skippedCount: 1,
    })]);
    const selected = setHotseatDraft(
      revealed,
      selectHotseatMerchantFreeDevelopSelection(
        revealed.draft,
        skip.id,
        [skip.id],
      ),
    );
    const selectedModel = toHotseatPrototypeModel(
      toHotseatViewModel(selected),
      selected.state,
    );
    const command = selectedModel.private === null
      ? null
      : selectedHotseatMerchantFreeDevelopCommand(selectedModel.private);
    if (command === null) throw new Error("Expected a ready skip command");
    expect(command.selection.tileIds).toEqual([]);
    const accepted = submitHotseatCommand(selected, command);

    expect(accepted.state.progress).toEqual({ phase: "action" });
    expect(accepted.state.players.alice.removedIndustryTileIds).toHaveLength(
      removedBefore,
    );
    expect(accepted.lastResult).toMatchObject({
      ok: true,
      outcome: {
        kind: "merchant_free_develop",
        effect: { skippedUnavailableBonuses: 1, removedTileIds: [] },
      },
    });
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

    expect(model.boundary).toMatchObject({
      kind: "round_settlement",
      draftIssue: null,
      liquidation: {
        availability: "exact",
        requiredSeats: [],
        ready: true,
        liquidationChoices: {},
      },
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

    expect(model.boundary).toMatchObject({
      kind: "round_settlement",
      draftIssue: null,
      liquidation: {
        availability: "exact",
        requiredSeats: ["alice"],
        ready: false,
        liquidationChoices: null,
        seats: [{
          seat: "alice",
          coverage: "covered_by_cash",
          acknowledged: false,
          preview: { moneyAfter: 44, victoryPointsLost: 0 },
        }],
      },
    });
  });

  it("advances one exact public liquidation choice and submits it authoritatively", () => {
    let state = placeTopTile(
      createGameV2(["alice", "bob"], "prototype-liquidation-submit"),
      "alice",
      "birmingham_1",
      "birmingham",
      "cotton",
    );
    state = withPlayerIncome(state, "alice", -5, 0, 3);
    const boundary = completeRoundSession(state);
    const initial = toHotseatPrototypeModel(
      toHotseatViewModel(boundary),
      boundary.state,
      boundary.draft,
    );
    const alice = initial.boundary?.kind === "round_settlement"
      ? initial.boundary.liquidation?.seats.find((seat) => seat.seat === "alice")
      : undefined;
    const choice = alice?.nextChoices.find((candidate) =>
      candidate.buildSpaceId === "birmingham_1"
    );
    expect(alice).toMatchObject({
      coverage: "shortfall",
      acknowledged: false,
      selectedAssets: [],
      remainingShortfall: 5,
      preview: {
        moneyAfter: 0,
        victoryPointsAfter: 0,
        victoryPointsLost: 3,
        unpaidShortfall: 2,
      },
    });
    expect(choice).toMatchObject({
      liquidationValue: 6,
      choicesAfterAppend: ["birmingham_1"],
      coverageAfterAppend: "covered_by_liquidation",
    });
    if (choice === undefined) throw new Error("Expected a liquidation choice");

    const withDraft = setHotseatBoundaryDraft(
      boundary,
      selectHotseatLiquidationPrefix(
        boundary.draft,
        boundary.state.revision,
        "alice",
        choice.choicesAfterAppend,
      ),
    );
    const ready = toHotseatPrototypeModel(
      toHotseatViewModel(withDraft),
      withDraft.state,
      withDraft.draft,
    );
    expect(withDraft.visibility).toEqual({ kind: "handoff", nextSeat: null });
    expect(ready.private).toBeNull();
    expect(ready.handoff).toBeNull();
    expect(ready.boundary).toMatchObject({
      kind: "round_settlement",
      draftIssue: null,
      liquidation: {
        ready: true,
        liquidationChoices: { alice: ["birmingham_1"] },
        seats: [{
          seat: "alice",
          selectedAssets: [{ buildSpaceId: "birmingham_1" }],
          preview: {
            moneyAfter: 1,
            victoryPointsAfter: 3,
            victoryPointsLost: 0,
            unpaidShortfall: 0,
          },
        }],
      },
    });
    expect(JSON.stringify(ready)).not.toContain(
      boundary.state.cards.hands.alice[0],
    );

    const settled = submitSelectedHotseatLiquidation(withDraft);
    expect(settled.state.revision).toBe(withDraft.state.revision + 1);
    expect(settled.state.progress.phase).toBe("action");
    expect(settled.state.board.placedIndustries).not.toHaveProperty(
      "birmingham_1",
    );
    expect(settled.state.players.alice).toMatchObject({
      money: 1,
      victoryPoints: 3,
    });
    expect(settled.acceptedCommands.at(-1)?.command).toEqual({
      type: "SETTLE_ROUND",
      liquidationChoices: { alice: ["birmingham_1"] },
    });
    expect(settled.draft).toBeNull();
  });

  it("requires the explicit cash-covered acknowledgment before submitting", () => {
    const boundary = completeRoundSession(withPlayerIncome(
      createGameV2(["alice", "bob"], "prototype-liquidation-ack"),
      "alice",
      -3,
      17,
      4,
    ));
    expect(submitSelectedHotseatLiquidation(boundary)).toBe(boundary);

    const acknowledged = setHotseatBoundaryDraft(
      boundary,
      selectHotseatLiquidationPrefix(
        boundary.draft,
        boundary.state.revision,
        "alice",
        [],
      ),
    );
    expect(readHotseatLiquidationDraft(
      acknowledged.draft,
      acknowledged.state.revision,
    )).toEqual({
      ok: true,
      liquidationChoices: { alice: [] },
    });
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(acknowledged),
      acknowledged.state,
      acknowledged.draft,
    );
    expect(model.boundary).toMatchObject({
      kind: "round_settlement",
      liquidation: {
        ready: true,
        liquidationChoices: { alice: [] },
      },
    });

    const settled = submitSelectedHotseatLiquidation(acknowledged);
    expect(settled.state.players.alice).toMatchObject({
      money: 14,
      victoryPoints: 4,
    });
  });

  it("fails closed on stale or malformed public settlement drafts", () => {
    const boundary = completeRoundSession(withPlayerIncome(
      createGameV2(["alice", "bob"], "prototype-liquidation-stale"),
      "alice",
      -3,
      17,
      0,
    ));
    const stale = setHotseatBoundaryDraft(
      boundary,
      hotseatLiquidationDraft(boundary.state.revision - 1, { alice: [] }),
    );
    const staleModel = toHotseatPrototypeModel(
      toHotseatViewModel(stale),
      stale.state,
      stale.draft,
    );
    expect(staleModel.boundary).toMatchObject({
      kind: "round_settlement",
      liquidation: null,
      draftIssue: expect.stringContaining("stale"),
    });
    expect(submitSelectedHotseatLiquidation(stale)).toBe(stale);

    const malformed = setHotseatBoundaryDraft(boundary, {
      commandType: "SETTLE_ROUND",
      fields: {
        boundaryRevision: boundary.state.revision,
        liquidationChoices: { alice: [7] },
      },
    });
    expect(readHotseatLiquidationDraft(
      malformed.draft,
      malformed.state.revision,
    )).toMatchObject({ ok: false });
    expect(submitSelectedHotseatLiquidation(malformed)).toBe(malformed);

    const cleared = setHotseatBoundaryDraft(malformed, null);
    const recovered = toHotseatPrototypeModel(
      toHotseatViewModel(cleared),
      cleared.state,
      cleared.draft,
    );
    expect(recovered.boundary).toMatchObject({
      kind: "round_settlement",
      draftIssue: null,
      liquidation: { availability: "exact" },
    });
  });

  it("submits exactly {} and skips income in the final Rail round", () => {
    const finalRound = SETUP_DATA.playerCounts[2].roundsPerEra;
    let state = requireValidState({
      ...createGameV2(["alice", "bob"], "prototype-final-rail-settlement"),
      era: "rail",
      round: finalRound,
      actionLimit: 2,
    });
    state = withPlayerIncome(state, "alice", -5, 0, 7);
    const boundary = completeRoundSession(withFinalRoundCards(state));
    const model = toHotseatPrototypeModel(
      toHotseatViewModel(boundary),
      boundary.state,
      boundary.draft,
    );
    expect(model.boundary).toMatchObject({
      kind: "round_settlement",
      liquidation: {
        availability: "exact",
        finalRailIncomeSkipped: true,
        requiredSeats: [],
        ready: true,
        liquidationChoices: {},
      },
    });

    const settled = submitSelectedHotseatLiquidation(boundary);
    expect(settled.state.progress.phase).toBe("era_transition");
    expect(settled.state.players.alice).toMatchObject({
      money: 0,
      victoryPoints: 7,
    });
    expect(settled.acceptedCommands.at(-1)?.command).toEqual({
      type: "SETTLE_ROUND",
      liquidationChoices: {},
    });
  });
});

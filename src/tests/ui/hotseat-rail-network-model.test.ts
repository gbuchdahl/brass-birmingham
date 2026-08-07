import { describe, expect, it } from "vitest";
import type { NetworkActionSelection } from "@/engine/actions-v2/network";
import {
  executeGameV2Command,
  type GameV2CommandEnvelope,
} from "@/engine/game-v2/commands";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
} from "@/engine/rules/generated/industry-tiles-v2";
import {
  appendSelectedHotseatRailNetworkPlan,
  clearHotseatRailNetworkDraft,
  normalizeHotseatRailNetworkDraft,
  selectedHotseatRailNetworkCommand,
  selectHotseatRailNetworkNextPlan,
  toHotseatRailNetworkModel,
} from "@/ui/hotseat-rail-network-model";
import {
  createHotseatSession,
  hideHotseatHand,
  revealHotseatHand,
  setHotseatDraft,
  toHotseatViewModel,
  type HotseatDraft,
} from "@/ui/hotseat-session";
import {
  selectHotseatActionCard,
  selectHotseatNetworkLink,
  toHotseatPrototypeModel,
} from "@/ui/hotseat-prototype-model";
import { submitSelectedHotseatNetwork } from "@/ui/hotseat-prototype-controller";

const SPACE_LOCATIONS = new Map<string, string>();
for (const [locationId, location] of Object.entries(BOARD_V2.locations)) {
  if (!("buildSpaces" in location)) continue;
  for (const space of location.buildSpaces) {
    SPACE_LOCATIONS.set(space.id, locationId);
  }
}

function asRail(state: GameStateV2): GameStateV2 {
  return { ...state, era: "rail", actionLimit: 2 };
}

function withMoney(state: GameStateV2, money: number): GameStateV2 {
  const seat = state.currentSeat;
  return {
    ...state,
    players: {
      ...state.players,
      [seat]: { ...state.players[seat], money },
    },
  };
}

function placeTile(
  state: GameStateV2,
  owner: string,
  spaceId: string,
  tileId: IndustryTileId,
  resources: Partial<PlacedIndustryStateV2["resources"]> = {},
): GameStateV2 {
  const locationId = SPACE_LOCATIONS.get(spaceId);
  if (locationId === undefined) {
    throw new Error(`Unknown fixture space ${spaceId}.`);
  }
  const tile = INDUSTRY_TILE_BY_ID[tileId];
  const player = state.players[owner];
  const stack = player.industryInventory.stacks[tile.industry];
  const index = stack.indexOf(tileId);
  if (index < 0) throw new Error(`Tile ${tileId} is unavailable to ${owner}.`);
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
            [tile.industry]: stack.slice(index + 1),
          },
        },
        removedIndustryTileIds: [
          ...player.removedIndustryTileIds,
          ...stack.slice(0, index),
        ],
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
          resources: {
            coal: resources.coal ?? 0,
            iron: resources.iron ?? 0,
            beer: resources.beer ?? 0,
          },
          flipped: false,
        },
      },
    },
  };
}

function withBuiltLink(
  state: GameStateV2,
  owner: string,
  linkId: string,
): GameStateV2 {
  const player = state.players[owner];
  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...player,
        linkTokensRemaining: player.linkTokensRemaining - 1,
      },
    },
    board: {
      ...state.board,
      builtLinks: { ...state.board.builtLinks, [linkId]: owner },
    },
  };
}

function requireValid(state: GameStateV2): void {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("\n"));
  }
}

function envelope(
  state: GameStateV2,
  selection: NetworkActionSelection,
  suffix: string,
): GameV2CommandEnvelope {
  return {
    schemaVersion: 1,
    commandId: `rail-ui-${suffix}`,
    gameId: state.gameId,
    expectedRevision: state.revision,
    actorSeat: state.currentSeat,
    command: { type: "NETWORK", selection },
  };
}

function draftWithCard(cardId: string): HotseatDraft {
  return { commandType: "NETWORK", fields: { cardId } };
}

describe("private exact Rail Network hot-seat model", () => {
  it("projects reducer-ready initial plans, depletion, and income awards", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-initial")),
      5,
    );
    state = placeTile(state, "bob", "nuneaton_2", "coal-2-a", { coal: 1 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const model = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      draftWithCard(cardId),
    );

    expect(model).toMatchObject({
      availability: "exact",
      savedPrefixStatus: "empty",
      currentPlan: null,
      selectedNextPlanId: null,
      submissionPlan: null,
      reason: null,
    });
    const plan = model.nextPlans.find(
      (candidate) =>
        candidate.selection.linkIds[0] === "link_birmingham_nuneaton" &&
        candidate.selection.coalSources[0].kind === "mine",
    );
    expect(plan).toMatchObject({
      linkCount: 1,
      links: [{
        order: 1,
        endpointLabel: "Birmingham ↔ Nuneaton",
      }],
      coalSources: [{
        kind: "mine",
        owner: "bob",
        locationLabel: "Nuneaton",
        cubesRemaining: 0,
        depleted: true,
      }],
      flippedIndustryIds: ["nuneaton_2"],
      costs: { links: 5, resources: 0, total: 5 },
      playerResult: { money: 0, linkTokensUsed: 1 },
    });
    expect(plan?.incomeAwards).toEqual([
      expect.objectContaining({ owner: "bob", buildSpaceId: "nuneaton_2" }),
    ]);
    if (plan === undefined) throw new Error("Expected exact mine plan.");

    const selectedDraft = selectHotseatRailNetworkNextPlan(
      draftWithCard(cardId),
      plan.id,
      model.nextPlans.map((candidate) => candidate.id),
    );
    const selected = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      selectedDraft,
    );
    const command = selectedHotseatRailNetworkCommand(selected);
    if (command === null) throw new Error("Expected a typed Network command.");
    expect(
      executeGameV2Command(state, envelope(state, command.selection, "initial")),
    ).toMatchObject({ ok: true });
  });

  it("selects, appends, and submits an ordered extension with sequential market prices and own beer", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-extension")),
      18,
    );
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    state = placeTile(state, "bob", "stafford_1", "brewery-2-a", { beer: 2 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const initialDraft = draftWithCard(cardId);
    const initial = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      initialDraft,
    );
    const first = initial.nextPlans.find(
      (plan) =>
        plan.selection.linkIds[0] === "link_derby_nottingham" &&
        plan.selection.coalSources[0].kind === "market",
    );
    if (first === undefined) throw new Error("Expected first market link.");

    const firstSelectedDraft = selectHotseatRailNetworkNextPlan(
      initialDraft,
      first.id,
      initial.nextPlans.map((plan) => plan.id),
    );
    const firstSelected = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      firstSelectedDraft,
    );
    expect(selectedHotseatRailNetworkCommand(firstSelected)?.selection).toEqual(
      first.selection,
    );

    const prefixDraft = appendSelectedHotseatRailNetworkPlan(
      firstSelectedDraft,
      firstSelected,
    );
    const extension = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      prefixDraft,
    );
    expect(extension).toMatchObject({
      availability: "exact",
      savedPrefixStatus: "accepted",
      currentPlan: { id: first.id, linkCount: 1 },
      selectedNextPlanId: null,
    });
    expect(selectedHotseatRailNetworkCommand(extension)?.selection).toEqual(
      first.selection,
    );

    const second = extension.nextPlans.find(
      (plan) =>
        JSON.stringify(plan.selection.linkIds) === JSON.stringify([
          "link_derby_nottingham",
          "link_belper_derby",
        ]) &&
        plan.selection.coalSources.every((source) => source.kind === "market"),
    );
    expect(second).toMatchObject({
      linkCount: 2,
      coalSources: [
        { kind: "market", unitPrice: 1, summary: "Market coal £1" },
        { kind: "market", unitPrice: 2, summary: "Market coal £2" },
      ],
      beerSource: {
        industryId: "derby_1",
        owner: "alice",
        locationLabel: "Derby",
        barrelsRemaining: 1,
      },
      costs: { links: 15, resources: 3, total: 18 },
      playerResult: {
        money: 0,
        moneyChange: -18,
        linkTokensUsed: 2,
      },
      marketResult: { coalBefore: 13, coalAfter: 11, coalPurchased: 2 },
    });
    if (second === undefined) throw new Error("Expected exact two-link plan.");

    const secondDraft = selectHotseatRailNetworkNextPlan(
      prefixDraft,
      second.id,
      extension.nextPlans.map((plan) => plan.id),
    );
    const selectedExtension = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      secondDraft,
    );
    const command = selectedHotseatRailNetworkCommand(selectedExtension);
    expect(command).toEqual({ type: "NETWORK", selection: second.selection });
    if (command === null) throw new Error("Expected extension command.");
    expect(
      executeGameV2Command(
        state,
        envelope(state, command.selection, "extension"),
      ),
    ).toMatchObject({ ok: true });

    expect(
      appendSelectedHotseatRailNetworkPlan(secondDraft, selectedExtension),
    ).toBe(secondDraft);
    expect(JSON.stringify(selectedExtension)).not.toContain("stafford_1");
  });

  it("fails closed for malformed and rejected prefixes and clears stale card state", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-stale")),
      18,
    );
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    requireValid(state);
    const [cardId, otherCardId] = state.cards.hands.alice;
    const malformed: HotseatDraft = {
      commandType: "NETWORK",
      fields: {
        cardId,
        preserve: "unrelated",
        railNetworkPrefix: {
          linkIds: ["link_derby_nottingham", "link_belper_derby"],
          coalSources: [{ kind: "market" }],
          beerSourceId: null,
          cardId,
        },
        railNetworkNextPlanId: "invented",
      },
    };
    const malformedModel = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      malformed,
    );
    expect(malformedModel).toMatchObject({
      availability: "disabled",
      savedPrefixStatus: "malformed",
      currentPlan: null,
      nextPlans: [],
      submissionPlan: null,
      reason: { code: "MALFORMED_SAVED_PREFIX" },
    });
    expect(selectedHotseatRailNetworkCommand(malformedModel)).toBeNull();
    expect(normalizeHotseatRailNetworkDraft(malformed, malformedModel)).toEqual({
      commandType: "NETWORK",
      fields: { cardId, preserve: "unrelated" },
    });

    const initial = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      draftWithCard(cardId),
    );
    const first = initial.nextPlans.find(
      (plan) => plan.selection.linkIds[0] === "link_derby_nottingham",
    );
    if (first === undefined) throw new Error("Expected a first link.");
    const selectedDraft = selectHotseatRailNetworkNextPlan(
      draftWithCard(cardId),
      first.id,
      initial.nextPlans.map((plan) => plan.id),
    );
    const prefixDraft = appendSelectedHotseatRailNetworkPlan(
      selectedDraft,
      toHotseatRailNetworkModel(state, "alice", cardId, selectedDraft),
    );
    const changedCard = toHotseatRailNetworkModel(
      state,
      "alice",
      otherCardId,
      prefixDraft,
    );
    expect(changedCard).toMatchObject({
      availability: "exact",
      cardId: otherCardId,
      savedPrefixStatus: "stale_card",
      selectedPrefix: null,
      currentPlan: null,
      selectedNextPlanId: null,
    });
    const cardNormalized = normalizeHotseatRailNetworkDraft(
      prefixDraft,
      changedCard,
    );
    expect(cardNormalized?.fields).not.toHaveProperty("railNetworkPrefix");
    expect(cardNormalized?.fields).not.toHaveProperty("railNetworkNextPlanId");

    const staleState = withBuiltLink(
      state,
      "alice",
      first.selection.linkIds[0],
    );
    requireValid(staleState);
    const rejected = toHotseatRailNetworkModel(
      staleState,
      "alice",
      cardId,
      prefixDraft,
    );
    expect(rejected).toMatchObject({
      availability: "disabled",
      savedPrefixStatus: "rejected",
      submissionPlan: null,
      reason: { code: "INVALID_NETWORK_PREFIX" },
    });
    expect(selectedHotseatRailNetworkCommand(rejected)).toBeNull();
    expect(normalizeHotseatRailNetworkDraft(prefixDraft, rejected)?.fields)
      .not.toHaveProperty("railNetworkPrefix");
    expect(clearHotseatRailNetworkDraft(null)).toBeNull();
  });

  it("does not expose opponent hands, draw order, or opponent beer choices", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-privacy")),
      40,
    );
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    state = placeTile(state, "bob", "stafford_1", "brewery-2-a", { beer: 2 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    const initial = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      draftWithCard(cardId),
    );
    const first = initial.nextPlans.find(
      (plan) => plan.selection.linkIds[0] === "link_derby_nottingham",
    );
    if (first === undefined) throw new Error("Expected a first Rail plan.");
    const selectedDraft = selectHotseatRailNetworkNextPlan(
      draftWithCard(cardId),
      first.id,
      initial.nextPlans.map((plan) => plan.id),
    );
    const prefixDraft = appendSelectedHotseatRailNetworkPlan(
      selectedDraft,
      toHotseatRailNetworkModel(state, "alice", cardId, selectedDraft),
    );
    const extension = toHotseatRailNetworkModel(
      state,
      "alice",
      cardId,
      prefixDraft,
    );

    expect(extension.nextPlans.length).toBeGreaterThan(0);
    expect(
      extension.nextPlans.every(
        (plan) => plan.beerSource === null || plan.beerSource.owner === "alice",
      ),
    ).toBe(true);
    const serialized = JSON.stringify(extension);
    for (const privateCardId of state.cards.hands.bob) {
      expect(serialized).not.toContain(`\"${privateCardId}\"`);
    }
    expect(serialized).not.toContain(`\"${state.cards.draw[0]}\"`);
    expect(serialized).not.toContain("stafford_1");
    expect(serialized).not.toContain(state.seed);
  });
});

describe("Rail Network prototype integration", () => {
  it("preserves the existing exact Canal controller branch", () => {
    const state = createGameV2(["alice", "bob"], "rail-ui-canal-regression");
    const cardId = state.cards.hands.alice[0];
    let session = revealHotseatHand(createHotseatSession(state));
    session = setHotseatDraft(
      session,
      selectHotseatActionCard(session.draft, cardId),
    );
    let model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    const link = model.private?.legal.network.links[0];
    if (link === undefined) throw new Error("Expected exact Canal link.");
    session = setHotseatDraft(
      session,
      selectHotseatNetworkLink(
        session.draft,
        link.linkId,
        model.private?.legal.network.links.map((item) => item.linkId) ?? [],
      ),
    );
    model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    expect(model.private?.legal.network).toMatchObject({
      availability: "exact",
      selectionIsLegal: true,
    });
    expect(model.private?.legal.railNetwork).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_RAIL_ERA" },
    });

    const accepted = submitSelectedHotseatNetwork(session);
    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.board.builtLinks[link.linkId]).toBe("alice");
    expect(accepted.state.players.alice.money).toBe(
      state.players.alice.money - 3,
    );
  });

  it("submits a selected exact one-link plan through the shared controller", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-controller-one")),
      5,
    );
    state = placeTile(state, "bob", "nuneaton_2", "coal-2-a", { coal: 1 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    let session = revealHotseatHand(createHotseatSession(state));
    session = setHotseatDraft(
      session,
      selectHotseatActionCard(session.draft, cardId),
    );
    let model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    expect(model.private?.legal.network.availability).toBe("attemptable");
    expect(model.private?.legal.railNetwork.availability).toBe("exact");
    const plan = model.private?.legal.railNetwork.nextPlans.find(
      (candidate) =>
        candidate.selection.linkIds[0] === "link_birmingham_nuneaton" &&
        candidate.selection.coalSources[0].kind === "mine",
    );
    if (plan === undefined) throw new Error("Expected integrated Rail plan.");
    session = setHotseatDraft(
      session,
      selectHotseatRailNetworkNextPlan(
        session.draft,
        plan.id,
        model.private?.legal.railNetwork.nextPlans.map((item) => item.id) ?? [],
      ),
    );
    model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    expect(model.private?.legal.railNetwork).toMatchObject({
      selectedNextPlanId: plan.id,
      selectedNextIsLegal: true,
      submissionPlan: { id: plan.id, linkCount: 1 },
    });

    const accepted = submitSelectedHotseatNetwork(session);
    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.board.builtLinks[plan.selection.linkIds[0]])
      .toBe("alice");
    expect(accepted.state.players.alice.money).toBe(0);
    expect(accepted.state.board.placedIndustries.nuneaton_2).toMatchObject({
      flipped: true,
      resources: { coal: 0 },
    });
    expect(accepted.acceptedCommands.at(-1)?.command).toEqual({
      type: "NETWORK",
      selection: plan.selection,
    });
  });

  it("promotes a first link and submits a selected exact two-link extension", () => {
    let state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-controller-two")),
      18,
    );
    state = placeTile(state, "alice", "derby_1", "brewery-2-a", { beer: 2 });
    requireValid(state);
    const cardId = state.cards.hands.alice[0];
    let session = revealHotseatHand(createHotseatSession(state));
    session = setHotseatDraft(
      session,
      selectHotseatActionCard(session.draft, cardId),
    );
    let model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    const first = model.private?.legal.railNetwork.nextPlans.find(
      (plan) =>
        plan.selection.linkIds[0] === "link_derby_nottingham" &&
        plan.selection.coalSources[0].kind === "market",
    );
    if (first === undefined) throw new Error("Expected first market Rail plan.");
    session = setHotseatDraft(
      session,
      selectHotseatRailNetworkNextPlan(
        session.draft,
        first.id,
        model.private?.legal.railNetwork.nextPlans.map((plan) => plan.id) ?? [],
      ),
    );
    model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    if (model.private === null) throw new Error("Expected revealed Rail model.");
    session = setHotseatDraft(
      session,
      appendSelectedHotseatRailNetworkPlan(
        session.draft,
        model.private.legal.railNetwork,
      ),
    );
    model = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    expect(model.private?.legal.railNetwork.currentPlan?.id).toBe(first.id);
    const second = model.private?.legal.railNetwork.nextPlans.find(
      (plan) =>
        JSON.stringify(plan.selection.linkIds) === JSON.stringify([
          "link_derby_nottingham",
          "link_belper_derby",
        ]) &&
        plan.selection.coalSources.every((source) => source.kind === "market"),
    );
    if (second === undefined) throw new Error("Expected second market Rail link.");
    session = setHotseatDraft(
      session,
      selectHotseatRailNetworkNextPlan(
        session.draft,
        second.id,
        model.private?.legal.railNetwork.nextPlans.map((plan) => plan.id) ?? [],
      ),
    );

    const accepted = submitSelectedHotseatNetwork(session);
    expect(accepted.state.revision).toBe(state.revision + 1);
    expect(accepted.state.players.alice.money).toBe(0);
    expect(accepted.state.players.alice.linkTokensRemaining).toBe(
      state.players.alice.linkTokensRemaining - 2,
    );
    expect(accepted.state.market.coal).toBe(11);
    expect(accepted.state.board.placedIndustries.derby_1.resources.beer).toBe(1);
    expect(accepted.state.board.builtLinks).toMatchObject({
      link_derby_nottingham: "alice",
      link_belper_derby: "alice",
    });
    expect(accepted.acceptedCommands.at(-1)?.command).toEqual({
      type: "NETWORK",
      selection: second.selection,
    });
  });

  it("keeps Rail drafts private and makes malformed persisted state inert", () => {
    const state = withMoney(
      asRail(createGameV2(["alice", "bob"], "rail-ui-integrated-privacy")),
      18,
    );
    const cardId = state.cards.hands.alice[0];
    let session = revealHotseatHand(createHotseatSession(state));
    session = setHotseatDraft(session, {
      commandType: "NETWORK",
      fields: {
        cardId,
        railNetworkPrefix: {
          linkIds: ["invented", "too-many"],
          coalSources: [],
          beerSourceId: "opponent-beer",
          cardId,
        },
        railNetworkNextPlanId: "invented-plan",
      },
    });
    const revealed = toHotseatPrototypeModel(
      toHotseatViewModel(session),
      session.state,
    );
    expect(revealed.private?.legal.railNetwork).toMatchObject({
      availability: "disabled",
      savedPrefixStatus: "malformed",
      nextPlans: [],
      submissionPlan: null,
      reason: { code: "MALFORMED_SAVED_PREFIX" },
    });
    expect(submitSelectedHotseatNetwork(session)).toBe(session);

    const hidden = hideHotseatHand(session);
    const publicModel = toHotseatPrototypeModel(
      toHotseatViewModel(hidden),
      hidden.state,
    );
    expect(publicModel.private).toBeNull();
    expect(JSON.stringify(publicModel)).not.toContain("railNetworkPrefix");
    expect(JSON.stringify(publicModel)).not.toContain("invented-plan");
    for (const privateCardId of state.cards.hands.alice) {
      expect(JSON.stringify(publicModel)).not.toContain(privateCardId);
    }
  });
});

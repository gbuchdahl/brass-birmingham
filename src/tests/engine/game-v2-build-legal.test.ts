import { describe, expect, it } from "vitest";
import type { PlayableCardId } from "@/engine/cards-v2/types";
import {
  executeGameV2Command,
  type GameV2CommandResult,
} from "@/engine/game-v2/commands";
import { executeBuildForGameV2 } from "@/engine/game-v2/action-adapters";
import { getGameV2BuildLegalOptions } from "@/engine/game-v2/build-legal";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
  type PlacedIndustryStateV2,
} from "@/engine/game-v2/state";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import type { IndustryTileKind } from "@/engine/rules/generated/industry-tiles-v2";

function card(templateId: string): PlayableCardId {
  const match = CARD_CATALOG.find(
    (candidate) => candidate.templateId === templateId,
  );
  if (!match) throw new Error(`Missing card template: ${templateId}`);
  return match.id;
}

const LOCATION_BIRMINGHAM = card("location-birmingham");
const LOCATION_CANN0CK = card("location-cannock");
const LOCATION_STAFFORD = card("location-stafford");
const INDUSTRY_COAL = card("industry-coal-mine");

function requireValid(state: GameStateV2): GameStateV2 {
  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) =>
      `${error.path}: ${error.message}`
    ).join("\n"));
  }
  return state;
}

/** Moves a regular card into one hand by swapping it with that hand's first card. */
function withCardInHand(
  state: GameStateV2,
  seat: string,
  cardId: PlayableCardId,
): GameStateV2 {
  const destination = state.cards.hands[seat];
  if (destination.includes(cardId)) return state;
  const outgoing = destination[0];
  if (outgoing === undefined) throw new Error(`Expected a card in ${seat}'s hand`);

  const drawIndex = state.cards.draw.indexOf(cardId as never);
  if (drawIndex >= 0) {
    const draw = [...state.cards.draw];
    draw[drawIndex] = outgoing as typeof draw[number];
    return requireValid({
      ...state,
      cards: {
        ...state.cards,
        hands: {
          ...state.cards.hands,
          [seat]: [cardId, ...destination.slice(1)],
        },
        draw,
      },
    });
  }

  for (const [sourceSeat, sourceHand] of Object.entries(state.cards.hands)) {
    const sourceIndex = sourceHand.indexOf(cardId);
    if (sourceIndex < 0) continue;
    const nextSourceHand = [...sourceHand];
    nextSourceHand[sourceIndex] = outgoing;
    return requireValid({
      ...state,
      cards: {
        ...state.cards,
        hands: {
          ...state.cards.hands,
          [seat]: [cardId, ...destination.slice(1)],
          [sourceSeat]: nextSourceHand,
        },
      },
    });
  }
  throw new Error(`Card is not in the game: ${cardId}`);
}

function placeTopTile(
  state: GameStateV2,
  owner: string,
  buildSpaceId: string,
  locationId: string,
  industry: IndustryTileKind,
  resources: Partial<PlacedIndustryStateV2["resources"]> = {},
  flipped = false,
): GameStateV2 {
  const player = state.players[owner];
  const tileId = player.industryInventory.stacks[industry][0];
  if (tileId === undefined) throw new Error(`No ${industry} tile for ${owner}`);
  return requireValid({
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            [industry]: player.industryInventory.stacks[industry].slice(1),
          },
        },
      },
    },
    board: {
      ...state.board,
      placedIndustries: {
        ...state.board.placedIndustries,
        [buildSpaceId]: {
          owner,
          tileId,
          locationId,
          spaceId: buildSpaceId,
          resources: {
            coal: resources.coal ?? 0,
            iron: resources.iron ?? 0,
            beer: resources.beer ?? 0,
          },
          flipped,
        },
      },
    },
  });
}

function withBuiltLink(
  state: GameStateV2,
  linkId: string,
  owner: string,
): GameStateV2 {
  const player = state.players[owner];
  return requireValid({
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
  });
}

function advanceIndustryInventory(
  state: GameStateV2,
  seat: string,
  industry: IndustryTileKind,
  targetTileId: string,
): GameStateV2 {
  const player = state.players[seat];
  const stack = player.industryInventory.stacks[industry];
  const targetIndex = stack.indexOf(targetTileId as typeof stack[number]);
  if (targetIndex < 0) {
    throw new Error(`${targetTileId} is not in ${seat}'s ${industry} stack`);
  }
  return requireValid({
    ...state,
    players: {
      ...state.players,
      [seat]: {
        ...player,
        industryInventory: {
          ...player.industryInventory,
          stacks: {
            ...player.industryInventory.stacks,
            [industry]: stack.slice(targetIndex),
          },
        },
        removedIndustryTileIds: [
          ...player.removedIndustryTileIds,
          ...stack.slice(0, targetIndex),
        ],
      },
    },
  });
}

function expectCommandSuccess(
  result: GameV2CommandResult,
): Extract<GameV2CommandResult, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("exact GameStateV2 Build selector", () => {
  it("exposes useful initial no-resource and market-iron builds", () => {
    const cannock = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-cannock"),
      "alice",
      LOCATION_CANN0CK,
    );
    const cannockOptions = getGameV2BuildLegalOptions(
      cannock,
      "alice",
      LOCATION_CANN0CK,
    );
    expect(cannockOptions).toMatchObject({
      availability: "exact",
      actorSeat: "alice",
      cardId: LOCATION_CANN0CK,
      reason: null,
    });
    expect(cannockOptions.targets.map((target) => [
      target.buildSpaceId,
      target.industry,
    ])).toEqual([
      ["cannock_1", "coal"],
      ["cannock_2", "coal"],
    ]);
    expect(cannockOptions.targets.every((target) =>
      target.resourcePlans.every((plan) => plan.sources.length === 0)
    )).toBe(true);
    expect(cannockOptions.targets[0]).toMatchObject({
      locationId: "cannock",
      locationLabel: "Cannock",
      tile: { id: "coal-1-a", faceId: "coal-1", level: 1 },
      overbuild: null,
      resourcePlans: [{
        printedBuildCost: 5,
        resourceMarketCost: 0,
        totalCost: 5,
      }],
    });

    const stafford = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-stafford"),
      "alice",
      LOCATION_STAFFORD,
    );
    const staffordOptions = getGameV2BuildLegalOptions(
      stafford,
      "alice",
      LOCATION_STAFFORD,
    );
    const brewery = staffordOptions.targets.find((target) =>
      target.buildSpaceId === "stafford_1" && target.industry === "brewery"
    );
    expect(brewery).toMatchObject({
      locationLabel: "Stafford",
      tile: { id: "brewery-1-a", faceId: "brewery-1", level: 1 },
      resourcePlans: [{
        sources: [{ resource: "iron", kind: "market", unitPrice: 2 }],
        printedBuildCost: 5,
        resourceMarketCost: 2,
        totalCost: 7,
        moneyChange: -7,
      }],
    });
  });

  it("requires a current actor card and obeys the selected card's permission", () => {
    const base = createGameV2(["alice", "bob"], "build-legal-card");
    expect(getGameV2BuildLegalOptions(base, "alice", null)).toMatchObject({
      availability: "disabled",
      targets: [],
      reason: { code: "CARD_REQUIRED" },
    });
    expect(
      getGameV2BuildLegalOptions(base, "alice", base.cards.hands.bob[0]),
    ).toMatchObject({
      availability: "disabled",
      targets: [],
      reason: { code: "CARD_NOT_IN_HAND" },
    });
    expect(
      getGameV2BuildLegalOptions(base, "bob", base.cards.hands.bob[0]),
    ).toMatchObject({
      availability: "disabled",
      reason: { code: "NOT_CURRENT_ACTOR" },
    });

    const cannock = withCardInHand(base, "alice", LOCATION_CANN0CK);
    const exact = getGameV2BuildLegalOptions(
      cannock,
      "alice",
      LOCATION_CANN0CK,
    );
    expect(exact.targets.length).toBeGreaterThan(0);
    expect(exact.targets.every((target) => target.locationId === "cannock"))
      .toBe(true);
    expect(exact.targets.every((target) =>
      target.resourcePlans.every(
        (plan) => plan.selection.cardId === LOCATION_CANN0CK,
      )
    )).toBe(true);
  });

  it("emits only command-reducer-accepted selections", () => {
    const fixtures = [
      ["build-legal-command-cannock", LOCATION_CANN0CK],
      ["build-legal-command-stafford", LOCATION_STAFFORD],
      ["build-legal-command-birmingham", LOCATION_BIRMINGHAM],
    ] as const;
    let emitted = 0;

    for (const [seed, cardId] of fixtures) {
      const state = withCardInHand(
        createGameV2(["alice", "bob"], seed),
        "alice",
        cardId,
      );
      const options = getGameV2BuildLegalOptions(state, "alice", cardId);
      expect(options.availability).toBe("exact");
      for (const target of options.targets) {
        for (const [planIndex, plan] of target.resourcePlans.entries()) {
          emitted += 1;
          const accepted = expectCommandSuccess(executeGameV2Command(state, {
            schemaVersion: 1,
            commandId: `build-${target.buildSpaceId}-${target.industry}-${planIndex}`,
            gameId: state.gameId,
            expectedRevision: state.revision,
            actorSeat: "alice",
            command: { type: "BUILD", selection: plan.selection },
          }));
          expect(accepted.outcome).toMatchObject({
            kind: "player_action",
            actionType: "BUILD",
            effect: {
              placement: {
                buildSpaceId: target.buildSpaceId,
                tileId: target.tile.id,
              },
              resourceSources: plan.sources.map((source) =>
                source.kind === "market"
                  ? {
                      resource: source.resource,
                      kind: "market",
                      unitPrice: source.unitPrice,
                    }
                  : {
                      resource: source.resource,
                      kind: source.kind,
                      buildSpaceId: source.buildSpaceId,
                      depleted: source.depleted,
                    },
              ),
              moneySpent: plan.totalCost,
            },
          });
        }
      }
    }
    expect(emitted).toBeGreaterThan(3);
  });

  it("prunes unaffordable, disconnected, and occupied Build targets", () => {
    const cannockBase = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-blockers"),
      "alice",
      LOCATION_CANN0CK,
    );
    const broke = requireValid({
      ...cannockBase,
      players: {
        ...cannockBase.players,
        alice: { ...cannockBase.players.alice, money: 4 },
      },
    });
    expect(
      getGameV2BuildLegalOptions(broke, "alice", LOCATION_CANN0CK),
    ).toMatchObject({
      availability: "disabled",
      targets: [],
      reason: { code: "NO_LEGAL_BUILD" },
    });

    let occupied = placeTopTile(
      cannockBase,
      "alice",
      "cannock_1",
      "cannock",
      "manufacturer",
    );
    occupied = placeTopTile(
      occupied,
      "bob",
      "cannock_2",
      "cannock",
      "coal",
      { coal: 2 },
    );
    expect(
      getGameV2BuildLegalOptions(occupied, "alice", LOCATION_CANN0CK),
    ).toMatchObject({
      availability: "disabled",
      targets: [],
      reason: { code: "NO_LEGAL_BUILD" },
    });

    const birmingham = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-no-coal"),
      "alice",
      LOCATION_BIRMINGHAM,
    );
    const birminghamOptions = getGameV2BuildLegalOptions(
      birmingham,
      "alice",
      LOCATION_BIRMINGHAM,
    );
    expect(birminghamOptions.targets.some((target) =>
      target.buildSpaceId === "birmingham_1" && target.industry === "cotton"
    )).toBe(true);
    expect(birminghamOptions.targets.some((target) =>
      target.industry === "manufacturer"
    )).toBe(false);
  });

  it("keeps Industry-card builds in-network and board iron ahead of market iron", () => {
    let network = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-network"),
      "alice",
      INDUSTRY_COAL,
    );
    network = withBuiltLink(network, "link_birmingham_dudley", "alice");
    const networkOptions = getGameV2BuildLegalOptions(
      network,
      "alice",
      INDUSTRY_COAL,
    );
    expect(networkOptions.availability).toBe("exact");
    expect(networkOptions.targets.length).toBeGreaterThan(0);
    expect(networkOptions.targets.every((target) =>
      target.locationId === "birmingham" || target.locationId === "dudley"
    )).toBe(true);

    let iron = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-board-iron"),
      "alice",
      LOCATION_STAFFORD,
    );
    iron = placeTopTile(
      iron,
      "bob",
      "birmingham_3",
      "birmingham",
      "iron",
      { iron: 1 },
    );
    const ironOptions = getGameV2BuildLegalOptions(
      iron,
      "alice",
      LOCATION_STAFFORD,
    );
    const brewery = ironOptions.targets.find((target) =>
      target.buildSpaceId === "stafford_1" && target.industry === "brewery"
    );
    expect(brewery?.resourcePlans).toHaveLength(1);
    expect(brewery?.resourcePlans[0]).toMatchObject({
      sources: [{
        resource: "iron",
        kind: "works",
        buildSpaceId: "birmingham_3",
        locationId: "birmingham",
        locationLabel: "Birmingham",
        owner: "bob",
        depleted: true,
      }],
      resourceMarketCost: 0,
      totalCost: 5,
    });
    expect(brewery?.resourcePlans[0].sources.some(
      (source) => source.kind === "market",
    )).toBe(false);
  });

  it("canonicalizes equivalent two-source orders without losing the accepted Build", () => {
    let state = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-canonical-sources"),
      "alice",
      LOCATION_BIRMINGHAM,
    );
    state = requireValid({ ...state, era: "rail", actionLimit: 2 });
    state = advanceIndustryInventory(
      state,
      "alice",
      "manufacturer",
      "manufacturer-3-a",
    );
    state = placeTopTile(
      state,
      "alice",
      "tamworth_1",
      "tamworth",
      "coal",
      { coal: 1 },
    );
    state = placeTopTile(
      state,
      "bob",
      "dudley_1",
      "dudley",
      "coal",
      { coal: 1 },
    );
    state = withBuiltLink(state, "link_birmingham_tamworth", "alice");
    state = withBuiltLink(state, "link_birmingham_dudley", "bob");

    const options = getGameV2BuildLegalOptions(
      state,
      "alice",
      LOCATION_BIRMINGHAM,
    );
    const manufacturer = options.targets.find((target) =>
      target.buildSpaceId === "birmingham_1" &&
      target.industry === "manufacturer"
    );
    expect(manufacturer?.tile).toEqual({
      id: "manufacturer-3-a",
      faceId: "manufacturer-3",
      level: 3,
    });
    expect(manufacturer?.resourcePlans).toHaveLength(1);
    expect(manufacturer?.resourcePlans[0]).toMatchObject({
      sources: [
        { resource: "coal", kind: "mine", buildSpaceId: "tamworth_1" },
        { resource: "coal", kind: "mine", buildSpaceId: "dudley_1" },
      ],
      resourceMarketCost: 0,
      totalCost: 12,
    });

    const plan = manufacturer?.resourcePlans[0];
    if (!plan) throw new Error("Expected canonical manufacturer Build plan");
    expectCommandSuccess(executeGameV2Command(state, {
      schemaVersion: 1,
      commandId: "build-canonical-two-coal",
      gameId: state.gameId,
      expectedRevision: state.revision,
      actorSeat: "alice",
      command: { type: "BUILD", selection: plan.selection },
    }));

    const reversedSources = {
      ...plan.selection,
      coalSources: [...plan.selection.coalSources].reverse(),
    };
    const canonicalResult = executeBuildForGameV2(state, plan.selection);
    const reversedResult = executeBuildForGameV2(state, reversedSources);
    expect(canonicalResult.ok).toBe(true);
    expect(reversedResult.ok).toBe(true);
    if (!canonicalResult.ok || !reversedResult.ok) {
      throw new Error("Expected both equivalent coal orders to be accepted");
    }
    expect(reversedResult.state).toEqual(canonicalResult.state);
  });

  it("preflights targets before searching a dense board's resource products", () => {
    let state = withCardInHand(
      createGameV2(["alice", "bob", "carol", "dave"], "build-legal-dense"),
      "alice",
      LOCATION_BIRMINGHAM,
    );
    state = requireValid({
      ...state,
      era: "rail",
      actionLimit: 2,
      players: {
        ...state.players,
        alice: { ...state.players.alice, money: 100 },
      },
    });
    state = advanceIndustryInventory(
      state,
      "alice",
      "manufacturer",
      "manufacturer-3-a",
    );
    state = advanceIndustryInventory(
      state,
      "alice",
      "cotton",
      "cotton-2-a",
    );
    state = withBuiltLink(state, "link_birmingham_oxford", "alice");

    const seats = ["alice", "bob", "carol", "dave"] as const;
    const resourceSpaces = Object.entries(BOARD_V2.locations).flatMap(
      ([locationId, location]) =>
        "buildSpaces" in location && locationId !== "birmingham"
          ? location.buildSpaces.flatMap((space) => {
              const allows = space.allows as readonly string[];
              const industries: IndustryTileKind[] = [];
              if (allows.includes("coal_mine")) industries.push("coal");
              if (allows.includes("iron_works")) industries.push("iron");
              return industries.map((industry) => ({
                buildSpaceId: space.id,
                locationId,
                industry,
              }));
            })
          : [],
    );
    const usedSpaces = new Set<string>();
    for (const [index, candidate] of resourceSpaces.entries()) {
      if (usedSpaces.has(candidate.buildSpaceId)) continue;
      let rotatedOwner: typeof seats[number] | undefined;
      for (let offset = 0; offset < seats.length; offset += 1) {
        const seat = seats[(index + offset) % seats.length];
        if (
          state.players[seat].industryInventory.stacks[candidate.industry]
            .length > 0
        ) {
          rotatedOwner = seat;
          break;
        }
      }
      if (rotatedOwner === undefined) continue;
      state = placeTopTile(
        state,
        rotatedOwner,
        candidate.buildSpaceId,
        candidate.locationId,
        candidate.industry,
        candidate.industry === "coal" ? { coal: 1 } : { iron: 1 },
      );
      usedSpaces.add(candidate.buildSpaceId);
    }
    expect(usedSpaces.size).toBeGreaterThan(10);

    const direct = executeBuildForGameV2(state, {
      cardId: LOCATION_BIRMINGHAM,
      buildSpaceId: "birmingham_1",
      industry: "cotton",
      coalSources: [{ kind: "market" }],
      ironSources: [],
    });
    if (!direct.ok) {
      throw new Error(`${direct.error.code}: ${direct.error.message}`);
    }

    const started = performance.now();
    const options = getGameV2BuildLegalOptions(
      state,
      "alice",
      LOCATION_BIRMINGHAM,
    );
    const elapsed = performance.now() - started;
    expect(options.reason).toBeNull();
    expect(options.targets.some((target) =>
      target.locationId === "birmingham"
    )).toBe(true);
    expect(elapsed).toBeLessThan(1_000);
  });

  it("is deterministic, fail-closed, and does not mutate state", () => {
    const state = withCardInHand(
      createGameV2(["alice", "bob"], "build-legal-purity"),
      "alice",
      LOCATION_STAFFORD,
    );
    const snapshot = structuredClone(state);
    const first = getGameV2BuildLegalOptions(
      state,
      "alice",
      LOCATION_STAFFORD,
    );
    const second = getGameV2BuildLegalOptions(
      state,
      "alice",
      LOCATION_STAFFORD,
    );
    expect(first).toEqual(second);
    expect(state).toEqual(snapshot);

    const invalid = { ...state, revision: -1 } as GameStateV2;
    expect(
      getGameV2BuildLegalOptions(invalid, "alice", LOCATION_STAFFORD),
    ).toMatchObject({
      availability: "disabled",
      targets: [],
      reason: { code: "INVALID_GAME_STATE" },
    });
  });
});

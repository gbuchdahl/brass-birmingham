import { describe, expect, it } from "vitest";
import type { SellActionSelection } from "@/engine/actions-v2/sell";
import type { PlayableCardId } from "@/engine/cards-v2/types";
import {
  executeGameV2Command,
  replayGameV2Commands,
  type GameV2Command,
  type GameV2CommandEnvelope,
} from "@/engine/game-v2/commands";
import {
  deserializeGameV2,
  serializeGameV2,
} from "@/engine/game-v2/serialization";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
} from "@/engine/rules/generated/industry-tiles-v2";

function envelope(
  state: GameStateV2,
  commandId: string,
  actorSeat: string | null,
  command: GameV2Command,
): GameV2CommandEnvelope {
  return {
    schemaVersion: 1,
    commandId,
    gameId: state.gameId,
    expectedRevision: state.revision,
    actorSeat,
    command,
  };
}

function passCommand(
  state: GameStateV2,
  commandId: string,
  seat = state.currentSeat,
  cardId = state.cards.hands[seat][0],
): GameV2CommandEnvelope {
  return envelope(state, commandId, seat, { type: "PASS", cardId });
}

function expectSuccess(
  result: ReturnType<typeof executeGameV2Command>,
): asserts result is Extract<typeof result, { ok: true }> {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  expect(result.ok).toBe(true);
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
  if (!merchant) throw new Error("Expected an active Gloucester Merchant space");
  return {
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
}

function demandTileId(demand: string): IndustryTileId {
  if (demand === "cotton_mill") return "cotton-1-a";
  if (demand === "manufacturer") return "manufacturer-1-a";
  return "pottery-1-a";
}

function buildSpaceFor(tileId: IndustryTileId): {
  readonly spaceId: string;
  readonly locationId: string;
} {
  const tile = INDUSTRY_TILE_BY_ID[tileId];
  const boardKind = tile.industry === "cotton"
    ? "cotton_mill"
    : tile.industry;
  for (const [locationId, location] of Object.entries(BOARD_V2.locations)) {
    if (!("buildSpaces" in location)) continue;
    const space = location.buildSpaces.find((candidate) =>
      (candidate.allows as readonly string[]).includes(boardKind)
    );
    if (space) return { spaceId: space.id, locationId };
  }
  throw new Error(`No build space for ${tileId}`);
}

function linkPath(from: string, to: string, era: GameStateV2["era"]): string[] {
  const queue: Array<{ readonly locationId: string; readonly links: string[] }> = [{
    locationId: from,
    links: [],
  }];
  const visited = new Set([from]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.locationId === to) return current.links;
    for (const link of BOARD_V2.links) {
      if (!(link.eras as readonly string[]).includes(era)) continue;
      if (!(link.adjacentLocations as readonly string[]).includes(current.locationId)) {
        continue;
      }
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

function realGloucesterSellFixture(): {
  readonly state: GameStateV2;
  readonly selection: SellActionSelection;
} {
  for (let index = 0; index < 100; index += 1) {
    const base = createGameV2(
      ["alice", "bob"],
      `command-real-gloucester-${index}`,
    );
    const merchant = base.merchants.spaces.find(
      (space) =>
        space.active &&
        space.locationId === "merchant_gloucester" &&
        space.beer === 1 &&
        space.demandIndustries.length > 0,
    );
    if (!merchant) continue;
    const tileId = demandTileId(merchant.demandIndustries[0]);
    const tile = INDUSTRY_TILE_BY_ID[tileId];
    const buildSpace = buildSpaceFor(tileId);
    const stack = base.players.alice.industryInventory.stacks[tile.industry];
    const tileIndex = stack.indexOf(tileId);
    if (tileIndex < 0) throw new Error("Fixture tile is not in inventory");
    const links = linkPath(buildSpace.locationId, merchant.locationId, base.era);
    if (links.length > base.players.bob.linkTokensRemaining) continue;
    const state: GameStateV2 = {
      ...base,
      players: {
        ...base.players,
        alice: {
          ...base.players.alice,
          industryInventory: {
            ...base.players.alice.industryInventory,
            stacks: {
              ...base.players.alice.industryInventory.stacks,
              [tile.industry]: stack.slice(tileIndex + 1),
            },
          },
          removedIndustryTileIds: [
            ...base.players.alice.removedIndustryTileIds,
            ...stack.slice(0, tileIndex),
          ],
        },
        bob: {
          ...base.players.bob,
          linkTokensRemaining:
            base.players.bob.linkTokensRemaining - links.length,
        },
      },
      board: {
        builtLinks: Object.fromEntries(links.map((linkId) => [linkId, "bob"])),
        placedIndustries: {
          [buildSpace.spaceId]: {
            owner: "alice",
            tileId,
            locationId: buildSpace.locationId,
            spaceId: buildSpace.spaceId,
            resources: { coal: 0, iron: 0, beer: 0 },
            flipped: false,
          },
        },
      },
    };
    const validation = validateGameStateV2(state);
    if (!validation.ok) {
      throw new Error(validation.errors.map((error) => error.message).join("\n"));
    }
    return {
      state,
      selection: {
        cardId: state.cards.hands.alice[0],
        sales: [{
          industryId: buildSpace.spaceId,
          merchantSpaceId: merchant.merchantSpaceId,
          beerSource: { kind: "merchant" },
        }],
      },
    };
  }
  throw new Error("Could not find a deterministic Gloucester demand fixture");
}

describe("GameStateV2 versioned command execution", () => {
  it("composes Pass with turn lifecycle and records one revision", () => {
    const state = createGameV2(["alice", "bob"], "command-pass");
    const cardId = state.cards.hands.alice[0];

    const result = executeGameV2Command(
      state,
      passCommand(state, "pass-alice", "alice", cardId),
    );

    expectSuccess(result);
    expect(validateGameStateV2(result.state)).toMatchObject({ ok: true });
    expect(result.state.revision).toBe(1);
    expect(result.state.currentSeat).toBe("bob");
    expect(result.state.cards.hands.alice).toHaveLength(8);
    expect(result.state.cards.discard).toContain(cardId);
    expect(result.state.events.slice(-2).map((event) => event.type)).toEqual([
      "ACTION_ACCEPTED",
      "COMMAND_APPLIED",
    ]);
    expect(result.outcome).toMatchObject({
      kind: "player_action",
      actionType: "PASS",
      pendingFollowUp: false,
      turnComplete: true,
    });
    expect(state.revision).toBe(0);
    expect(state.currentSeat).toBe("alice");
  });

  it("executes a Loan end to end through the same boundary", () => {
    const state = createGameV2(["alice", "bob"], "command-loan");
    const cardId = state.cards.hands.alice[0];
    const result = executeGameV2Command(
      state,
      envelope(state, "loan-alice", "alice", { type: "LOAN", cardId }),
    );

    expectSuccess(result);
    expect(result.state.players.alice.money).toBe(47);
    expect(result.state.players.alice.incomeMarkerSpace)
      .toBeLessThan(state.players.alice.incomeMarkerSpace);
    expect(result.state.roundSpend.alice).toBe(0);
    expect(result.state.currentSeat).toBe("bob");
  });

  it("executes Network, Develop, and Scout through the unified lifecycle", () => {
    const networkState = createGameV2(
      ["alice", "bob"],
      "command-network",
    );
    const canalLink = BOARD_V2.links.find((link) =>
      (link.eras as readonly string[]).includes("canal")
    );
    if (!canalLink) throw new Error("Expected a Canal link");
    const network = executeGameV2Command(
      networkState,
      envelope(networkState, "network-alice", "alice", {
        type: "NETWORK",
        selection: {
          linkIds: [canalLink.id],
          coalSources: [],
          beerSourceId: null,
          cardId: networkState.cards.hands.alice[0],
        },
      }),
    );
    expectSuccess(network);
    expect(network.state.board.builtLinks[canalLink.id]).toBe("alice");
    expect(network.state.roundSpend.alice).toBe(3);

    const developState = createGameV2(
      ["alice", "bob"],
      "command-develop",
    );
    const tileId = developState.players.alice.industryInventory
      .stacks.manufacturer[0];
    const develop = executeGameV2Command(
      developState,
      envelope(developState, "develop-alice", "alice", {
        type: "DEVELOP",
        selection: {
          cardId: developState.cards.hands.alice[0],
          tileIds: [tileId],
          accessibleIronIndustryIds: [],
          purchaseMarketShortfall: true,
        },
      }),
    );
    expectSuccess(develop);
    expect(develop.state.players.alice.removedIndustryTileIds).toContain(tileId);
    expect(develop.state.roundSpend.alice).toBeGreaterThan(0);

    const scoutState = createGameV2(["alice", "bob"], "command-scout");
    const cardsToDiscard = scoutState.cards.hands.alice.slice(0, 3) as [
      PlayableCardId,
      PlayableCardId,
      PlayableCardId,
    ];
    const scout = executeGameV2Command(
      scoutState,
      envelope(scoutState, "scout-alice", "alice", {
        type: "SCOUT",
        selection: { cardsToDiscard },
      }),
    );
    expectSuccess(scout);
    expect(scout.state.cards.hands.alice).toContain("wild-location");
    expect(scout.state.cards.hands.alice).toContain("wild-industry");
    expect(scout.state.roundSpend.alice).toBe(0);
  });

  it("routes Build and Sell domain failures without persisting partial state", () => {
    const state = createGameV2(["alice", "bob"], "command-routing");
    const build = executeGameV2Command(
      state,
      envelope(state, "build-invalid", "alice", {
        type: "BUILD",
        selection: {
          buildSpaceId: "not-a-space",
          industry: "brewery",
          cardId: state.cards.hands.alice[0],
          coalSources: [],
          ironSources: [],
        },
      }),
    );
    expect(build).toMatchObject({
      ok: false,
      error: { source: "action", actionType: "BUILD" },
    });
    expect(build.state).toBe(state);

    const sell = executeGameV2Command(
      state,
      envelope(state, "sell-invalid", "alice", {
        type: "SELL",
        selection: {
          cardId: state.cards.hands.alice[0],
          sales: [],
        },
      }),
    );
    expect(sell).toMatchObject({
      ok: false,
      error: {
        source: "action",
        actionType: "SELL",
        code: "INVALID_SALE_COUNT",
      },
    });
    expect(sell.state).toBe(state);
  });

  it.each([
    ["stale revision", (state: GameStateV2) => ({
      ...passCommand(state, "stale"),
      expectedRevision: 4,
    }), "REVISION_CONFLICT"],
    ["wrong game", (state: GameStateV2) => ({
      ...passCommand(state, "wrong-game"),
      gameId: "another-game",
    }), "GAME_ID_MISMATCH"],
    ["wrong actor", (state: GameStateV2) =>
      passCommand(state, "wrong-actor", "bob", state.cards.hands.bob[0]),
    "NOT_CURRENT_ACTOR"],
    ["unknown actor", (state: GameStateV2) =>
      passCommand(state, "unknown-actor", "ghost", state.cards.hands.alice[0]),
    "UNKNOWN_ACTOR"],
    ["domain rejection", (state: GameStateV2) =>
      passCommand(state, "missing-card", "alice", "not-a-card" as PlayableCardId),
    "CARD_NOT_IN_HAND"],
  ] as const)("rejects %s with exact state identity", (_label, create, code) => {
    const state = createGameV2(["alice", "bob"], `command-${_label}`);
    const result = executeGameV2Command(state, create(state));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected command rejection");
    expect(result.error.code).toBe(code);
    expect(result.state).toBe(state);
    expect(result.state.revision).toBe(0);
  });

  it("rejects malformed and cyclic command envelopes without throwing", () => {
    const state = createGameV2(["alice", "bob"], "command-malformed");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const invalid of [null, cyclic, {
      ...passCommand(state, "malformed"),
      command: { type: "SCOUT", selection: {} },
    }]) {
      const result = executeGameV2Command(state, invalid);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
    }
  });

  it("checks game identity, duplicate IDs, then revisions in stable order", () => {
    const state = createGameV2(["alice", "bob"], "command-duplicate");
    const first = executeGameV2Command(state, passCommand(state, "same-id"));
    expectSuccess(first);
    const wrongGame = executeGameV2Command(first.state, {
      ...passCommand(first.state, "same-id"),
      gameId: "another-game",
    });
    expect(wrongGame).toMatchObject({
      ok: false,
      error: { code: "GAME_ID_MISMATCH" },
    });
    const duplicate = executeGameV2Command(first.state, {
      ...passCommand(first.state, "same-id"),
      expectedRevision: 0,
    });
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "COMMAND_ID_ALREADY_USED" },
    });
    expect(duplicate.state).toBe(first.state);
  });

  it("supports prototype-like seat IDs without corrupting command lookup", () => {
    const state = createGameV2(
      ["__proto__", "constructor"],
      "command-prototype-seats",
    );
    const result = executeGameV2Command(
      state,
      passCommand(state, "prototype-pass"),
    );

    expectSuccess(result);
    expect(result.state.currentSeat).toBe("constructor");
    expect(result.state.players["__proto__"].seat).toBe("__proto__");
    expect(Object.hasOwn(result.state.players, "constructor")).toBe(true);
  });

  it("accepts the last safe revision and rejects revision overflow", () => {
    const base = createGameV2(["alice", "bob"], "command-revision-limit");
    const lastSafeInput: GameStateV2 = {
      ...base,
      revision: Number.MAX_SAFE_INTEGER - 1,
    };
    const accepted = executeGameV2Command(
      lastSafeInput,
      passCommand(lastSafeInput, "last-safe-revision"),
    );
    expectSuccess(accepted);
    expect(accepted.state.revision).toBe(Number.MAX_SAFE_INTEGER);

    const overflowState: GameStateV2 = {
      ...base,
      revision: Number.MAX_SAFE_INTEGER,
    };
    const rejected = executeGameV2Command(
      overflowState,
      passCommand(overflowState, "revision-overflow"),
    );
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "REVISION_OVERFLOW" },
    });
    expect(rejected.state).toBe(overflowState);
  });

  it("resolves a persisted Merchant free Develop before advancing the Sell", () => {
    const state = pendingFreeDevelop(
      createGameV2(["alice", "bob"], "merchant-free-develop"),
    );
    expect(validateGameStateV2(state)).toMatchObject({ ok: true });
    const tileId = state.players.alice.industryInventory.stacks.manufacturer[0];
    const cardCount = state.cards.hands.alice.length;
    const result = executeGameV2Command(
      state,
      envelope(state, "free-develop", "alice", {
        type: "RESOLVE_MERCHANT_FREE_DEVELOP",
        selection: { tileIds: [tileId] },
      }),
    );

    expectSuccess(result);
    expect(result.state.revision).toBe(1);
    expect(result.state.currentSeat).toBe("bob");
    expect(result.state.players.alice.removedIndustryTileIds).toContain(tileId);
    expect(result.state.cards.hands.alice).toHaveLength(cardCount);
    expect(result.state.roundSpend.alice).toBe(0);
    expect(result.state.events.slice(-3).map((event) => event.type)).toEqual([
      "MERCHANT_FREE_DEVELOP_RESOLVED",
      "ACTION_ACCEPTED",
      "COMMAND_APPLIED",
    ]);
  });

  it("persists and resumes a real Gloucester Sell across serialization", () => {
    const fixture = realGloucesterSellFixture();
    const sold = executeGameV2Command(
      fixture.state,
      envelope(fixture.state, "sell-gloucester", "alice", {
        type: "SELL",
        selection: fixture.selection,
      }),
    );
    expectSuccess(sold);
    expect(sold.state.revision).toBe(1);
    expect(sold.state.currentSeat).toBe("alice");
    expect(sold.state.progress.phase).toBe("merchant_free_develop");
    expect(sold.outcome).toMatchObject({
      kind: "player_action",
      actionType: "SELL",
      pendingFollowUp: true,
    });

    const restored = deserializeGameV2(serializeGameV2(sold.state));
    const tileId = restored.players.alice.industryInventory.stacks.coal[0];
    const resolved = executeGameV2Command(
      restored,
      envelope(restored, "resolve-gloucester", "alice", {
        type: "RESOLVE_MERCHANT_FREE_DEVELOP",
        selection: { tileIds: [tileId] },
      }),
    );
    expectSuccess(resolved);
    expect(resolved.state.revision).toBe(2);
    expect(resolved.state.currentSeat).toBe("bob");
    expect(resolved.state.progress).toEqual({ phase: "action" });
    expect(resolved.state.players.alice.removedIndustryTileIds).toContain(tileId);
  });

  it("settles an explicitly completed round as a system command", () => {
    const initial = createGameV2(["alice", "bob"], "command-settlement");
    const alice = executeGameV2Command(
      initial,
      passCommand(initial, "alice-pass"),
    );
    expectSuccess(alice);
    const bob = executeGameV2Command(
      alice.state,
      passCommand(alice.state, "bob-pass"),
    );
    expectSuccess(bob);
    expect(bob.state.progress).toEqual({ phase: "round_settlement" });

    const settled = executeGameV2Command(
      bob.state,
      envelope(bob.state, "settle-one", null, {
        type: "SETTLE_ROUND",
        liquidationChoices: {},
      }),
    );
    expectSuccess(settled);
    expect(settled.state.revision).toBe(3);
    expect(settled.state.round).toBe(2);
    expect(settled.state.progress).toEqual({ phase: "action" });
    expect(settled.state.events.slice(-2).map((event) => event.type)).toEqual([
      "ROUND_SETTLED",
      "COMMAND_APPLIED",
    ]);
  });
});

describe("GameStateV2 command replay", () => {
  it("replays to byte-identical serialized state", () => {
    const initial = createGameV2(["alice", "bob"], "command-replay");
    const firstCommand = passCommand(initial, "replay-alice");
    const afterFirst = executeGameV2Command(initial, firstCommand);
    expectSuccess(afterFirst);
    const commands = [
      firstCommand,
      passCommand(afterFirst.state, "replay-bob"),
    ];

    const first = replayGameV2Commands(initial, commands);
    const second = replayGameV2Commands(initial, commands);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(serializeGameV2(first.state)).toBe(serializeGameV2(second.state));
    expect(initial.revision).toBe(0);
  });

  it("stops at the first failure and preserves the last accepted state", () => {
    const initial = createGameV2(["alice", "bob"], "command-replay-failure");
    const firstCommand = passCommand(initial, "replay-first");
    const afterFirst = executeGameV2Command(initial, firstCommand);
    expectSuccess(afterFirst);
    const failed = replayGameV2Commands(initial, [
      firstCommand,
      {
        ...passCommand(afterFirst.state, "replay-stale"),
        expectedRevision: 0,
      },
    ]);

    expect(failed).toMatchObject({
      ok: false,
      commandsApplied: 1,
      failedCommandIndex: 1,
      error: { code: "REVISION_CONFLICT" },
    });
    expect(failed.state).toEqual(afterFirst.state);
  });

  it("plays and replays a complete two-era all-Pass game to final standings", () => {
    const initial = createGameV2(["alice", "bob"], "command-complete-game");
    const commands: GameV2CommandEnvelope[] = [];
    let state = initial;

    for (let ordinal = 1; ordinal <= 200; ordinal += 1) {
      if (state.progress.phase === "ended") break;
      const commandId = `complete-${ordinal}`;
      const nextEnvelope = state.progress.phase === "action"
        ? passCommand(state, commandId)
        : state.progress.phase === "round_settlement"
          ? envelope(state, commandId, null, {
              type: "SETTLE_ROUND",
              liquidationChoices: {},
            })
          : state.progress.phase === "era_transition"
            ? envelope(state, commandId, null, { type: "RESOLVE_ERA" })
            : null;
      if (!nextEnvelope) {
        throw new Error(`Unexpected complete-game phase: ${state.progress.phase}`);
      }
      const result = executeGameV2Command(state, nextEnvelope);
      expectSuccess(result);
      commands.push(nextEnvelope);
      state = result.state;
    }

    expect(state.progress.phase).toBe("ended");
    expect(state.era).toBe("rail");
    expect(state.revision).toBe(commands.length);
    expect(validateGameStateV2(state)).toMatchObject({ ok: true });
    const replayed = replayGameV2Commands(initial, commands);
    expect(replayed.ok).toBe(true);
    expect(serializeGameV2(replayed.state)).toBe(serializeGameV2(state));
  });
});

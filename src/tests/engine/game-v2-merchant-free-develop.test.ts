import { describe, expect, it } from "vitest";
import {
  resolveMerchantFreeDevelopV2,
  type MerchantFreeDevelopSelectionV2,
} from "@/engine/game-v2/merchant-free-develop";
import {
  createGameV2,
  validateGameStateV2,
  type GameStateV2,
} from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";

function withPendingFreeDevelop(state: GameStateV2): GameStateV2 {
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

function requireSuccess(
  result: ReturnType<typeof resolveMerchantFreeDevelopV2>,
): asserts result is Extract<typeof result, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
}

describe("GameStateV2 Merchant free Develop", () => {
  it("removes the selected lowest tile without card, resource, money, or lifecycle costs", () => {
    const pending = withPendingFreeDevelop(
      createGameV2(["alice", "bob"], "merchant-free-develop"),
    );
    expect(validateGameStateV2(pending)).toMatchObject({ ok: true });
    const playerBefore = pending.players.alice;
    const cardZonesBefore = pending.cards;
    const marketBefore = pending.market;
    const tileId = playerBefore.industryInventory.stacks.manufacturer[0];

    const result = resolveMerchantFreeDevelopV2(pending, { tileIds: [tileId] });

    requireSuccess(result);
    expect(validateGameStateV2(result.state)).toMatchObject({ ok: true });
    expect(result.state.progress).toEqual({ phase: "action" });
    expect(result.state.players.alice.industryInventory.stacks.manufacturer)
      .toEqual(playerBefore.industryInventory.stacks.manufacturer.slice(1));
    expect(result.state.players.alice.removedIndustryTileIds).toContain(tileId);
    expect(result.state.players.alice.money).toBe(playerBefore.money);
    expect(result.state.cards).toBe(cardZonesBefore);
    expect(result.state.market).toBe(marketBefore);
    expect(result.state.revision).toBe(pending.revision);
    expect(result.state.turnNumber).toBe(pending.turnNumber);
    expect(result.state.actionsUsed).toBe(pending.actionsUsed);
    expect(result.effect).toMatchObject({
      type: "MERCHANT_FREE_DEVELOP_RESOLVED",
      seat: "alice",
      removedTileIds: [tileId],
    });
  });

  it("clears an unavailable bonus when no developable top tile remains", () => {
    const pending = withPendingFreeDevelop(
      createGameV2(["alice", "bob"], "merchant-free-develop"),
    );
    const player = pending.players.alice;
    const remainingTileIds = Object.values(
      player.industryInventory.stacks,
    ).flat();
    const exhausted: GameStateV2 = {
      ...pending,
      players: {
        ...pending.players,
        alice: {
          ...player,
          industryInventory: {
            ...player.industryInventory,
            stacks: {
              manufacturer: [],
              cotton: [],
              brewery: [],
              coal: [],
              pottery: [],
              iron: [],
            },
          },
          removedIndustryTileIds: [
            ...player.removedIndustryTileIds,
            ...remainingTileIds,
          ],
        },
      },
    };
    expect(validateGameStateV2(exhausted)).toMatchObject({ ok: true });

    const result = resolveMerchantFreeDevelopV2(exhausted, { tileIds: [] });

    requireSuccess(result);
    expect(result.state.progress).toEqual({ phase: "action" });
    expect(result.effect).toMatchObject({
      removedTileIds: [],
      skippedUnavailableBonuses: 1,
    });
  });

  it.each([
    ["no pending follow-up", (state: GameStateV2) => state, { tileIds: ["coal-1-a"] }],
    [
      "the wrong number of tiles",
      withPendingFreeDevelop,
      { tileIds: [] },
    ],
    [
      "a protected pottery tile",
      withPendingFreeDevelop,
      { tileIds: ["pottery-1-a"] },
    ],
  ] as const)("rejects %s with exact state identity", (_label, prepare, selection) => {
    const state = prepare(
      createGameV2(["alice", "bob"], "merchant-free-develop"),
    );
    const result = resolveMerchantFreeDevelopV2(
      state,
      selection as MerchantFreeDevelopSelectionV2,
    );
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });
});

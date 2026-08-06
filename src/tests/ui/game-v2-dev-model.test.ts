import { describe, expect, it } from "vitest";
import { createGameV2, validateGameStateV2 } from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import { SETUP_DATA } from "@/engine/rules/generated/ruleset";
import {
  gameV2DevSeats,
  toGameV2DevModel,
  type GameV2DevPlayerCount,
} from "@/ui/game-v2-dev-model";

const PLAYER_COUNTS = [2, 3, 4] as const satisfies readonly GameV2DevPlayerCount[];

describe("GameV2 dev presentation model", () => {
  it.each(PLAYER_COUNTS)(
    "projects a complete deterministic %i-player setup",
    (playerCount) => {
      const seed = `dev-model-${playerCount}`;
      const seats = gameV2DevSeats(playerCount);
      const state = createGameV2(seats, seed);
      const repeated = createGameV2(seats, seed);
      expect(validateGameStateV2(state)).toMatchObject({ ok: true });

      const model = toGameV2DevModel(state);
      expect(toGameV2DevModel(repeated)).toEqual(model);
      expect(model.identity).toMatchObject({
        gameId: state.gameId,
        seed,
        schemaVersion: 2,
      });
      expect(model.progress).toEqual({
        era: "canal",
        round: 1,
        turnNumber: 1,
        currentSeat: "Player 1",
        actionsUsed: 0,
        actionLimit: 1,
        revision: 0,
      });

      expect(model.players.map((player) => player.seat)).toEqual(seats);
      expect(model.players.filter((player) => player.isCurrent).map((player) => player.seat))
        .toEqual(["Player 1"]);
      for (const player of model.players) {
        expect(player).toMatchObject({
          money: SETUP_DATA.shared.startingMoney,
          victoryPoints: 0,
          linkTokensRemaining: SETUP_DATA.shared.linksPerPlayer,
          removedIndustryTiles: 0,
        });
        expect(player.hand).toHaveLength(SETUP_DATA.shared.handSize);
        expect(player.inventory).toHaveLength(6);
        expect(
          player.inventory.reduce((total, industry) => total + industry.remaining, 0),
        ).toBe(SETUP_DATA.shared.industryTilesPerPlayer);
        expect(player.inventory.every((industry) => industry.nextLevel === 1)).toBe(true);
      }

      expect(model.cards).toEqual({
        draw:
          SETUP_DATA.playerCounts[playerCount].regularCards -
          playerCount * (SETUP_DATA.shared.handSize + 1),
        discard: playerCount,
        inHands: playerCount * SETUP_DATA.shared.handSize,
        wildLocation: SETUP_DATA.shared.wildLocationCards,
        wildIndustry: SETUP_DATA.shared.wildIndustryCards,
      });
      expect(model.merchants.filter((space) => space.active)).toHaveLength(
        BOARD_V2.playerCountRules[playerCount].activeMerchantSpaces,
      );
      expect(model.board.locations).toHaveLength(BOARD_V2.counts.locations);
      expect(model.board).toMatchObject({
        buildSpaceCount: BOARD_V2.counts.buildSpaces,
        occupiedBuildSpaces: 0,
      });
      expect(
        model.board.locations
          .flatMap((location) => location.buildSpaces)
          .every((space) => space.allowed.length > 0 && space.placement === null),
      ).toBe(true);
      expect(model.links).toMatchObject({
        built: 0,
        total: BOARD_V2.counts.links,
        availableInEra: BOARD_V2.counts.canalLinks,
        entries: [],
      });
      expect(model.events.map((event) => event.type)).toEqual(["GAME_CREATED"]);
      expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    },
  );

  it("uses stable, distinct seat labels for every supported count", () => {
    expect(gameV2DevSeats(2)).toEqual(["Player 1", "Player 2"]);
    expect(gameV2DevSeats(3)).toEqual(["Player 1", "Player 2", "Player 3"]);
    expect(gameV2DevSeats(4)).toEqual([
      "Player 1",
      "Player 2",
      "Player 3",
      "Player 4",
    ]);
  });
});

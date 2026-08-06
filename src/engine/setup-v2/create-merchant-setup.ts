import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  MERCHANT_TILE_CATALOG,
  MERCHANT_TILE_COUNTS_BY_PLAYER_COUNT,
  type RulesMerchantDemandIndustry,
  type RulesMerchantTileId,
} from "../rules/generated/merchant-tiles";
import { RULESET_META } from "../rules/generated/ruleset";
import { shuffleInPlace } from "../util/rng";
import type { SupportedPlayerCount } from "./types";

export const MERCHANT_SETUP_SCHEMA_VERSION = 1 as const;

type MerchantLocation = Extract<
  (typeof BOARD_V2.locations)[keyof typeof BOARD_V2.locations],
  { kind: "merchant" }
>;

export type MerchantSpaceSetup = {
  locationId: string;
  merchantSpaceId: string;
  active: boolean;
  tileId: RulesMerchantTileId | null;
  demandIndustries: RulesMerchantDemandIndustry[];
  beer: 0 | 1;
};

export type MerchantSetupResult = {
  schemaVersion: typeof MERCHANT_SETUP_SCHEMA_VERSION;
  ruleset: {
    id: string;
    version: string;
  };
  boardData: {
    schemaVersion: number;
    rulesetId: string;
  };
  playerCount: SupportedPlayerCount;
  seed: string;
  spaces: MerchantSpaceSetup[];
  returnedToBox: RulesMerchantTileId[];
};

function validatePlayerCount(playerCount: number): SupportedPlayerCount {
  if (playerCount !== 2 && playerCount !== 3 && playerCount !== 4) {
    throw new RangeError("Brass: Birmingham requires 2–4 players");
  }
  return playerCount;
}

function validateSeed(seed: string): void {
  if (typeof seed !== "string") {
    throw new TypeError("Merchant setup seed must be a string");
  }
}

function merchantLocations(): [string, MerchantLocation][] {
  return Object.entries(BOARD_V2.locations).filter(
    (entry): entry is [string, MerchantLocation] => entry[1].kind === "merchant",
  );
}

/**
 * Deterministically places the player-count-eligible retail Merchant tiles.
 *
 * Every board Merchant space is represented. Inactive player-count locations
 * stay empty, and demand-blank Merchant tiles are active but receive no beer.
 * Generated rules data is copied before shuffling and is never mutated.
 */
export function createMerchantSetup(
  playerCount: number,
  seed: string,
): MerchantSetupResult {
  const supportedPlayerCount = validatePlayerCount(playerCount);
  validateSeed(seed);

  const catalogIds = MERCHANT_TILE_CATALOG.map((tile) => tile.id);
  if (new Set(catalogIds).size !== catalogIds.length) {
    throw new Error("Generated Merchant tile catalog contains duplicate IDs");
  }

  const eligibleTiles = MERCHANT_TILE_CATALOG.filter(
    (tile) => tile.minPlayers <= supportedPlayerCount,
  );
  const returnedToBox = MERCHANT_TILE_CATALOG.filter(
    (tile) => tile.minPlayers > supportedPlayerCount,
  ).map((tile) => tile.id);
  const expectedTileCount =
    MERCHANT_TILE_COUNTS_BY_PLAYER_COUNT[supportedPlayerCount];
  if (eligibleTiles.length !== expectedTileCount) {
    throw new Error(
      `Generated Merchant tile count disagrees for ${supportedPlayerCount} players`,
    );
  }

  const activeLocationIds = new Set<string>(
    BOARD_V2.playerCountRules[supportedPlayerCount].merchantTileLocations,
  );
  const allMerchantLocations = merchantLocations();
  for (const locationId of activeLocationIds) {
    if (!allMerchantLocations.some(([candidateId]) => candidateId === locationId)) {
      throw new Error(`Unknown active Merchant location ${locationId}`);
    }
  }

  const activeSpaces = allMerchantLocations.flatMap(([locationId, location]) =>
    activeLocationIds.has(locationId)
      ? location.merchantSpaces.map((merchantSpaceId) => ({
          locationId,
          merchantSpaceId,
        }))
      : [],
  );
  const expectedSpaceCount =
    BOARD_V2.playerCountRules[supportedPlayerCount].activeMerchantSpaces;
  if (
    activeSpaces.length !== expectedSpaceCount ||
    activeSpaces.length !== expectedTileCount
  ) {
    throw new Error(
      `Board spaces and Merchant tiles disagree for ${supportedPlayerCount} players`,
    );
  }

  const shuffledTiles = shuffleInPlace([...eligibleTiles], seed);
  let nextTile = 0;
  const spaces = allMerchantLocations.flatMap(([locationId, location]) =>
    location.merchantSpaces.map((merchantSpaceId): MerchantSpaceSetup => {
      if (!activeLocationIds.has(locationId)) {
        return {
          locationId,
          merchantSpaceId,
          active: false,
          tileId: null,
          demandIndustries: [],
          beer: 0,
        };
      }

      const tile = shuffledTiles[nextTile];
      nextTile += 1;
      const demandIndustries = [...tile.demandIndustries];
      return {
        locationId,
        merchantSpaceId,
        active: true,
        tileId: tile.id,
        demandIndustries,
        beer: demandIndustries.length === 0 ? 0 : 1,
      };
    }),
  );

  const placedTileIds = spaces.flatMap((space) =>
    space.tileId === null ? [] : [space.tileId],
  );
  const conservedIds = [...placedTileIds, ...returnedToBox];
  if (
    placedTileIds.length !== expectedTileCount ||
    new Set(conservedIds).size !== MERCHANT_TILE_CATALOG.length ||
    conservedIds.length !== MERCHANT_TILE_CATALOG.length
  ) {
    throw new Error("Merchant setup failed tile conservation");
  }

  return {
    schemaVersion: MERCHANT_SETUP_SCHEMA_VERSION,
    ruleset: {
      id: RULESET_META.id,
      version: RULESET_META.version,
    },
    boardData: {
      schemaVersion: BOARD_V2.schemaVersion,
      rulesetId: BOARD_V2.rulesetId,
    },
    playerCount: supportedPlayerCount,
    seed,
    spaces,
    returnedToBox,
  };
}

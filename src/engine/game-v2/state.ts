import type { CardZones } from "../cards-v2/types";
import { WILD_INDUSTRY_CARD_ID, WILD_LOCATION_CARD_ID } from "../cards-v2/types";
import {
  createResourceMarketState,
  purchaseFromResourceMarket,
  type ResourceMarketState,
} from "../economy/markets";
import { incomeLevelAt } from "../economy/income";
import { actionsPerTurn, createRoundSpendLedger } from "../lifecycle";
import {
  createIndustryInventory,
  type IndustryInventory,
} from "../player-v2";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  CARD_CATALOG,
  CARD_DATA_RULESET,
  WILD_CARD_SUPPLY,
} from "../rules/generated/cards";
import { INCOME_TRACK_DATA } from "../rules/generated/income-track";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_DATA_VERSION,
  INDUSTRY_TILE_STACKS,
  INDUSTRY_TILES,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import {
  MERCHANT_TILE_CATALOG,
  MERCHANT_TILE_DATA_META,
  type RulesMerchantTileId,
} from "../rules/generated/merchant-tiles";
import { RULESET_META, SETUP_DATA } from "../rules/generated/ruleset";
import {
  rankFinalStandings,
  type PlayerStanding,
} from "../scoring/era-transition";
import {
  createCanalSetup,
  createMerchantSetup,
  type MerchantSpaceSetup,
  type SupportedPlayerCount,
} from "../setup-v2";
import {
  RANDOM_ALGORITHM,
  createRandomState,
  type RandomState,
} from "../util/random-state";

export const GAME_STATE_V2_SCHEMA_VERSION = 3 as const;

export type GameEraV2 = "canal" | "rail";

export type PlayerStateV2 = {
  readonly seat: string;
  readonly money: number;
  readonly incomeMarkerSpace: number;
  readonly victoryPoints: number;
  readonly industryInventory: IndustryInventory;
  /** Tiles removed by Develop, cleanup, overbuilding, or liquidation. */
  readonly removedIndustryTileIds: IndustryTileId[];
  readonly linkTokensRemaining: number;
};

export type PlacedIndustryStateV2 = {
  readonly owner: string;
  readonly tileId: IndustryTileId;
  readonly locationId: string;
  readonly spaceId: string;
  readonly resources: {
    readonly coal: number;
    readonly iron: number;
    readonly beer: number;
  };
  readonly flipped: boolean;
};

export type GameEventV2 = {
  readonly sequence: number;
  readonly type: string;
  readonly data: unknown;
};

export type PendingMerchantFreeDevelopV2 = {
  readonly seat: string;
  readonly count: number;
  readonly source: "merchant_bonus";
  readonly merchantSpaceIds: readonly string[];
};

/**
 * Authoritative game-flow state. The discriminated union prevents pending and
 * terminal payloads from existing outside the phase that owns them.
 */
export type GameProgressV2 =
  | { readonly phase: "action" }
  | { readonly phase: "round_settlement" }
  | { readonly phase: "era_transition" }
  | {
      readonly phase: "merchant_free_develop";
      readonly pending: PendingMerchantFreeDevelopV2;
    }
  | {
      readonly phase: "ended";
      readonly terminal: {
        readonly standings: readonly PlayerStanding[];
      };
    };

export type GameStateV2 = {
  readonly schemaVersion: typeof GAME_STATE_V2_SCHEMA_VERSION;
  readonly ruleset: {
    readonly id: string;
    readonly version: string;
    readonly dataSchemas: {
      readonly ruleset: number;
      readonly board: number;
      readonly boardRulesetId: string;
      readonly cardsRuleset: string;
      readonly incomeTrack: number;
      readonly industryTiles: number;
      readonly merchantTiles: number;
      readonly merchantRulesetId: string;
    };
  };
  readonly revision: number;
  readonly gameId: string;
  readonly seed: string;
  readonly setupSeeds: {
    readonly cards: string;
    readonly merchants: string;
    readonly random: string;
  };
  readonly randomState: RandomState;
  readonly progress: GameProgressV2;
  readonly era: GameEraV2;
  readonly round: number;
  readonly turnNumber: number;
  readonly turnOrder: string[];
  readonly currentSeat: string;
  readonly actionsUsed: number;
  readonly actionLimit: 1 | 2;
  readonly roundSpend: Readonly<Record<string, number>>;
  readonly players: Record<string, PlayerStateV2>;
  readonly cards: CardZones;
  readonly market: ResourceMarketState;
  readonly merchants: {
    readonly spaces: MerchantSpaceSetup[];
    readonly returnedToBox: RulesMerchantTileId[];
  };
  readonly board: {
    readonly builtLinks: Readonly<Record<string, string>>;
    readonly placedIndustries: Readonly<Record<string, PlacedIndustryStateV2>>;
  };
  readonly events: GameEventV2[];
};

export type GameStateV2ValidationErrorCode =
  | "NOT_AN_OBJECT"
  | "NOT_JSON_SAFE"
  | "SCHEMA_VERSION"
  | "RULESET"
  | "IDENTITY"
  | "RANDOM_STATE"
  | "PROGRESS_STATE"
  | "TURN_STATE"
  | "PLAYER_STATE"
  | "CARD_CONSERVATION"
  | "TILE_CONSERVATION"
  | "LINK_CONSERVATION"
  | "MARKET_STATE"
  | "MERCHANT_CONSERVATION"
  | "BOARD_STATE"
  | "EVENT_LOG";

export type GameStateV2ValidationError = {
  readonly code: GameStateV2ValidationErrorCode;
  readonly path: string;
  readonly message: string;
};

export type GameStateV2ValidationResult =
  | { readonly ok: true; readonly state: GameStateV2 }
  | { readonly ok: false; readonly errors: GameStateV2ValidationError[] };

const INDUSTRY_KINDS = [
  "manufacturer",
  "cotton",
  "brewery",
  "coal",
  "pottery",
  "iron",
] as const satisfies readonly IndustryTileKind[];
const CARD_IDS = new Set<string>(CARD_CATALOG.map((card) => card.id));
const TILE_IDS = new Set<string>(INDUSTRY_TILES.map((tile) => tile.id));
const MERCHANT_TILE_IDS = new Set<string>(
  MERCHANT_TILE_CATALOG.map((tile) => tile.id),
);
const LINK_IDS = new Set<string>(BOARD_V2.links.map((link) => link.id));
const LOCATION_IDS = new Set<string>(Object.keys(BOARD_V2.locations));
const BUILD_SPACE_RULES = new Map<string, {
  readonly locationId: string;
  readonly allows: readonly string[];
}>();
const MERCHANT_SPACE_LOCATIONS = new Map<string, string>();
for (const [locationId, location] of Object.entries(BOARD_V2.locations)) {
  if ("buildSpaces" in location) {
    for (const space of location.buildSpaces) {
      BUILD_SPACE_RULES.set(space.id, {
        locationId,
        allows: space.allows,
      });
    }
  }
  if (location.kind === "merchant") {
    for (const merchantSpaceId of location.merchantSpaces) {
      MERCHANT_SPACE_LOCATIONS.set(merchantSpaceId, locationId);
    }
  }
}
const MERCHANT_TILE_BY_ID = new Map(
  MERCHANT_TILE_CATALOG.map((tile) => [tile.id, tile]),
);

function boardIndustryKind(kind: IndustryTileKind): string {
  if (kind === "cotton") return "cotton_mill";
  if (kind === "coal") return "coal_mine";
  if (kind === "iron") return "iron_works";
  return kind;
}

function deriveSubSeed(seed: string, purpose: string): string {
  return JSON.stringify(["brass-birmingham-game-v2", purpose, seed]);
}

function deriveGameId(seed: string, seats: readonly string[]): string {
  const stableSeats = [...seats].sort();
  const identityState = createRandomState(
    JSON.stringify(["brass-birmingham-game-v2", "game-id", seed, stableSeats]),
  );
  return `${RULESET_META.id}-${identityState.value.toString(16).padStart(8, "0")}`;
}

function rulesetMetadata(): GameStateV2["ruleset"] {
  return {
    id: RULESET_META.id,
    version: RULESET_META.version,
    dataSchemas: {
      ruleset: RULESET_META.schemaVersion,
      board: BOARD_V2.schemaVersion,
      boardRulesetId: BOARD_V2.rulesetId,
      cardsRuleset: CARD_DATA_RULESET,
      incomeTrack: INCOME_TRACK_DATA.schemaVersion,
      industryTiles: INDUSTRY_TILE_DATA_VERSION,
      merchantTiles: MERCHANT_TILE_DATA_META.schemaVersion,
      merchantRulesetId: MERCHANT_TILE_DATA_META.rulesetId,
    },
  };
}

function createPlayer(seat: string): PlayerStateV2 {
  return {
    seat,
    money: SETUP_DATA.shared.startingMoney,
    incomeMarkerSpace: SETUP_DATA.shared.startingIncomeSpace,
    victoryPoints: 0,
    industryInventory: createIndustryInventory(),
    removedIndustryTileIds: [],
    linkTokensRemaining: SETUP_DATA.shared.linksPerPlayer,
  };
}

/** Creates a complete deterministic Canal Era state for 2–4 seats. */
export function createGameV2(
  seats: readonly string[],
  seed: string,
): GameStateV2 {
  if (typeof seed !== "string") {
    throw new TypeError("Game seed must be a string");
  }

  const setupSeeds = {
    cards: deriveSubSeed(seed, "cards"),
    merchants: deriveSubSeed(seed, "merchants"),
    random: deriveSubSeed(seed, "random"),
  };
  const cards = createCanalSetup(seats, setupSeeds.cards);
  const playerCount = cards.seats.length as SupportedPlayerCount;
  const merchantSetup = createMerchantSetup(playerCount, setupSeeds.merchants);
  const turnOrder = [...cards.seats];
  const gameId = deriveGameId(seed, turnOrder);
  const players = Object.fromEntries(
    turnOrder.map((seat) => [seat, createPlayer(seat)]),
  ) as Record<string, PlayerStateV2>;

  const state: GameStateV2 = {
    schemaVersion: GAME_STATE_V2_SCHEMA_VERSION,
    ruleset: rulesetMetadata(),
    revision: 0,
    gameId,
    seed,
    setupSeeds,
    randomState: createRandomState(setupSeeds.random),
    progress: { phase: "action" },
    era: "canal",
    round: 1,
    turnNumber: 1,
    turnOrder,
    currentSeat: turnOrder[0],
    actionsUsed: 0,
    actionLimit: actionsPerTurn("canal", 1),
    roundSpend: createRoundSpendLedger(turnOrder),
    players,
    cards: {
      hands: cards.hands,
      draw: cards.draw,
      discard: cards.discard,
      wildSupplies: cards.wildSupplies,
    },
    market: createResourceMarketState(),
    merchants: {
      spaces: merchantSetup.spaces,
      returnedToBox: merchantSetup.returnedToBox,
    },
    board: { builtLinks: {}, placedIndustries: {} },
    events: [{
      sequence: 0,
      type: "GAME_CREATED",
      data: {
        gameId,
        seed,
        setupSeeds,
        seats: turnOrder,
        playerCount,
        ruleset: {
          id: RULESET_META.id,
          version: RULESET_META.version,
        },
      },
    }],
  };

  const validation = validateGameStateV2(state);
  if (!validation.ok) {
    throw new Error(`Created invalid GameStateV2: ${validation.errors[0].message}`);
  }
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((value) => expected.includes(value))
  );
}

function isJsonSafe(value: unknown, ancestors = new Set<object>()): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    return value.every((item) => isJsonSafe(item, nextAncestors));
  }
  return Object.values(value).every((item) => isJsonSafe(item, nextAncestors));
}

const GAME_V2_COMMAND_TYPES = new Set([
  "BUILD",
  "NETWORK",
  "DEVELOP",
  "SELL",
  "LOAN",
  "SCOUT",
  "PASS",
  "RESOLVE_MERCHANT_FREE_DEVELOP",
  "SETTLE_ROUND",
  "RESOLVE_ERA",
]);
const PLAYER_GAME_V2_COMMAND_TYPES = new Set([
  "BUILD",
  "NETWORK",
  "DEVELOP",
  "SELL",
  "LOAN",
  "SCOUT",
  "PASS",
  "RESOLVE_MERCHANT_FREE_DEVELOP",
]);

type DerivedProgressPhaseV2 = GameProgressV2["phase"] | "invalid";

function deriveProgressPhaseFromEvents(
  state: GameStateV2,
  events: readonly GameEventV2[],
): DerivedProgressPhaseV2 {
  const latest = [...events].reverse().find((event) =>
    event.type === "GAME_CREATED" ||
    event.type === "ACTION_ACCEPTED" ||
    event.type === "ROUND_SETTLED" ||
    event.type === "ERA_SCORED" ||
    event.type === "RAIL_STARTED" ||
    event.type === "GAME_ENDED"
  );
  if (!latest || latest.type === "GAME_CREATED") return "action";
  if (latest.type === "GAME_ENDED") return "ended";
  if (latest.type === "ERA_SCORED") return "invalid";
  if (latest.type === "RAIL_STARTED") {
    return state.era === "rail" ? "action" : "invalid";
  }
  if (!isRecord(latest.data)) return "invalid";
  if (latest.type === "ACTION_ACCEPTED") {
    if (
      latest.data.era !== state.era ||
      latest.data.round !== state.round ||
      typeof latest.data.roundComplete !== "boolean"
    ) return "invalid";
    return latest.data.roundComplete ? "round_settlement" : "action";
  }
  if (
    latest.data.settlementComplete !== true ||
    latest.data.era !== state.era ||
    typeof latest.data.eraComplete !== "boolean"
  ) return "invalid";
  if (
    latest.data.eraComplete === true &&
    latest.data.completedRound === state.round &&
    latest.data.nextRound === null
  ) return "era_transition";
  if (
    latest.data.eraComplete === false &&
    latest.data.completedRound === state.round - 1 &&
    latest.data.nextRound === state.round
  ) return "action";
  return "invalid";
}

/** Validates state invariants at a deserialize/replay boundary without mutation. */
export function validateGameStateV2(value: unknown): GameStateV2ValidationResult {
  const errors: GameStateV2ValidationError[] = [];
  const add = (
    code: GameStateV2ValidationErrorCode,
    path: string,
    message: string,
  ): void => {
    errors.push({ code, path, message });
  };

  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [{
        code: "NOT_AN_OBJECT",
        path: "$",
        message: "GameStateV2 must be an object.",
      }],
    };
  }
  if (!isJsonSafe(value)) {
    add("NOT_JSON_SAFE", "$", "GameStateV2 must contain only finite JSON values.");
  }

  const state = value as unknown as GameStateV2;
  if (state.schemaVersion !== GAME_STATE_V2_SCHEMA_VERSION) {
    add("SCHEMA_VERSION", "schemaVersion", "Unsupported GameStateV2 schema version.");
  }
  if (JSON.stringify(state.ruleset) !== JSON.stringify(rulesetMetadata())) {
    add("RULESET", "ruleset", "Ruleset metadata does not match generated data.");
  }
  if (
    !isNonNegativeSafeInteger(state.revision) ||
    typeof state.gameId !== "string" ||
    state.gameId.length === 0 ||
    typeof state.seed !== "string"
  ) {
    add("IDENTITY", "$", "Revision, game ID, or seed is invalid.");
  }

  const order = Array.isArray(state.turnOrder) ? state.turnOrder : [];
  const validOrder =
    order.length >= 2 &&
    order.length <= 4 &&
    order.every((seat) => typeof seat === "string" && seat.trim().length > 0) &&
    new Set(order).size === order.length;
  if (!validOrder) {
    add("TURN_STATE", "turnOrder", "Turn order must contain 2–4 unique seats.");
  }

  const expectedSetupSeeds = typeof state.seed === "string"
    ? {
        cards: deriveSubSeed(state.seed, "cards"),
        merchants: deriveSubSeed(state.seed, "merchants"),
        random: deriveSubSeed(state.seed, "random"),
      }
    : null;
  if (
    !expectedSetupSeeds ||
    JSON.stringify(state.setupSeeds) !== JSON.stringify(expectedSetupSeeds) ||
    state.gameId !== deriveGameId(String(state.seed), order)
  ) {
    add("IDENTITY", "setupSeeds", "Game identity or deterministic sub-seeds are invalid.");
  }
  if (
    !isRecord(state.randomState) ||
    state.randomState.algorithm !== RANDOM_ALGORITHM ||
    !Number.isInteger(state.randomState.value) ||
    state.randomState.value < 0 ||
    state.randomState.value > 0xffff_ffff ||
    !isNonNegativeSafeInteger(state.randomState.draws)
  ) {
    add("RANDOM_STATE", "randomState", "Serializable random state is invalid.");
  }

  const playerCount = order.length as SupportedPlayerCount;
  const maxRounds = SETUP_DATA.playerCounts[playerCount]?.roundsPerEra;
  const expectedActionLimit =
    (state.era === "canal" || state.era === "rail") &&
    isNonNegativeSafeInteger(state.round) &&
    state.round >= 1
      ? actionsPerTurn(state.era, state.round)
      : null;
  const spendKeys = isRecord(state.roundSpend) ? Object.keys(state.roundSpend) : [];
  const validSpend =
    isRecord(state.roundSpend) &&
    sameMembers(spendKeys, order) &&
    Object.values(state.roundSpend).every(isNonNegativeSafeInteger);
  if (
    (state.era !== "canal" && state.era !== "rail") ||
    !Number.isSafeInteger(state.round) ||
    state.round < 1 ||
    !maxRounds ||
    state.round > maxRounds ||
    !Number.isSafeInteger(state.turnNumber) ||
    state.turnNumber < 1 ||
    !order.includes(state.currentSeat) ||
    !isNonNegativeSafeInteger(state.actionsUsed) ||
    state.actionsUsed > state.actionLimit ||
    state.actionLimit !== expectedActionLimit ||
    !validSpend
  ) {
    add("TURN_STATE", "$", "Era, round, current turn, action budget, or spend ledger is invalid.");
  }

  const playerRecord = isRecord(state.players) ? state.players : {};
  if (!sameMembers(Object.keys(playerRecord), order)) {
    add("PLAYER_STATE", "players", "Player records must exactly match turn order.");
  }

  const placedRecord = isRecord(state.board?.placedIndustries)
    ? state.board.placedIndustries
    : {};
  const placedTilesByOwner = new Map<string, string[]>();
  const occupiedSpaces = new Set<string>();
  let boardValid = isRecord(state.board) && isRecord(state.board.builtLinks);
  for (const [industryId, placedValue] of Object.entries(placedRecord)) {
    if (!isRecord(placedValue)) {
      boardValid = false;
      continue;
    }
    const placed = placedValue as unknown as PlacedIndustryStateV2;
    const resources = placed.resources;
    const tile = INDUSTRY_TILE_BY_ID[placed.tileId];
    const spaceRule = BUILD_SPACE_RULES.get(placed.spaceId);
    const productiveResource = tile?.industry === "coal"
      ? resources?.coal
      : tile?.industry === "iron"
        ? resources?.iron
        : tile?.industry === "brewery"
          ? resources?.beer
          : null;
    if (
      industryId.length === 0 ||
      industryId !== placed.spaceId ||
      !order.includes(placed.owner) ||
      !tile ||
      !LOCATION_IDS.has(placed.locationId) ||
      typeof placed.spaceId !== "string" ||
      placed.spaceId.length === 0 ||
      occupiedSpaces.has(placed.spaceId) ||
      !spaceRule ||
      spaceRule.locationId !== placed.locationId ||
      !spaceRule.allows.includes(boardIndustryKind(tile.industry)) ||
      !isRecord(resources) ||
      !isNonNegativeSafeInteger(resources.coal) ||
      !isNonNegativeSafeInteger(resources.iron) ||
      !isNonNegativeSafeInteger(resources.beer) ||
      resources.coal > tile.production.coal ||
      resources.iron > tile.production.iron ||
      resources.beer > Math.max(
        tile.production.beer.canal,
        tile.production.beer.rail,
      ) ||
      typeof placed.flipped !== "boolean" ||
      (placed.flipped && resources.coal + resources.iron + resources.beer > 0) ||
      (productiveResource !== null && placed.flipped !== (productiveResource === 0))
    ) {
      boardValid = false;
      continue;
    }
    occupiedSpaces.add(placed.spaceId);
    placedTilesByOwner.set(placed.owner, [
      ...(placedTilesByOwner.get(placed.owner) ?? []),
      placed.tileId,
    ]);
  }

  const builtLinks = isRecord(state.board?.builtLinks)
    ? state.board.builtLinks
    : {};
  const builtLinksByOwner = new Map<string, number>();
  for (const [linkId, owner] of Object.entries(builtLinks)) {
    if (!LINK_IDS.has(linkId) || typeof owner !== "string" || !order.includes(owner)) {
      boardValid = false;
      continue;
    }
    builtLinksByOwner.set(owner, (builtLinksByOwner.get(owner) ?? 0) + 1);
  }
  if (!boardValid) {
    add("BOARD_STATE", "board", "Built links or placed industries are invalid.");
  }

  for (const seat of order) {
    const playerValue = playerRecord[seat];
    if (!isRecord(playerValue)) {
      add("PLAYER_STATE", `players.${seat}`, "Player state must be an object.");
      continue;
    }
    const player = playerValue as unknown as PlayerStateV2;
    const inventory = player.industryInventory;
    let playerValid =
      player.seat === seat &&
      isNonNegativeSafeInteger(player.money) &&
      Number.isSafeInteger(player.incomeMarkerSpace) &&
      player.incomeMarkerSpace >= INCOME_TRACK_DATA.track.firstSpace &&
      player.incomeMarkerSpace <= INCOME_TRACK_DATA.track.lastSpace &&
      isNonNegativeSafeInteger(player.victoryPoints) &&
      isNonNegativeSafeInteger(player.linkTokensRemaining) &&
      player.linkTokensRemaining <= SETUP_DATA.shared.linksPerPlayer &&
      Array.isArray(player.removedIndustryTileIds) &&
      isRecord(inventory) &&
      inventory.schemaVersion === 1 &&
      isRecord(inventory.stacks);

    const remainingTileIds: string[] = [];
    if (isRecord(inventory?.stacks)) {
      for (const kind of INDUSTRY_KINDS) {
        const stack = inventory.stacks[kind];
        if (!Array.isArray(stack)) {
          playerValid = false;
          continue;
        }
        for (const tileId of stack) {
          if (
            typeof tileId !== "string" ||
            !TILE_IDS.has(tileId) ||
            INDUSTRY_TILE_BY_ID[tileId as IndustryTileId].industry !== kind
          ) playerValid = false;
          else remainingTileIds.push(tileId);
        }
        const canonicalIds = INDUSTRY_TILE_STACKS[kind].map((tile) => tile.id);
        const stackIndices = stack.map((tileId) => canonicalIds.indexOf(tileId));
        if (
          stackIndices.some((index) => index < 0) ||
          stackIndices.some(
            (index, stackIndex) =>
              stackIndex > 0 && index <= stackIndices[stackIndex - 1],
          )
        ) {
          playerValid = false;
        }
      }
    }
    const removedIds = Array.isArray(player.removedIndustryTileIds)
      ? player.removedIndustryTileIds.filter(
          (tileId): tileId is IndustryTileId =>
            typeof tileId === "string" && TILE_IDS.has(tileId),
        )
      : [];
    if (removedIds.length !== player.removedIndustryTileIds?.length) {
      playerValid = false;
    }
    const allPlayerTiles = [
      ...remainingTileIds,
      ...removedIds,
      ...(placedTilesByOwner.get(seat) ?? []),
    ];
    if (!sameMembers(allPlayerTiles, INDUSTRY_TILES.map((tile) => tile.id))) {
      add("TILE_CONSERVATION", `players.${seat}`, "Player industry tiles are not conserved.");
    }
    if (
      player.linkTokensRemaining + (builtLinksByOwner.get(seat) ?? 0) !==
      SETUP_DATA.shared.linksPerPlayer
    ) {
      add("LINK_CONSERVATION", `players.${seat}`, "Player link tokens are not conserved.");
    }
    if (!playerValid) {
      add("PLAYER_STATE", `players.${seat}`, "Player values or inventory structure are invalid.");
    }
  }

  try {
    purchaseFromResourceMarket(state.market, "coal", 0);
    purchaseFromResourceMarket(state.market, "iron", 0);
  } catch (error) {
    add("MARKET_STATE", "market", error instanceof Error ? error.message : String(error));
  }

  const expectedRegularCards = CARD_CATALOG.filter((card) =>
    (card.includedAt as readonly number[]).includes(playerCount),
  ).map((card) => card.id);
  const regularCards: string[] = [];
  let wildLocationCards = 0;
  let wildIndustryCards = 0;
  let cardsValid = isRecord(state.cards) && isRecord(state.cards.hands);
  const handRecord = isRecord(state.cards?.hands) ? state.cards.hands : {};
  if (!sameMembers(Object.keys(handRecord), order)) cardsValid = false;
  const collectCard = (cardId: unknown, allowWild: boolean): void => {
    if (cardId === WILD_LOCATION_CARD_ID && allowWild) wildLocationCards += 1;
    else if (cardId === WILD_INDUSTRY_CARD_ID && allowWild) wildIndustryCards += 1;
    else if (typeof cardId === "string" && CARD_IDS.has(cardId)) regularCards.push(cardId);
    else cardsValid = false;
  };
  for (const seat of order) {
    const hand = handRecord[seat];
    if (!Array.isArray(hand)) cardsValid = false;
    else hand.forEach((cardId) => collectCard(cardId, true));
  }
  for (const zone of [state.cards?.draw, state.cards?.discard]) {
    if (!Array.isArray(zone)) cardsValid = false;
    else zone.forEach((cardId) => collectCard(cardId, false));
  }
  const wildSupplies = state.cards?.wildSupplies;
  if (
    !isRecord(wildSupplies) ||
    !isNonNegativeSafeInteger(wildSupplies.location) ||
    !isNonNegativeSafeInteger(wildSupplies.industry)
  ) cardsValid = false;
  else {
    wildLocationCards += wildSupplies.location;
    wildIndustryCards += wildSupplies.industry;
  }
  if (
    !cardsValid ||
    !sameMembers(regularCards, expectedRegularCards) ||
    wildLocationCards !== WILD_CARD_SUPPLY.location ||
    wildIndustryCards !== WILD_CARD_SUPPLY.industry
  ) {
    add("CARD_CONSERVATION", "cards", "Regular or Wild action cards are not conserved.");
  }

  const merchantSpaces = state.merchants?.spaces;
  const returnedToBox = state.merchants?.returnedToBox;
  let merchantsValid = Array.isArray(merchantSpaces) && Array.isArray(returnedToBox);
  const seenSpaceIds = new Set<string>();
  const placedMerchantIds: string[] = [];
  let activeSpaces = 0;
  if (Array.isArray(merchantSpaces)) {
    for (const spaceValue of merchantSpaces) {
      if (!isRecord(spaceValue)) {
        merchantsValid = false;
        continue;
      }
      const space = spaceValue as unknown as MerchantSpaceSetup;
      const expectedLocationId = MERCHANT_SPACE_LOCATIONS.get(
        space.merchantSpaceId,
      );
      const tile = space.tileId === null
        ? null
        : MERCHANT_TILE_BY_ID.get(space.tileId);
      const locationShouldBeActive =
        typeof space.locationId === "string" &&
        (BOARD_V2.playerCountRules[playerCount]?.merchantTileLocations as readonly string[] | undefined)
          ?.includes(space.locationId) === true;
      const demandsMatch =
        tile !== null &&
        tile !== undefined &&
        JSON.stringify(space.demandIndustries) ===
          JSON.stringify(tile.demandIndustries);
      if (
        typeof space.locationId !== "string" ||
        !LOCATION_IDS.has(space.locationId) ||
        typeof space.merchantSpaceId !== "string" ||
        expectedLocationId !== space.locationId ||
        seenSpaceIds.has(space.merchantSpaceId) ||
        typeof space.active !== "boolean" ||
        space.active !== locationShouldBeActive ||
        (space.beer !== 0 && space.beer !== 1) ||
        !Array.isArray(space.demandIndustries) ||
        (space.active &&
          (!tile ||
            tile.minPlayers > playerCount ||
            !demandsMatch ||
            (space.demandIndustries.length === 0 && space.beer !== 0))) ||
        (!space.active &&
          (space.tileId !== null ||
            space.demandIndustries.length !== 0 ||
            space.beer !== 0))
      ) merchantsValid = false;
      seenSpaceIds.add(space.merchantSpaceId);
      if (space.active) activeSpaces += 1;
      if (space.tileId !== null) {
        if (!MERCHANT_TILE_IDS.has(space.tileId)) merchantsValid = false;
        else placedMerchantIds.push(space.tileId);
      }
    }
  }
  const returnedIds = Array.isArray(returnedToBox)
    ? returnedToBox.filter(
        (tileId): tileId is RulesMerchantTileId =>
          typeof tileId === "string" && MERCHANT_TILE_IDS.has(tileId),
      )
    : [];
  if (
    returnedIds.some(
      (tileId) => (MERCHANT_TILE_BY_ID.get(tileId)?.minPlayers ?? 0) <= playerCount,
    )
  ) {
    merchantsValid = false;
  }
  if (
    !merchantsValid ||
    merchantSpaces?.length !== BOARD_V2.counts.merchantSpaces ||
    !sameMembers([...seenSpaceIds], [...MERCHANT_SPACE_LOCATIONS.keys()]) ||
    activeSpaces !== BOARD_V2.playerCountRules[playerCount]?.activeMerchantSpaces ||
    returnedIds.length !== returnedToBox?.length ||
    !sameMembers(
      [...placedMerchantIds, ...returnedIds],
      MERCHANT_TILE_CATALOG.map((tile) => tile.id),
    )
  ) {
    add("MERCHANT_CONSERVATION", "merchants", "Merchant spaces or tiles are not conserved.");
  }

  if (!Array.isArray(state.events) || state.events.length === 0) {
    add("EVENT_LOG", "events", "Event log must contain the creation event.");
  } else {
    for (const [index, event] of state.events.entries()) {
      if (
        !isRecord(event) ||
        event.sequence !== index ||
        typeof event.type !== "string" ||
        event.type.length === 0 ||
        !isJsonSafe(event.data)
      ) {
        add("EVENT_LOG", `events.${index}`, "Event sequence or payload is invalid.");
      }
    }
    if (state.events[0]?.type !== "GAME_CREATED") {
      add("EVENT_LOG", "events.0", "First event must be GAME_CREATED.");
    }
  }

  const events = Array.isArray(state.events)
    ? state.events.filter(
        (event): event is GameEventV2 => isRecord(event),
      )
    : [];
  const commandIds = new Set<string>();
  let previousAppliedRevision = -1;
  let commandEventsValid = true;
  for (const event of events) {
    if (event.type !== "COMMAND_APPLIED") continue;
    const data = event.data;
    const expectedRevision = isRecord(data) ? data.expectedRevision : undefined;
    const appliedRevision = isRecord(data) ? data.appliedRevision : undefined;
    const commandId = isRecord(data) ? data.commandId : undefined;
    const commandType = isRecord(data) ? data.commandType : undefined;
    const actorSeat = isRecord(data) ? data.actorSeat : undefined;
    const playerCommand =
      typeof commandType === "string" &&
      PLAYER_GAME_V2_COMMAND_TYPES.has(commandType);
    const systemCommand = commandType === "SETTLE_ROUND" ||
      commandType === "RESOLVE_ERA";
    if (
      !isRecord(data) ||
      data.commandSchemaVersion !== 1 ||
      typeof commandId !== "string" ||
      commandId.trim().length === 0 ||
      commandId.length > 128 ||
      commandIds.has(commandId) ||
      typeof commandType !== "string" ||
      !GAME_V2_COMMAND_TYPES.has(commandType) ||
      !Number.isSafeInteger(expectedRevision) ||
      (expectedRevision as number) < 0 ||
      !Number.isSafeInteger(appliedRevision) ||
      appliedRevision !== (expectedRevision as number) + 1 ||
      (appliedRevision as number) <= previousAppliedRevision ||
      (appliedRevision as number) > state.revision ||
      (playerCommand &&
        (typeof actorSeat !== "string" || !order.includes(actorSeat))) ||
      (systemCommand && actorSeat !== null)
    ) {
      commandEventsValid = false;
    }
    if (typeof commandId === "string") commandIds.add(commandId);
    if (Number.isSafeInteger(appliedRevision)) {
      previousAppliedRevision = appliedRevision as number;
    }
  }
  if (!commandEventsValid) {
    add(
      "EVENT_LOG",
      "events",
      "COMMAND_APPLIED payloads must be canonical, uniquely identified, and revision ordered.",
    );
  }

  const progress = state.progress;
  let progressValid = isRecord(progress);
  const progressPhase = isRecord(progress) ? progress.phase : undefined;
  const supportedProgressPhase =
    progressPhase === "action" ||
    progressPhase === "round_settlement" ||
    progressPhase === "era_transition" ||
    progressPhase === "merchant_free_develop" ||
    progressPhase === "ended";
  if (!supportedProgressPhase) progressValid = false;

  if (isRecord(progress) && progress.phase === "merchant_free_develop") {
    const pending = progress.pending;
    const merchantSpaceIds = isRecord(pending) &&
        Array.isArray(pending.merchantSpaceIds)
      ? pending.merchantSpaceIds
      : [];
    const canonicalMerchantSpaces = new Map(
      Array.isArray(merchantSpaces)
        ? merchantSpaces
          .filter(isRecord)
          .map((space) => [space.merchantSpaceId, space] as const)
        : [],
    );
    const uniqueMerchantSpaceIds =
      merchantSpaceIds.length > 0 &&
      new Set(merchantSpaceIds).size === merchantSpaceIds.length;
    let freeDevelopCount = 0;
    for (const merchantSpaceId of merchantSpaceIds) {
      if (typeof merchantSpaceId !== "string") {
        progressValid = false;
        continue;
      }
      const merchantSpace = canonicalMerchantSpaces.get(merchantSpaceId);
      const locationId = MERCHANT_SPACE_LOCATIONS.get(merchantSpaceId);
      const location = locationId === undefined
        ? undefined
        : BOARD_V2.locations[locationId as keyof typeof BOARD_V2.locations];
      if (
        !merchantSpace ||
        merchantSpace.merchantSpaceId !== merchantSpaceId ||
        merchantSpace.locationId !== locationId ||
        merchantSpace.active !== true ||
        merchantSpace.beer !== 0 ||
        location?.kind !== "merchant" ||
        location.merchantBonus.kind !== "free_develop"
      ) {
        progressValid = false;
        continue;
      }
      freeDevelopCount += location.merchantBonus.amount;
    }
    if (
      !isRecord(pending) ||
      pending.seat !== state.currentSeat ||
      !order.includes(String(pending.seat)) ||
      !Number.isSafeInteger(pending.count) ||
      (pending.count as number) <= 0 ||
      pending.source !== "merchant_bonus" ||
      !uniqueMerchantSpaceIds ||
      freeDevelopCount !== pending.count
    ) {
      progressValid = false;
    }
  }

  let canonicalStandings: readonly PlayerStanding[] | null = null;
  if (
    isRecord(progress) &&
    progress.phase === "ended" &&
    isRecord(progress.terminal) &&
    Array.isArray(progress.terminal.standings)
  ) {
    try {
      canonicalStandings = rankFinalStandings(
        order.map((seat) => {
          const player = playerRecord[seat] as unknown as PlayerStateV2;
          return {
            playerId: seat,
            victoryPoints: player.victoryPoints,
            incomeLevel: incomeLevelAt(player.incomeMarkerSpace),
            cash: player.money,
          };
        }),
      );
    } catch {
      progressValid = false;
    }
    if (
      state.era !== "rail" ||
      canonicalStandings === null ||
      JSON.stringify(progress.terminal.standings) !==
        JSON.stringify(canonicalStandings)
    ) {
      progressValid = false;
    }
  } else if (progressPhase === "ended") {
    progressValid = false;
  }

  const derivedProgressPhase = deriveProgressPhaseFromEvents(state, events);
  const phaseMatchesBoundary = progressPhase === derivedProgressPhase ||
    (derivedProgressPhase === "action" &&
      progressPhase === "merchant_free_develop");
  if (!phaseMatchesBoundary) progressValid = false;
  const atFinalEraCardBoundary =
    state.round === maxRounds &&
    Array.isArray(state.cards?.draw) &&
    state.cards.draw.length === 0 &&
    order.every(
      (seat) => Array.isArray(state.cards?.hands?.[seat]) &&
        state.cards.hands[seat].length === 0,
    ) &&
    state.cards?.wildSupplies?.location === WILD_CARD_SUPPLY.location &&
    state.cards?.wildSupplies?.industry === WILD_CARD_SUPPLY.industry;
  if (progressPhase === "era_transition" && !atFinalEraCardBoundary) {
    progressValid = false;
  }
  if (progressPhase === "ended") {
    const gameEndedIndices = events.flatMap((event, index) =>
      event.type === "GAME_ENDED" ? [index] : []
    );
    const gameEndedIndex = gameEndedIndices[0] ?? -1;
    const gameEndedEvent = events[gameEndedIndex];
    const eraScoredEvent = events[gameEndedIndex - 1];
    const eventBeforeScoring = events[gameEndedIndex - 2];
    const settlementCommandBetween =
      eventBeforeScoring?.type === "COMMAND_APPLIED" &&
      isRecord(eventBeforeScoring.data) &&
      eventBeforeScoring.data.commandType === "SETTLE_ROUND" &&
      eventBeforeScoring.data.actorSeat === null;
    const settlementEvent = events[
      gameEndedIndex - (settlementCommandBetween ? 3 : 2)
    ];
    const settlementData = settlementEvent?.data;
    const eraScoredData = eraScoredEvent?.data;
    const trailingEvents = events.slice(gameEndedIndex + 1);
    const trailingResolveEraCommand =
      trailingEvents.length === 1 &&
      trailingEvents[0].type === "COMMAND_APPLIED" &&
      isRecord(trailingEvents[0].data) &&
      trailingEvents[0].data.commandType === "RESOLVE_ERA" &&
      trailingEvents[0].data.actorSeat === null &&
      trailingEvents[0].data.appliedRevision === state.revision;
    if (
      state.era !== "rail" ||
      !atFinalEraCardBoundary ||
      gameEndedIndices.length !== 1 ||
      settlementEvent?.type !== "ROUND_SETTLED" ||
      !isRecord(settlementData) ||
      settlementData.settlementComplete !== true ||
      settlementData.era !== "rail" ||
      settlementData.completedRound !== state.round ||
      settlementData.eraComplete !== true ||
      eraScoredEvent?.type !== "ERA_SCORED" ||
      !isRecord(eraScoredData) ||
      eraScoredData.era !== "rail" ||
      !isRecord(gameEndedEvent?.data) ||
      canonicalStandings === null ||
      JSON.stringify(gameEndedEvent.data.standings) !==
        JSON.stringify(canonicalStandings) ||
      (trailingEvents.length !== 0 && !trailingResolveEraCommand)
    ) {
      progressValid = false;
    }
  }
  if (!progressValid) {
    add(
      "PROGRESS_STATE",
      "progress",
      "Game progress, pending follow-up, terminal result, or lifecycle boundary is inconsistent.",
    );
  }

  return errors.length === 0
    ? { ok: true, state }
    : { ok: false, errors };
}

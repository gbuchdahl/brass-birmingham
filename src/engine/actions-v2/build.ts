import { discardActionCard } from "../cards-v2/zones";
import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type CardZones,
  type PlayableCardId,
} from "../cards-v2/types";
import {
  purchaseFromResourceMarket,
  sellToResourceMarket,
  type ResourceMarketState,
} from "../economy/markets";
import {
  getLowestIndustryTileId,
  removeBuiltIndustryTile,
} from "../player-v2/industry-inventory";
import type { IndustryInventory } from "../player-v2/types";
import { BOARD_V2 } from "../rules/generated/board-v2";
import {
  CARD_CATALOG,
  type RulesPhysicalCard,
} from "../rules/generated/cards";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTile,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";

export type BuildEra = "canal" | "rail";
export type BuildPlayerCount = 2 | 3 | 4;

export type BuiltIndustryState = {
  readonly owner: string;
  readonly buildSpaceId: string;
  readonly locationId: string;
  readonly tileId: string;
  readonly faceId: string;
  readonly industry: IndustryTileKind;
  readonly level: number;
  readonly resources: {
    readonly coal: number;
    readonly iron: number;
    readonly beer: number;
  };
  readonly flipped: boolean;
};

export type BuildActionState = {
  readonly era: BuildEra;
  readonly playerCount: BuildPlayerCount;
  readonly seat: string;
  readonly player: {
    readonly money: number;
    readonly inventory: IndustryInventory;
  };
  readonly builtLinks: Readonly<Record<string, string>>;
  readonly placements: Readonly<Record<string, BuiltIndustryState>>;
  readonly market: ResourceMarketState;
  readonly cards: CardZones;
};

export type BuildCoalChoice =
  | { readonly kind: "mine"; readonly buildSpaceId: string }
  | { readonly kind: "market" };

export type BuildIronChoice =
  | { readonly kind: "works"; readonly buildSpaceId: string }
  | { readonly kind: "market" };

export type BuildActionSelection = {
  readonly buildSpaceId: string;
  readonly industry: IndustryTileKind;
  readonly cardId: PlayableCardId;
  readonly coalSources: readonly BuildCoalChoice[];
  readonly ironSources: readonly BuildIronChoice[];
};

export type BuildActionErrorCode =
  | "INVALID_BUILD_STATE"
  | "INVALID_BUILD_SELECTION"
  | "UNKNOWN_BUILD_SPACE"
  | "INDUSTRY_NOT_SUPPORTED"
  | "CARD_NOT_AVAILABLE_AT_PLAYER_COUNT"
  | "CARD_DOES_NOT_ALLOW_BUILD"
  | "LOCATION_REQUIRES_INDUSTRY_CARD"
  | "BUILD_NOT_IN_PLAYER_NETWORK"
  | "CANAL_LOCATION_LIMIT"
  | "BUILD_SPACE_OCCUPIED"
  | "ILLEGAL_OVERBUILD"
  | "INDUSTRY_TILE_UNAVAILABLE"
  | "INDUSTRY_TILE_NOT_BUILDABLE_IN_ERA"
  | "INVALID_COAL_SELECTION"
  | "COAL_SOURCE_UNAVAILABLE"
  | "COAL_SOURCE_NOT_CONNECTED"
  | "COAL_SOURCE_PRIORITY"
  | "COAL_MARKET_NOT_CONNECTED"
  | "INVALID_IRON_SELECTION"
  | "IRON_SOURCE_UNAVAILABLE"
  | "IRON_SOURCE_PRIORITY"
  | "INSUFFICIENT_MONEY"
  | "UNKNOWN_SEAT"
  | "CARD_NOT_IN_HAND";

export type BuildActionError = {
  readonly code: BuildActionErrorCode;
  readonly message: string;
};

export type BuildResourceEffect =
  | {
      readonly resource: "coal";
      readonly kind: "mine";
      readonly buildSpaceId: string;
      readonly depleted: boolean;
    }
  | {
      readonly resource: "coal";
      readonly kind: "market";
      readonly unitPrice: number;
    }
  | {
      readonly resource: "iron";
      readonly kind: "works";
      readonly buildSpaceId: string;
      readonly depleted: boolean;
    }
  | {
      readonly resource: "iron";
      readonly kind: "market";
      readonly unitPrice: number;
    };

export type BuildActionEffect = {
  readonly type: "INDUSTRY_BUILT";
  readonly seat: string;
  readonly actionsConsumed: 1;
  readonly discardedCardId: PlayableCardId;
  readonly placement: BuiltIndustryState;
  readonly overbuilt: BuiltIndustryState | null;
  readonly resourceSources: readonly BuildResourceEffect[];
  readonly flippedProviderSpaceIds: readonly string[];
  readonly printedBuildCost: number;
  readonly resourceMarketCost: number;
  /** Gross amount paid and recorded for turn order; production revenue is not netted. */
  readonly moneySpent: number;
  readonly productionRevenue: number;
  readonly moneyChange: number;
  readonly productionSold: {
    readonly coal: number;
    readonly iron: number;
  };
};

type BuildFailure = {
  readonly ok: false;
  readonly state: BuildActionState;
  readonly error: BuildActionError;
};

export type BuildActionResult =
  | {
      readonly ok: true;
      readonly state: BuildActionState;
      readonly effect: BuildActionEffect;
    }
  | BuildFailure;

type BuildSpace = {
  readonly id: string;
  readonly locationId: string;
  readonly locationKind: string;
  readonly allows: readonly string[];
  readonly buildCardRule: string | null;
};

const BUILD_SPACE_BY_ID = new Map<string, BuildSpace>();
for (const [locationId, location] of Object.entries(BOARD_V2.locations)) {
  if (!("buildSpaces" in location)) continue;
  for (const space of location.buildSpaces) {
    BUILD_SPACE_BY_ID.set(space.id, {
      id: space.id,
      locationId,
      locationKind: location.kind,
      allows: space.allows,
      buildCardRule:
        "buildCardRule" in location ? location.buildCardRule : null,
    });
  }
}

type BoardLink = (typeof BOARD_V2.links)[number];

const LINK_BY_ID = new Map<string, BoardLink>(
  BOARD_V2.links.map((link) => [link.id, link] as const),
);
const MARKET_LOCATIONS = new Set(
  Object.entries(BOARD_V2.locations)
    .filter(
      ([, location]) =>
        "coalMarketAccess" in location && location.coalMarketAccess === true,
    )
    .map(([locationId]) => locationId),
);
const CARD_BY_ID = new Map<string, RulesPhysicalCard>(
  CARD_CATALOG.map((card) => [card.id, card]),
);

function reject(
  state: BuildActionState,
  code: BuildActionErrorCode,
  message: string,
): BuildFailure {
  return { ok: false, state, error: { code, message } };
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function boardIndustry(kind: IndustryTileKind): string {
  switch (kind) {
    case "cotton": return "cotton_mill";
    case "coal": return "coal_mine";
    case "iron": return "iron_works";
    default: return kind;
  }
}

function cardIndustry(kind: IndustryTileKind): string {
  return kind === "manufacturer" ? "manufactured" : kind;
}

function validateState(state: BuildActionState): BuildFailure | null {
  if (
    typeof state !== "object" ||
    state === null ||
    (state.era !== "canal" && state.era !== "rail") ||
    ![2, 3, 4].includes(state.playerCount) ||
    typeof state.seat !== "string" ||
    state.seat.trim().length === 0 ||
    !isNonNegativeInteger(state.player?.money)
  ) {
    return reject(state, "INVALID_BUILD_STATE", "Invalid Build action state.");
  }
  try {
    purchaseFromResourceMarket(state.market, "coal", 0);
  } catch (error) {
    return reject(
      state,
      "INVALID_BUILD_STATE",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (
    typeof state.builtLinks !== "object" ||
    state.builtLinks === null ||
    Array.isArray(state.builtLinks) ||
    typeof state.placements !== "object" ||
    state.placements === null ||
    Array.isArray(state.placements)
  ) {
    return reject(
      state,
      "INVALID_BUILD_STATE",
      "Built links and placements must be objects.",
    );
  }
  for (const [linkId, owner] of Object.entries(state.builtLinks)) {
    if (
      !LINK_BY_ID.has(linkId) ||
      typeof owner !== "string" ||
      owner.trim().length === 0
    ) {
      return reject(
        state,
        "INVALID_BUILD_STATE",
        `Invalid built link state: ${linkId}.`,
      );
    }
  }
  for (const [spaceId, placement] of Object.entries(state.placements)) {
    const space = BUILD_SPACE_BY_ID.get(spaceId);
    const tile = INDUSTRY_TILE_BY_ID[placement?.tileId as keyof typeof INDUSTRY_TILE_BY_ID];
    if (
      !placement ||
      typeof placement.owner !== "string" ||
      placement.owner.trim().length === 0 ||
      placement.buildSpaceId !== spaceId ||
      !space ||
      placement.locationId !== space.locationId ||
      !tile ||
      placement.faceId !== tile.faceId ||
      placement.industry !== tile.industry ||
      placement.level !== tile.level ||
      !space.allows.includes(boardIndustry(tile.industry)) ||
      !isNonNegativeInteger(placement.resources?.coal) ||
      !isNonNegativeInteger(placement.resources?.iron) ||
      !isNonNegativeInteger(placement.resources?.beer) ||
      typeof placement.flipped !== "boolean"
    ) {
      return reject(
        state,
        "INVALID_BUILD_STATE",
        `Invalid placement state: ${spaceId}.`,
      );
    }
  }
  return null;
}

function cardPermission(
  state: BuildActionState,
  selection: BuildActionSelection,
  space: BuildSpace,
):
  | { readonly ok: true; readonly locationException: boolean }
  | BuildFailure {
  if (selection.cardId === WILD_LOCATION_CARD_ID) {
    if (space.locationKind === "farm_brewery") {
      return reject(
        state,
        "LOCATION_REQUIRES_INDUSTRY_CARD",
        "Farm breweries require an Industry or Wild Industry card.",
      );
    }
    return { ok: true, locationException: true };
  }
  if (selection.cardId === WILD_INDUSTRY_CARD_ID) {
    return { ok: true, locationException: false };
  }

  const card = CARD_BY_ID.get(selection.cardId);
  if (!card) {
    return reject(
      state,
      "CARD_NOT_IN_HAND",
      `Unknown action card: ${selection.cardId}.`,
    );
  }
  if (!(card.includedAt as readonly number[]).includes(state.playerCount)) {
    return reject(
      state,
      "CARD_NOT_AVAILABLE_AT_PLAYER_COUNT",
      `Card is not used at ${state.playerCount} players: ${selection.cardId}.`,
    );
  }
  if (card.kind === "location") {
    if (space.locationKind === "farm_brewery") {
      return reject(
        state,
        "LOCATION_REQUIRES_INDUSTRY_CARD",
        "Farm breweries require an Industry or Wild Industry card.",
      );
    }
    if (card.location.replaceAll("-", "_") !== space.locationId) {
      return reject(
        state,
        "CARD_DOES_NOT_ALLOW_BUILD",
        "Location card does not match the selected location.",
      );
    }
    return { ok: true, locationException: true };
  }
  if (!(card.industries as readonly string[]).includes(cardIndustry(selection.industry))) {
    return reject(
      state,
      "CARD_DOES_NOT_ALLOW_BUILD",
      "Industry card does not grant the selected industry.",
    );
  }
  return { ok: true, locationException: false };
}

function playerNetworkLocations(state: BuildActionState): Set<string> {
  const result = new Set<string>();
  for (const placement of Object.values(state.placements)) {
    if (placement.owner === state.seat) result.add(placement.locationId);
  }
  for (const [linkId, owner] of Object.entries(state.builtLinks)) {
    if (owner !== state.seat) continue;
    for (const locationId of LINK_BY_ID.get(linkId)?.adjacentLocations ?? []) {
      result.add(locationId);
    }
  }
  return result;
}

function locationDistances(
  anchor: string,
  builtLinkIds: readonly string[],
): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  const connect = (left: string, right: string): void => {
    const neighbours = adjacency.get(left) ?? new Set<string>();
    neighbours.add(right);
    adjacency.set(left, neighbours);
  };
  for (const linkId of builtLinkIds) {
    const locations = LINK_BY_ID.get(linkId)?.adjacentLocations ?? [];
    for (let left = 0; left < locations.length; left += 1) {
      for (let right = left + 1; right < locations.length; right += 1) {
        connect(locations[left], locations[right]);
        connect(locations[right], locations[left]);
      }
    }
  }
  const distances = new Map<string, number>([[anchor, 0]]);
  const queue = [anchor];
  for (let index = 0; index < queue.length; index += 1) {
    const locationId = queue[index];
    const distance = distances.get(locationId) ?? 0;
    for (const neighbour of adjacency.get(locationId) ?? []) {
      if (distances.has(neighbour)) continue;
      distances.set(neighbour, distance + 1);
      queue.push(neighbour);
    }
  }
  return distances;
}

function canOpponentOverbuild(
  state: BuildActionState,
  target: BuiltIndustryState,
  tile: IndustryTile,
): boolean {
  if (
    target.industry !== tile.industry ||
    tile.level <= target.level ||
    (tile.industry !== "coal" && tile.industry !== "iron")
  ) return false;
  const resource = tile.industry;
  if (state.market[resource] > 0) return false;
  return !Object.values(state.placements).some(
    (placement) => placement.resources[resource] > 0,
  );
}

function validateOverbuild(
  state: BuildActionState,
  target: BuiltIndustryState | undefined,
  tile: IndustryTile,
): BuildFailure | null {
  if (!target) return null;
  if (target.owner === state.seat) {
    return target.industry === tile.industry && tile.level > target.level
      ? null
      : reject(
          state,
          "ILLEGAL_OVERBUILD",
          "An owned tile may only be overbuilt by a higher level of the same industry.",
        );
  }
  return canOpponentOverbuild(state, target, tile)
    ? null
    : reject(
        state,
        "ILLEGAL_OVERBUILD",
        "Opponent overbuilding requires a higher matching coal or iron tile and no cubes of that resource anywhere on the board or market.",
      );
}

function consumeCoal(
  state: BuildActionState,
  placements: Readonly<Record<string, BuiltIndustryState>>,
  market: ResourceMarketState,
  choices: readonly BuildCoalChoice[],
  required: number,
  locationId: string,
):
  | {
      readonly ok: true;
      readonly placements: Readonly<Record<string, BuiltIndustryState>>;
      readonly market: ResourceMarketState;
      readonly cost: number;
      readonly effects: readonly BuildResourceEffect[];
      readonly flipped: readonly string[];
    }
  | BuildFailure {
  if (choices.length !== required) {
    return reject(
      state,
      "INVALID_COAL_SELECTION",
      `Build requires exactly ${required} coal source selection(s).`,
    );
  }
  let nextPlacements = placements;
  let nextMarket = market;
  let cost = 0;
  const effects: BuildResourceEffect[] = [];
  const flipped: string[] = [];
  const distances = locationDistances(locationId, Object.keys(state.builtLinks));

  for (const choice of choices) {
    const connected = Object.entries(nextPlacements)
      .filter(
        ([, placement]) =>
          placement.industry === "coal" &&
          !placement.flipped &&
          placement.resources.coal > 0 &&
          distances.has(placement.locationId),
      )
      .map(([spaceId, placement]) => ({
        spaceId,
        placement,
        distance: distances.get(placement.locationId) ?? Number.POSITIVE_INFINITY,
      }));
    const nearest = connected.reduce(
      (value, candidate) => Math.min(value, candidate.distance),
      Number.POSITIVE_INFINITY,
    );

    if (choice.kind === "market") {
      if (connected.length > 0) {
        return reject(
          state,
          "COAL_SOURCE_PRIORITY",
          "Connected coal mines must be consumed before market coal.",
        );
      }
      if (![...MARKET_LOCATIONS].some((marketId) => distances.has(marketId))) {
        return reject(
          state,
          "COAL_MARKET_NOT_CONNECTED",
          "The build location is not connected to a coal market.",
        );
      }
      const purchase = purchaseFromResourceMarket(nextMarket, "coal", 1);
      nextMarket = purchase.market;
      cost += purchase.totalCost;
      effects.push({
        resource: "coal",
        kind: "market",
        unitPrice: purchase.unitPrices[0],
      });
      continue;
    }

    const source = nextPlacements[choice.buildSpaceId];
    if (
      !source ||
      source.industry !== "coal" ||
      source.flipped ||
      source.resources.coal < 1
    ) {
      return reject(
        state,
        "COAL_SOURCE_UNAVAILABLE",
        `Coal source is unavailable: ${choice.buildSpaceId}.`,
      );
    }
    const distance = distances.get(source.locationId);
    if (distance === undefined) {
      return reject(
        state,
        "COAL_SOURCE_NOT_CONNECTED",
        `Coal source is not connected: ${choice.buildSpaceId}.`,
      );
    }
    if (distance !== nearest) {
      return reject(
        state,
        "COAL_SOURCE_PRIORITY",
        `Coal source is not a nearest connected mine: ${choice.buildSpaceId}.`,
      );
    }
    const coal = source.resources.coal - 1;
    const depleted = coal === 0;
    nextPlacements = {
      ...nextPlacements,
      [choice.buildSpaceId]: {
        ...source,
        resources: { ...source.resources, coal },
        flipped: depleted,
      },
    };
    if (depleted) flipped.push(choice.buildSpaceId);
    effects.push({
      resource: "coal",
      kind: "mine",
      buildSpaceId: choice.buildSpaceId,
      depleted,
    });
  }
  return {
    ok: true,
    placements: nextPlacements,
    market: nextMarket,
    cost,
    effects,
    flipped,
  };
}

function consumeIron(
  state: BuildActionState,
  placements: Readonly<Record<string, BuiltIndustryState>>,
  market: ResourceMarketState,
  choices: readonly BuildIronChoice[],
  required: number,
):
  | {
      readonly ok: true;
      readonly placements: Readonly<Record<string, BuiltIndustryState>>;
      readonly market: ResourceMarketState;
      readonly cost: number;
      readonly effects: readonly BuildResourceEffect[];
      readonly flipped: readonly string[];
    }
  | BuildFailure {
  if (choices.length !== required) {
    return reject(
      state,
      "INVALID_IRON_SELECTION",
      `Build requires exactly ${required} iron source selection(s).`,
    );
  }
  let nextPlacements = placements;
  let nextMarket = market;
  let cost = 0;
  const effects: BuildResourceEffect[] = [];
  const flipped: string[] = [];
  for (const choice of choices) {
    const availableWorks = Object.values(nextPlacements).some(
      (placement) =>
        placement.industry === "iron" &&
        !placement.flipped &&
        placement.resources.iron > 0,
    );
    if (choice.kind === "market") {
      if (availableWorks) {
        return reject(
          state,
          "IRON_SOURCE_PRIORITY",
          "Available iron works must be consumed before market iron.",
        );
      }
      const purchase = purchaseFromResourceMarket(nextMarket, "iron", 1);
      nextMarket = purchase.market;
      cost += purchase.totalCost;
      effects.push({
        resource: "iron",
        kind: "market",
        unitPrice: purchase.unitPrices[0],
      });
      continue;
    }
    const source = nextPlacements[choice.buildSpaceId];
    if (
      !source ||
      source.industry !== "iron" ||
      source.flipped ||
      source.resources.iron < 1
    ) {
      return reject(
        state,
        "IRON_SOURCE_UNAVAILABLE",
        `Iron source is unavailable: ${choice.buildSpaceId}.`,
      );
    }
    const iron = source.resources.iron - 1;
    const depleted = iron === 0;
    nextPlacements = {
      ...nextPlacements,
      [choice.buildSpaceId]: {
        ...source,
        resources: { ...source.resources, iron },
        flipped: depleted,
      },
    };
    if (depleted) flipped.push(choice.buildSpaceId);
    effects.push({
      resource: "iron",
      kind: "works",
      buildSpaceId: choice.buildSpaceId,
      depleted,
    });
  }
  return {
    ok: true,
    placements: nextPlacements,
    market: nextMarket,
    cost,
    effects,
    flipped,
  };
}

function newPlacement(
  state: BuildActionState,
  space: BuildSpace,
  tile: IndustryTile,
): BuiltIndustryState {
  return {
    owner: state.seat,
    buildSpaceId: space.id,
    locationId: space.locationId,
    tileId: tile.id,
    faceId: tile.faceId,
    industry: tile.industry,
    level: tile.level,
    resources: {
      coal: tile.production.coal,
      iron: tile.production.iron,
      beer: tile.production.beer[state.era],
    },
    flipped: false,
  };
}

export function executeBuildAction(
  state: BuildActionState,
  selection: BuildActionSelection,
): BuildActionResult {
  const invalidState = validateState(state);
  if (invalidState) return invalidState;
  if (
    typeof selection !== "object" ||
    selection === null ||
    typeof selection.buildSpaceId !== "string" ||
    selection.buildSpaceId.length === 0 ||
    typeof selection.industry !== "string" ||
    typeof selection.cardId !== "string" ||
    !Array.isArray(selection.coalSources) ||
    !Array.isArray(selection.ironSources) ||
    !Object.values(INDUSTRY_TILE_BY_ID).some(
      (tile) => tile.industry === selection.industry,
    )
  ) {
    return reject(
      state,
      "INVALID_BUILD_SELECTION",
      "Build requires a space, industry, card, and resource-source arrays.",
    );
  }
  const space = BUILD_SPACE_BY_ID.get(selection.buildSpaceId);
  if (!space) {
    return reject(
      state,
      "UNKNOWN_BUILD_SPACE",
      `Unknown build space: ${selection.buildSpaceId}.`,
    );
  }
  if (!space.allows.includes(boardIndustry(selection.industry))) {
    return reject(
      state,
      "INDUSTRY_NOT_SUPPORTED",
      `Build space does not support ${selection.industry}.`,
    );
  }
  const permission = cardPermission(state, selection, space);
  if (!permission.ok) return permission;
  if (
    !permission.locationException &&
    !playerNetworkLocations(state).has(space.locationId)
  ) {
    return reject(
      state,
      "BUILD_NOT_IN_PLAYER_NETWORK",
      "Industry-card builds must be inside the acting player's network.",
    );
  }

  const tileId = getLowestIndustryTileId(state.player.inventory, selection.industry);
  if (!tileId) {
    return reject(
      state,
      "INDUSTRY_TILE_UNAVAILABLE",
      `No ${selection.industry} tile remains in inventory.`,
    );
  }
  const tile = INDUSTRY_TILE_BY_ID[tileId];
  if (
    (state.era === "canal" && tile.level !== 1) ||
    (state.era === "rail" && tile.level < 2)
  ) {
    return reject(
      state,
      "INDUSTRY_TILE_NOT_BUILDABLE_IN_ERA",
      `Level ${tile.level} cannot be built in the ${state.era} era.`,
    );
  }
  const removed = removeBuiltIndustryTile(
    state.player.inventory,
    tile.id,
    state.era,
  );
  if (!removed.ok) {
    return reject(
      state,
      "INDUSTRY_TILE_NOT_BUILDABLE_IN_ERA",
      removed.error.message,
    );
  }

  const overbuilt = state.placements[space.id];
  const overbuildFailure = validateOverbuild(state, overbuilt, tile);
  if (overbuildFailure) return overbuildFailure;
  if (state.era === "canal") {
    const anotherOwnedTile = Object.values(state.placements).some(
      (placement) =>
        placement.owner === state.seat &&
        placement.locationId === space.locationId &&
        placement.buildSpaceId !== space.id,
    );
    if (anotherOwnedTile) {
      return reject(
        state,
        "CANAL_LOCATION_LIMIT",
        "A player may have at most one Industry tile per location in the Canal Era.",
      );
    }
  }

  const coal = consumeCoal(
    state,
    state.placements,
    state.market,
    selection.coalSources,
    tile.build.coal,
    space.locationId,
  );
  if (!coal.ok) return coal;
  const iron = consumeIron(
    state,
    coal.placements,
    coal.market,
    selection.ironSources,
    tile.build.iron,
  );
  if (!iron.ok) return iron;

  const resourceMarketCost = coal.cost + iron.cost;
  const moneySpent = tile.build.money + resourceMarketCost;
  if (state.player.money < moneySpent) {
    return reject(
      state,
      "INSUFFICIENT_MONEY",
      `Build costs £${moneySpent}, but the player has £${state.player.money}.`,
    );
  }

  let market = iron.market;
  let placement = newPlacement(state, space, tile);
  let productionRevenue = 0;
  let coalSold = 0;
  let ironSold = 0;
  if (
    placement.industry === "coal" &&
    [...MARKET_LOCATIONS].some((locationId) =>
      locationDistances(space.locationId, Object.keys(state.builtLinks)).has(locationId),
    )
  ) {
    const sale = sellToResourceMarket(market, "coal", placement.resources.coal);
    market = sale.market;
    coalSold = sale.unitsMoved;
    productionRevenue += sale.totalRevenue;
    placement = {
      ...placement,
      resources: {
        ...placement.resources,
        coal: sale.unitsRemaining,
      },
      flipped: sale.unitsRemaining === 0,
    };
  }
  if (placement.industry === "iron") {
    const sale = sellToResourceMarket(market, "iron", placement.resources.iron);
    market = sale.market;
    ironSold = sale.unitsMoved;
    productionRevenue += sale.totalRevenue;
    placement = {
      ...placement,
      resources: {
        ...placement.resources,
        iron: sale.unitsRemaining,
      },
      flipped: sale.unitsRemaining === 0,
    };
  }

  let cards: CardZones;
  try {
    cards = discardActionCard(state.cards, state.seat, selection.cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return reject(
      state,
      message.startsWith("Unknown seat:") ? "UNKNOWN_SEAT" : "CARD_NOT_IN_HAND",
      message,
    );
  }

  const placements = {
    ...iron.placements,
    [space.id]: placement,
  };
  const flippedProviderSpaceIds = [...coal.flipped, ...iron.flipped];
  return {
    ok: true,
    state: {
      ...state,
      player: {
        money: state.player.money - moneySpent + productionRevenue,
        inventory: removed.inventory,
      },
      placements,
      market,
      cards,
    },
    effect: {
      type: "INDUSTRY_BUILT",
      seat: state.seat,
      actionsConsumed: 1,
      discardedCardId: selection.cardId,
      placement,
      overbuilt: overbuilt ?? null,
      resourceSources: [...coal.effects, ...iron.effects],
      flippedProviderSpaceIds,
      printedBuildCost: tile.build.money,
      resourceMarketCost,
      moneySpent,
      productionRevenue,
      moneyChange: productionRevenue - moneySpent,
      productionSold: { coal: coalSold, iron: ironSold },
    },
  };
}

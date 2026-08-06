import {
  purchaseFromResourceMarket,
  type ResourceMarketState,
} from "../economy/markets";
import { discardActionCard } from "../cards-v2/zones";
import type { CardZones, PlayableCardId } from "../cards-v2/types";
import { BOARD_V2 } from "../rules/generated/board-v2";

type BoardLink = (typeof BOARD_V2.links)[number];

export type NetworkEra = "canal" | "rail";
export type NetworkIndustryKind = (typeof BOARD_V2.industryKinds)[number];

export type NetworkIndustryState = {
  readonly owner: string;
  readonly locationId: string;
  readonly kind: NetworkIndustryKind;
  readonly resources: {
    readonly coal: number;
    readonly beer: number;
  };
  readonly flipped: boolean;
};

export type NetworkActionState = {
  readonly era: NetworkEra;
  readonly seat: string;
  readonly player: {
    readonly money: number;
  };
  /** Physical link ID to owning seat for links built in the current era. */
  readonly builtLinks: Readonly<Record<string, string>>;
  readonly industries: Readonly<Record<string, NetworkIndustryState>>;
  readonly market: ResourceMarketState;
  readonly cards: CardZones;
};

export type NetworkCoalChoice =
  | { readonly kind: "mine"; readonly industryId: string }
  | { readonly kind: "market" };

export type NetworkActionSelection = {
  /** Link order is significant for the Rail Era two-link option. */
  readonly linkIds: readonly string[];
  readonly coalSources: readonly NetworkCoalChoice[];
  readonly beerSourceId: string | null;
  readonly cardId: PlayableCardId;
};

export type NetworkActionErrorCode =
  | "INVALID_NETWORK_STATE"
  | "INVALID_LINK_COUNT"
  | "UNKNOWN_LINK"
  | "LINK_NOT_AVAILABLE_IN_ERA"
  | "DUPLICATE_LINK"
  | "LINK_ALREADY_BUILT"
  | "LINK_NOT_IN_PLAYER_NETWORK"
  | "INVALID_COAL_SELECTION"
  | "COAL_SOURCE_UNAVAILABLE"
  | "COAL_SOURCE_NOT_CONNECTED"
  | "COAL_SOURCE_PRIORITY"
  | "COAL_MARKET_NOT_CONNECTED"
  | "INVALID_BEER_SELECTION"
  | "BEER_REQUIRED"
  | "BEER_SOURCE_UNAVAILABLE"
  | "BEER_NOT_OWNED"
  | "INSUFFICIENT_MONEY"
  | "UNKNOWN_SEAT"
  | "CARD_NOT_IN_HAND";

export type NetworkActionError = {
  readonly code: NetworkActionErrorCode;
  readonly message: string;
};

export type NetworkCoalEffect =
  | {
      readonly kind: "mine";
      readonly industryId: string;
      readonly locationId: string;
      readonly depleted: boolean;
    }
  | {
      readonly kind: "market";
      readonly unitPrice: number;
    };

export type NetworkBeerEffect = {
  readonly industryId: string;
  readonly locationId: string;
  readonly depleted: boolean;
};

export type NetworkActionEffect = {
  readonly type: "NETWORK_BUILT";
  readonly seat: string;
  readonly era: NetworkEra;
  readonly discardedCardId: PlayableCardId;
  readonly actionsConsumed: 1;
  readonly links: readonly {
    readonly linkId: string;
    readonly owner: string;
  }[];
  readonly coalSources: readonly NetworkCoalEffect[];
  readonly beerSource: NetworkBeerEffect | null;
  readonly flippedIndustryIds: readonly string[];
  readonly linkCost: number;
  readonly resourceCost: number;
  /** Total amount to add to the round spend ledger. */
  readonly moneySpent: number;
};

type NetworkFailure = {
  readonly ok: false;
  readonly state: NetworkActionState;
  readonly error: NetworkActionError;
};

export type NetworkActionPlanResult =
  | {
      readonly ok: true;
      /** Planning never transitions state. */
      readonly state: NetworkActionState;
      readonly plan: NetworkActionEffect;
    }
  | NetworkFailure;

export type NetworkActionResult =
  | {
      readonly ok: true;
      readonly state: NetworkActionState;
      readonly effect: NetworkActionEffect;
    }
  | NetworkFailure;

type PreparedNetworkAction =
  | {
      readonly ok: true;
      readonly state: NetworkActionState;
      readonly effect: NetworkActionEffect;
    }
  | NetworkFailure;

const LINK_BY_ID = new Map<string, BoardLink>(
  BOARD_V2.links.map((link) => [link.id, link]),
);
const LOCATION_IDS = new Set<string>(Object.keys(BOARD_V2.locations));
const MARKET_LOCATIONS = new Set<string>(
  Object.entries(BOARD_V2.locations)
    .filter(
      ([, location]) =>
        "coalMarketAccess" in location && location.coalMarketAccess === true,
    )
    .map(([locationId]) => locationId),
);
const INDUSTRY_KINDS = new Set<string>(BOARD_V2.industryKinds);

function reject(
  state: NetworkActionState,
  code: NetworkActionErrorCode,
  message: string,
): NetworkFailure {
  return { ok: false, state, error: { code, message } };
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validateState(state: NetworkActionState): NetworkFailure | null {
  if (state.era !== "canal" && state.era !== "rail") {
    return reject(state, "INVALID_NETWORK_STATE", "Unsupported Network era.");
  }
  if (typeof state.seat !== "string" || state.seat.trim().length === 0) {
    return reject(
      state,
      "INVALID_NETWORK_STATE",
      "Acting seat must be a non-empty string.",
    );
  }
  if (!isNonNegativeSafeInteger(state.player.money)) {
    return reject(
      state,
      "INVALID_NETWORK_STATE",
      "Player money must be a non-negative safe integer.",
    );
  }

  try {
    purchaseFromResourceMarket(state.market, "coal", 0);
  } catch (error) {
    return reject(
      state,
      "INVALID_NETWORK_STATE",
      error instanceof Error ? error.message : String(error),
    );
  }

  for (const [linkId, owner] of Object.entries(state.builtLinks)) {
    const link = LINK_BY_ID.get(linkId);
    if (!link || typeof owner !== "string" || owner.trim().length === 0) {
      return reject(
        state,
        "INVALID_NETWORK_STATE",
        `Invalid built link state: ${linkId}.`,
      );
    }
    if (!(link.eras as readonly string[]).includes(state.era)) {
      return reject(
        state,
        "INVALID_NETWORK_STATE",
        `Built link ${linkId} is unavailable in the ${state.era} era.`,
      );
    }
  }

  for (const [industryId, industry] of Object.entries(state.industries)) {
    if (
      industryId.length === 0 ||
      typeof industry.owner !== "string" ||
      industry.owner.trim().length === 0 ||
      !LOCATION_IDS.has(industry.locationId) ||
      !INDUSTRY_KINDS.has(industry.kind) ||
      !isNonNegativeSafeInteger(industry.resources.coal) ||
      !isNonNegativeSafeInteger(industry.resources.beer) ||
      typeof industry.flipped !== "boolean"
    ) {
      return reject(
        state,
        "INVALID_NETWORK_STATE",
        `Invalid industry state: ${industryId}.`,
      );
    }
  }

  return null;
}

function linkCost(era: NetworkEra, linkCount: number): number {
  if (era === "canal") return 3;
  return linkCount === 1 ? 5 : 15;
}

function requiredCoal(era: NetworkEra, linkCount: number): number {
  return era === "rail" ? linkCount : 0;
}

function playerNetworkLocations(
  state: NetworkActionState,
): Set<string> {
  const locations = new Set<string>();
  for (const industry of Object.values(state.industries)) {
    if (industry.owner === state.seat) locations.add(industry.locationId);
  }
  for (const [linkId, owner] of Object.entries(state.builtLinks)) {
    if (owner !== state.seat) continue;
    for (const locationId of LINK_BY_ID.get(linkId)?.adjacentLocations ?? []) {
      locations.add(locationId);
    }
  }
  return locations;
}

function locationDistances(
  anchorLocations: readonly string[],
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

  const distances = new Map<string, number>();
  const queue: string[] = [];
  for (const locationId of anchorLocations) {
    if (!distances.has(locationId)) {
      distances.set(locationId, 0);
      queue.push(locationId);
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const locationId = queue[index];
    const distance = distances.get(locationId) ?? 0;
    for (const neighbour of adjacency.get(locationId) ?? []) {
      if (!distances.has(neighbour)) {
        distances.set(neighbour, distance + 1);
        queue.push(neighbour);
      }
    }
  }
  return distances;
}

function prepareNetworkAction(
  state: NetworkActionState,
  selection: NetworkActionSelection,
): PreparedNetworkAction {
  const invalidState = validateState(state);
  if (invalidState) return invalidState;

  if (!Array.isArray(selection.linkIds)) {
    return reject(state, "INVALID_LINK_COUNT", "Link IDs must be an array.");
  }
  const validLinkCount =
    state.era === "canal"
      ? selection.linkIds.length === 1
      : selection.linkIds.length === 1 || selection.linkIds.length === 2;
  if (!validLinkCount) {
    return reject(
      state,
      "INVALID_LINK_COUNT",
      state.era === "canal"
        ? "A Canal Network action builds exactly one link."
        : "A Rail Network action builds one or two links.",
    );
  }
  if (new Set(selection.linkIds).size !== selection.linkIds.length) {
    return reject(
      state,
      "DUPLICATE_LINK",
      "A Network action cannot select the same physical link twice.",
    );
  }

  const links: BoardLink[] = [];
  for (const linkId of selection.linkIds) {
    const link = LINK_BY_ID.get(linkId);
    if (!link) {
      return reject(state, "UNKNOWN_LINK", `Unknown physical link: ${linkId}.`);
    }
    if (!(link.eras as readonly string[]).includes(state.era)) {
      return reject(
        state,
        "LINK_NOT_AVAILABLE_IN_ERA",
        `Link ${linkId} is unavailable in the ${state.era} era.`,
      );
    }
    if (Object.hasOwn(state.builtLinks, linkId)) {
      return reject(
        state,
        "LINK_ALREADY_BUILT",
        `Physical link is already occupied: ${linkId}.`,
      );
    }
    links.push(link);
  }

  const actorNetwork = playerNetworkLocations(state);
  for (const link of links) {
    if (!link.adjacentLocations.some((locationId) => actorNetwork.has(locationId))) {
      return reject(
        state,
        "LINK_NOT_IN_PLAYER_NETWORK",
        `Link is not adjacent to ${state.seat}'s network: ${link.id}.`,
      );
    }
    for (const locationId of link.adjacentLocations) {
      actorNetwork.add(locationId);
    }
  }

  const coalRequired = requiredCoal(state.era, links.length);
  if (
    !Array.isArray(selection.coalSources) ||
    selection.coalSources.length !== coalRequired
  ) {
    return reject(
      state,
      "INVALID_COAL_SELECTION",
      `This Network action requires exactly ${coalRequired} coal source selection(s).`,
    );
  }

  const requiresBeer = state.era === "rail" && links.length === 2;
  if (requiresBeer && selection.beerSourceId === null) {
    return reject(
      state,
      "BEER_REQUIRED",
      "Building two rail links requires one beer from the acting player's brewery.",
    );
  }
  if (!requiresBeer && selection.beerSourceId !== null) {
    return reject(
      state,
      "INVALID_BEER_SELECTION",
      "Beer is only consumed when building two rail links.",
    );
  }

  let industries = state.industries;
  let market = state.market;
  let resourceCost = 0;
  const coalEffects: NetworkCoalEffect[] = [];
  const flippedIndustryIds = new Set<string>();
  const existingLinkIds = Object.keys(state.builtLinks);
  const plannedLinkIds: string[] = [];

  for (let index = 0; index < coalRequired; index += 1) {
    const link = links[index];
    plannedLinkIds.push(link.id);
    const distances = locationDistances(link.adjacentLocations, [
      ...existingLinkIds,
      ...plannedLinkIds,
    ]);
    const connectedMines = Object.entries(industries)
      .filter(
        ([, industry]) =>
          industry.kind === "coal_mine" &&
          !industry.flipped &&
          industry.resources.coal > 0 &&
          distances.has(industry.locationId),
      )
      .map(([industryId, industry]) => ({
        industryId,
        industry,
        distance: distances.get(industry.locationId) ?? Number.POSITIVE_INFINITY,
      }));
    const nearestMineDistance = connectedMines.reduce(
      (nearest, candidate) => Math.min(nearest, candidate.distance),
      Number.POSITIVE_INFINITY,
    );
    const choice = selection.coalSources[index];

    if (choice.kind === "market") {
      if (connectedMines.length > 0) {
        return reject(
          state,
          "COAL_SOURCE_PRIORITY",
          "Connected coal mines must be consumed before buying from the market.",
        );
      }
      const marketConnected = [...MARKET_LOCATIONS].some((locationId) =>
        distances.has(locationId),
      );
      if (!marketConnected) {
        return reject(
          state,
          "COAL_MARKET_NOT_CONNECTED",
          `Rail link ${link.id} is not connected to a coal market.`,
        );
      }
      const purchase = purchaseFromResourceMarket(market, "coal", 1);
      market = purchase.market;
      resourceCost += purchase.totalCost;
      coalEffects.push({ kind: "market", unitPrice: purchase.unitPrices[0] });
      continue;
    }

    if (choice.kind !== "mine" || typeof choice.industryId !== "string") {
      return reject(
        state,
        "INVALID_COAL_SELECTION",
        `Invalid coal source selection for rail link ${link.id}.`,
      );
    }
    const source = industries[choice.industryId];
    if (
      !source ||
      source.kind !== "coal_mine" ||
      source.flipped ||
      source.resources.coal < 1
    ) {
      return reject(
        state,
        "COAL_SOURCE_UNAVAILABLE",
        `Coal source is unavailable: ${choice.industryId}.`,
      );
    }
    const sourceDistance = distances.get(source.locationId);
    if (sourceDistance === undefined) {
      return reject(
        state,
        "COAL_SOURCE_NOT_CONNECTED",
        `Coal source is not connected to rail link ${link.id}: ${choice.industryId}.`,
      );
    }
    if (sourceDistance !== nearestMineDistance) {
      return reject(
        state,
        "COAL_SOURCE_PRIORITY",
        `Coal source is not a nearest connected mine: ${choice.industryId}.`,
      );
    }

    const coal = source.resources.coal - 1;
    const depleted = coal === 0;
    industries = {
      ...industries,
      [choice.industryId]: {
        ...source,
        resources: { ...source.resources, coal },
        flipped: depleted,
      },
    };
    if (depleted) flippedIndustryIds.add(choice.industryId);
    coalEffects.push({
      kind: "mine",
      industryId: choice.industryId,
      locationId: source.locationId,
      depleted,
    });
  }

  let beerEffect: NetworkBeerEffect | null = null;
  if (requiresBeer) {
    const beerSourceId = selection.beerSourceId as string;
    const brewery = industries[beerSourceId];
    if (
      !brewery ||
      brewery.kind !== "brewery" ||
      brewery.flipped ||
      brewery.resources.beer < 1
    ) {
      return reject(
        state,
        "BEER_SOURCE_UNAVAILABLE",
        `Beer source is unavailable: ${beerSourceId}.`,
      );
    }
    if (brewery.owner !== state.seat) {
      return reject(
        state,
        "BEER_NOT_OWNED",
        "A two-rail Network action must use the acting player's brewery.",
      );
    }
    const beer = brewery.resources.beer - 1;
    const depleted = beer === 0;
    industries = {
      ...industries,
      [beerSourceId]: {
        ...brewery,
        resources: { ...brewery.resources, beer },
        flipped: depleted,
      },
    };
    if (depleted) flippedIndustryIds.add(beerSourceId);
    beerEffect = {
      industryId: beerSourceId,
      locationId: brewery.locationId,
      depleted,
    };
  }

  const baseLinkCost = linkCost(state.era, links.length);
  const moneySpent = baseLinkCost + resourceCost;
  if (state.player.money < moneySpent) {
    return reject(
      state,
      "INSUFFICIENT_MONEY",
      `Network action costs £${moneySpent}, but the player has £${state.player.money}.`,
    );
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

  const builtLinks = { ...state.builtLinks };
  for (const link of links) builtLinks[link.id] = state.seat;

  const effect: NetworkActionEffect = {
    type: "NETWORK_BUILT",
    seat: state.seat,
    era: state.era,
    discardedCardId: selection.cardId,
    actionsConsumed: 1,
    links: links.map((link) => ({ linkId: link.id, owner: state.seat })),
    coalSources: coalEffects,
    beerSource: beerEffect,
    flippedIndustryIds: [...flippedIndustryIds],
    linkCost: baseLinkCost,
    resourceCost,
    moneySpent,
  };

  return {
    ok: true,
    state: {
      ...state,
      player: { ...state.player, money: state.player.money - moneySpent },
      builtLinks,
      industries,
      market,
      cards,
    },
    effect,
  };
}

/** Validates and prices a Network action without transitioning the input state. */
export function planNetworkAction(
  state: NetworkActionState,
  selection: NetworkActionSelection,
): NetworkActionPlanResult {
  const prepared = prepareNetworkAction(state, selection);
  if (!prepared.ok) return prepared;
  return { ok: true, state, plan: prepared.effect };
}

/** Executes the validated Network action as one immutable state transition. */
export function executeNetworkAction(
  state: NetworkActionState,
  selection: NetworkActionSelection,
): NetworkActionResult {
  return prepareNetworkAction(state, selection);
}

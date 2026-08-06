import { incomeLevelAt } from "@/engine/economy/income";
import type { GameStateV2 } from "@/engine/game-v2/state";
import { BOARD_V2 } from "@/engine/rules/generated/board-v2";
import { CARD_CATALOG } from "@/engine/rules/generated/cards";
import {
  INDUSTRY_TILE_BY_ID,
  INDUSTRY_TILE_KIND_ORDER,
  type IndustryTileKind,
} from "@/engine/rules/generated/industry-tiles-v2";
import { MARKET_DATA } from "@/engine/rules/generated/ruleset";

export type GameV2DevPlayerCount = 2 | 3 | 4;

export type GameV2DevIcon = {
  readonly emoji: string;
  readonly label: string;
};

export type GameV2DevCard = {
  readonly id: string;
  readonly label: string;
};

export type GameV2DevInventoryRow = GameV2DevIcon & {
  readonly kind: IndustryTileKind;
  readonly remaining: number;
  readonly nextTileId: string | null;
  readonly nextLevel: number | null;
};

export type GameV2DevPlayer = {
  readonly seat: string;
  readonly isCurrent: boolean;
  readonly money: number;
  readonly incomeLevel: number;
  readonly incomeMarkerSpace: number;
  readonly victoryPoints: number;
  readonly linkTokensRemaining: number;
  readonly removedIndustryTiles: number;
  readonly hand: readonly GameV2DevCard[];
  readonly inventory: readonly GameV2DevInventoryRow[];
};

export type GameV2DevPlacement = GameV2DevIcon & {
  readonly owner: string;
  readonly tileId: string;
  readonly level: number;
  readonly flipped: boolean;
  readonly resources: {
    readonly coal: number;
    readonly iron: number;
    readonly beer: number;
  };
};

export type GameV2DevBuildSpace = {
  readonly id: string;
  readonly allowed: readonly (GameV2DevIcon & { readonly kind: string })[];
  readonly placement: GameV2DevPlacement | null;
};

export type GameV2DevBoardLocation = {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly baseLinkIcons: number;
  readonly coalMarketAccess: boolean;
  readonly buildSpaces: readonly GameV2DevBuildSpace[];
  readonly merchantSpaceIds: readonly string[];
};

export type GameV2DevMerchantSpace = {
  readonly id: string;
  readonly locationId: string;
  readonly locationLabel: string;
  readonly active: boolean;
  readonly tileId: string | null;
  readonly demands: readonly (GameV2DevIcon & { readonly kind: string })[];
  readonly beer: number;
  readonly bonus: string;
};

export type GameV2DevMarket = {
  readonly kind: "coal" | "iron";
  readonly emoji: string;
  readonly units: number;
  readonly capacity: number;
  readonly nextPrice: number;
  readonly fallbackPrice: number;
};

export type GameV2DevModel = {
  readonly identity: {
    readonly gameId: string;
    readonly seed: string;
    readonly schemaVersion: number;
    readonly ruleset: string;
  };
  readonly progress: {
    readonly era: GameStateV2["era"];
    readonly round: number;
    readonly turnNumber: number;
    readonly currentSeat: string;
    readonly actionsUsed: number;
    readonly actionLimit: number;
    readonly revision: number;
  };
  readonly players: readonly GameV2DevPlayer[];
  readonly markets: readonly GameV2DevMarket[];
  readonly cards: {
    readonly draw: number;
    readonly discard: number;
    readonly inHands: number;
    readonly wildLocation: number;
    readonly wildIndustry: number;
  };
  readonly merchants: readonly GameV2DevMerchantSpace[];
  readonly board: {
    readonly locations: readonly GameV2DevBoardLocation[];
    readonly buildSpaceCount: number;
    readonly occupiedBuildSpaces: number;
  };
  readonly links: {
    readonly built: number;
    readonly total: number;
    readonly availableInEra: number;
    readonly entries: readonly {
      readonly id: string;
      readonly owner: string;
      readonly locations: readonly string[];
    }[];
  };
  readonly events: readonly {
    readonly sequence: number;
    readonly type: string;
    readonly data: unknown;
  }[];
};

const INDUSTRY_ICON: Record<string, GameV2DevIcon> = {
  manufacturer: { emoji: "🏭", label: "Manufacturer" },
  manufactured: { emoji: "🏭", label: "Manufacturer" },
  cotton: { emoji: "🧵", label: "Cotton mill" },
  cotton_mill: { emoji: "🧵", label: "Cotton mill" },
  brewery: { emoji: "🍺", label: "Brewery" },
  coal: { emoji: "⚫", label: "Coal mine" },
  coal_mine: { emoji: "⚫", label: "Coal mine" },
  pottery: { emoji: "🏺", label: "Pottery" },
  iron: { emoji: "🔩", label: "Iron works" },
  iron_works: { emoji: "🔩", label: "Iron works" },
};

const CARD_LABEL_BY_ID: ReadonlyMap<string, string> = new Map(
  CARD_CATALOG.map((card) => [card.id, humanize(card.templateId)]),
);

function humanize(value: string): string {
  return value
    .replace(/^industry-/, "")
    .replace(/^location-/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function gameV2DevSeats(playerCount: GameV2DevPlayerCount): string[] {
  return Array.from({ length: playerCount }, (_, index) =>
    `Player ${index + 1}`
  );
}

export function gameV2DevIndustryIcon(kind: string): GameV2DevIcon {
  return INDUSTRY_ICON[kind] ?? { emoji: "▣", label: humanize(kind) };
}

function cardView(cardId: string): GameV2DevCard {
  if (cardId === "wild-location") return { id: cardId, label: "Wild location" };
  if (cardId === "wild-industry") return { id: cardId, label: "Wild industry" };
  return { id: cardId, label: CARD_LABEL_BY_ID.get(cardId) ?? humanize(cardId) };
}

function marketView(
  kind: "coal" | "iron",
  units: number,
): GameV2DevMarket {
  const rule = MARKET_DATA[kind];
  return {
    kind,
    emoji: kind === "coal" ? "⚫" : "🔩",
    units,
    capacity: rule.fillOrderPrices.length,
    nextPrice: units === 0
      ? rule.fallbackPrice
      : rule.fillOrderPrices[units - 1],
    fallbackPrice: rule.fallbackPrice,
  };
}

function merchantBonus(locationId: string): string {
  const location = BOARD_V2.locations[
    locationId as keyof typeof BOARD_V2.locations
  ];
  if (!location || location.kind !== "merchant") return "—";
  const bonus = location.merchantBonus;
  if (bonus.kind === "money") return `£${bonus.amount}`;
  if (bonus.kind === "victory_points") return `${bonus.amount} VP`;
  if (bonus.kind === "income_spaces") return `+${bonus.amount} income spaces`;
  return `${bonus.amount} free Develop`;
}

export function toGameV2DevModel(state: GameStateV2): GameV2DevModel {
  const players = state.turnOrder.map((seat): GameV2DevPlayer => {
    const player = state.players[seat];
    return {
      seat,
      isCurrent: seat === state.currentSeat,
      money: player.money,
      incomeLevel: incomeLevelAt(player.incomeMarkerSpace),
      incomeMarkerSpace: player.incomeMarkerSpace,
      victoryPoints: player.victoryPoints,
      linkTokensRemaining: player.linkTokensRemaining,
      removedIndustryTiles: player.removedIndustryTileIds.length,
      hand: state.cards.hands[seat].map(cardView),
      inventory: INDUSTRY_TILE_KIND_ORDER.map((kind): GameV2DevInventoryRow => {
        const stack = player.industryInventory.stacks[kind];
        const nextTileId = stack[0] ?? null;
        const icon = gameV2DevIndustryIcon(kind);
        return {
          kind,
          ...icon,
          remaining: stack.length,
          nextTileId,
          nextLevel: nextTileId === null ? null : INDUSTRY_TILE_BY_ID[nextTileId].level,
        };
      }),
    };
  });

  const locations = Object.entries(BOARD_V2.locations).map(
    ([locationId, location]): GameV2DevBoardLocation => {
      const buildSpaces = "buildSpaces" in location
        ? location.buildSpaces.map((space): GameV2DevBuildSpace => {
            const placed = state.board.placedIndustries[space.id];
            const tile = placed ? INDUSTRY_TILE_BY_ID[placed.tileId] : null;
            return {
              id: space.id,
              allowed: space.allows.map((kind) => ({
                kind,
                ...gameV2DevIndustryIcon(kind),
              })),
              placement: placed && tile
                ? {
                    owner: placed.owner,
                    tileId: placed.tileId,
                    level: tile.level,
                    flipped: placed.flipped,
                    resources: { ...placed.resources },
                    ...gameV2DevIndustryIcon(tile.industry),
                  }
                : null,
            };
          })
        : [];
      return {
        id: locationId,
        label: location.label,
        kind: location.kind,
        baseLinkIcons: location.baseLinkIcons,
        coalMarketAccess:
          "coalMarketAccess" in location && location.coalMarketAccess === true,
        buildSpaces,
        merchantSpaceIds: "merchantSpaces" in location
          ? [...location.merchantSpaces]
          : [],
      };
    },
  );

  const merchantById = new Map(
    locations.map((location) => [location.id, location.label]),
  );
  const merchants = state.merchants.spaces.map(
    (space): GameV2DevMerchantSpace => ({
      id: space.merchantSpaceId,
      locationId: space.locationId,
      locationLabel: merchantById.get(space.locationId) ?? humanize(space.locationId),
      active: space.active,
      tileId: space.tileId,
      demands: space.demandIndustries.map((kind) => ({
        kind,
        ...gameV2DevIndustryIcon(kind),
      })),
      beer: space.beer,
      bonus: merchantBonus(space.locationId),
    }),
  );

  const builtLinkEntries = BOARD_V2.links.flatMap((link) => {
    const owner = state.board.builtLinks[link.id];
    return owner
      ? [{ id: link.id, owner, locations: [...link.adjacentLocations] }]
      : [];
  });
  const handCards = players.reduce((total, player) => total + player.hand.length, 0);

  return {
    identity: {
      gameId: state.gameId,
      seed: state.seed,
      schemaVersion: state.schemaVersion,
      ruleset: `${state.ruleset.id} ${state.ruleset.version}`,
    },
    progress: {
      era: state.era,
      round: state.round,
      turnNumber: state.turnNumber,
      currentSeat: state.currentSeat,
      actionsUsed: state.actionsUsed,
      actionLimit: state.actionLimit,
      revision: state.revision,
    },
    players,
    markets: [
      marketView("coal", state.market.coal),
      marketView("iron", state.market.iron),
    ],
    cards: {
      draw: state.cards.draw.length,
      discard: state.cards.discard.length,
      inHands: handCards,
      wildLocation: state.cards.wildSupplies.location,
      wildIndustry: state.cards.wildSupplies.industry,
    },
    merchants,
    board: {
      locations,
      buildSpaceCount: locations.reduce(
        (total, location) => total + location.buildSpaces.length,
        0,
      ),
      occupiedBuildSpaces: Object.keys(state.board.placedIndustries).length,
    },
    links: {
      built: builtLinkEntries.length,
      total: BOARD_V2.links.length,
      availableInEra: BOARD_V2.links.filter((link) =>
        (link.eras as readonly string[]).includes(state.era)
      ).length,
      entries: builtLinkEntries,
    },
    events: state.events.slice(-8).map((event) => ({ ...event })),
  };
}

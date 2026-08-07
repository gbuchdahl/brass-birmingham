import {
  executeBuildAction,
  type BuildActionEffect,
  type BuildActionErrorCode,
  type BuildActionSelection,
  type BuildActionState,
  type BuiltIndustryState,
} from "../actions-v2/build";
import {
  developAction,
  type DevelopActionEffect,
  type DevelopActionErrorCode,
  type DevelopActionSelection,
  type DevelopActionState,
} from "../actions-v2/develop";
import {
  executeNetworkAction,
  type NetworkActionEffect,
  type NetworkActionErrorCode,
  type NetworkActionSelection,
  type NetworkActionState,
  type NetworkIndustryKind,
} from "../actions-v2/network";
import {
  passAction,
  type PassActionEffect,
  type PassActionErrorCode,
  type PassActionState,
} from "../actions-v2/pass";
import {
  scoutAction,
  type ScoutActionEffect,
  type ScoutActionErrorCode,
  type ScoutActionSelection,
  type ScoutActionState,
} from "../actions-v2/scout";
import {
  sellAction,
  type SellActionEffect,
  type SellActionErrorCode,
  type SellActionSelection,
  type SellActionState,
  type SellIndustryState,
} from "../actions-v2/sell";
import {
  takeLoan,
  type LoanActionEffect,
  type LoanActionErrorCode,
  type LoanActionState,
} from "../actions-v2/loan";
import type { PlayableCardId } from "../cards-v2/types";
import { advanceIncomeSpaces } from "../economy/income";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTile,
  type IndustryTileId,
} from "../rules/generated/industry-tiles-v2";
import type {
  GameStateV2,
  PendingMerchantFreeDevelopV2,
  PlacedIndustryStateV2,
  PlayerStateV2,
} from "./state";

export type GameV2ActionAdapterErrorCode =
  | BuildActionErrorCode
  | DevelopActionErrorCode
  | NetworkActionErrorCode
  | PassActionErrorCode
  | ScoutActionErrorCode
  | SellActionErrorCode
  | LoanActionErrorCode
  | "INVALID_ACTIVE_PLAYER"
  | "PENDING_FOLLOW_UP_REQUIRED"
  | "ROUND_SETTLEMENT_REQUIRED"
  | "ERA_TRANSITION_REQUIRED"
  | "GAME_ALREADY_ENDED"
  | "INVALID_GAME_PHASE"
  | "INSUFFICIENT_LINK_TOKENS";

export type GameV2ActionAdapterError = {
  readonly code: GameV2ActionAdapterErrorCode;
  readonly message: string;
  readonly [detail: string]: unknown;
};

export type FlipIncomeAwardV2 = {
  readonly buildSpaceId: string;
  readonly tileId: IndustryTileId;
  readonly owner: string;
  readonly printedSpaces: number;
  readonly fromMarkerSpace: number;
  readonly toMarkerSpace: number;
  readonly spacesAdvanced: number;
};

export type AdaptedActionEffectV2<T extends object> = T & {
  readonly incomeAwards: readonly FlipIncomeAwardV2[];
};

/** @deprecated Prefer the authoritative `state.progress.pending` payload. */
export type PendingActionFollowUpV2 = PendingMerchantFreeDevelopV2 & {
  readonly kind: "free_develop";
};

export type GameV2ActionAdapterResult<T extends object> =
  | {
      readonly ok: true;
      readonly state: GameStateV2;
      readonly effect: AdaptedActionEffectV2<T>;
      readonly pending?: PendingActionFollowUpV2;
    }
  | {
      readonly ok: false;
      readonly state: GameStateV2;
      readonly error: GameV2ActionAdapterError;
    };

type ActivePlayer = {
  readonly seat: string;
  readonly player: PlayerStateV2;
};

function activePlayer(
  state: GameStateV2,
): ActivePlayer | GameV2ActionAdapterError {
  if (state.progress?.phase !== "action") {
    const code = state.progress?.phase === "merchant_free_develop"
      ? "PENDING_FOLLOW_UP_REQUIRED"
      : state.progress?.phase === "round_settlement"
        ? "ROUND_SETTLEMENT_REQUIRED"
        : state.progress?.phase === "era_transition"
          ? "ERA_TRANSITION_REQUIRED"
          : state.progress?.phase === "ended"
            ? "GAME_ALREADY_ENDED"
            : "INVALID_GAME_PHASE";
    return {
      code,
      message: "A regular action can only execute during the action phase.",
    };
  }
  const seat = state.currentSeat;
  const player = state.players[seat];
  if (
    typeof seat !== "string" ||
    seat.length === 0 ||
    !state.turnOrder.includes(seat) ||
    !player ||
    player.seat !== seat
  ) {
    return {
      code: "INVALID_ACTIVE_PLAYER",
      message: "Current seat must identify its canonical active player.",
    };
  }
  return { seat, player };
}

function isAdapterError(
  value: ActivePlayer | GameV2ActionAdapterError,
): value is GameV2ActionAdapterError {
  return "code" in value;
}

function reject<T extends object>(
  state: GameStateV2,
  error: GameV2ActionAdapterError,
): GameV2ActionAdapterResult<T> {
  return { ok: false, state, error };
}

function tileFor(placement: PlacedIndustryStateV2): IndustryTile {
  return INDUSTRY_TILE_BY_ID[placement.tileId];
}

function networkKind(tile: IndustryTile): NetworkIndustryKind {
  if (tile.industry === "coal") return "coal_mine";
  if (tile.industry === "iron") return "iron_works";
  if (tile.industry === "cotton") return "cotton_mill";
  return tile.industry;
}

function buildPlacement(
  placement: PlacedIndustryStateV2,
): BuiltIndustryState {
  const tile = tileFor(placement);
  return {
    owner: placement.owner,
    buildSpaceId: placement.spaceId,
    locationId: placement.locationId,
    tileId: placement.tileId,
    faceId: tile.faceId,
    industry: tile.industry,
    level: tile.level,
    resources: { ...placement.resources },
    flipped: placement.flipped,
  };
}

function canonicalPlacement(
  placement: BuiltIndustryState,
): PlacedIndustryStateV2 {
  return {
    owner: placement.owner,
    tileId: placement.tileId as IndustryTileId,
    locationId: placement.locationId,
    spaceId: placement.buildSpaceId,
    resources: { ...placement.resources },
    flipped: placement.flipped,
  };
}

function withFlipIncome(
  before: Readonly<Record<string, PlacedIndustryStateV2>>,
  after: Readonly<Record<string, PlacedIndustryStateV2>>,
  initialPlayers: Record<string, PlayerStateV2>,
  include: (tile: IndustryTile) => boolean = () => true,
): {
  readonly players: Record<string, PlayerStateV2>;
  readonly awards: readonly FlipIncomeAwardV2[];
} {
  let players = initialPlayers;
  const awards: FlipIncomeAwardV2[] = [];
  for (const buildSpaceId of Object.keys(after).sort()) {
    const placement = after[buildSpaceId];
    const prior = before[buildSpaceId];
    const tile = tileFor(placement);
    const wasSameFlippedTile =
      prior?.tileId === placement.tileId && prior.flipped;
    if (!placement.flipped || wasSameFlippedTile || !include(tile)) continue;
    const owner = players[placement.owner];
    if (!owner) continue;
    const fromMarkerSpace = owner.incomeMarkerSpace;
    const toMarkerSpace = advanceIncomeSpaces(
      fromMarkerSpace,
      tile.incomeSteps,
    );
    players = {
      ...players,
      [placement.owner]: {
        ...owner,
        incomeMarkerSpace: toMarkerSpace,
      },
    };
    awards.push({
      buildSpaceId,
      tileId: placement.tileId,
      owner: placement.owner,
      printedSpaces: tile.incomeSteps,
      fromMarkerSpace,
      toMarkerSpace,
      spacesAdvanced: toMarkerSpace - fromMarkerSpace,
    });
  }
  return { players, awards };
}

function effectWithAwards<T extends object>(
  effect: T,
  incomeAwards: readonly FlipIncomeAwardV2[],
): AdaptedActionEffectV2<T> {
  return { ...effect, incomeAwards };
}

function copyInventory(
  inventory: PlayerStateV2["industryInventory"],
): PlayerStateV2["industryInventory"] {
  return {
    ...inventory,
    stacks: Object.fromEntries(
      Object.entries(inventory.stacks).map(([kind, stack]) => [kind, [...stack]]),
    ) as PlayerStateV2["industryInventory"]["stacks"],
  };
}

function copyCards(cards: GameStateV2["cards"]): GameStateV2["cards"] {
  return {
    hands: Object.fromEntries(
      Object.entries(cards.hands).map(([seat, hand]) => [seat, [...hand]]),
    ),
    draw: [...cards.draw],
    discard: [...cards.discard],
    wildSupplies: { ...cards.wildSupplies },
  };
}

function projectBuildActionState(
  state: GameStateV2,
  active: ActivePlayer,
): BuildActionState {
  const { seat, player } = active;
  return {
    era: state.era,
    playerCount: state.turnOrder.length as 2 | 3 | 4,
    seat,
    player: { money: player.money, inventory: copyInventory(player.industryInventory) },
    builtLinks: { ...state.board.builtLinks },
    placements: Object.fromEntries(
      Object.entries(state.board.placedIndustries).map(([spaceId, placement]) => [
        spaceId,
        buildPlacement(placement),
      ]),
    ),
    market: { ...state.market },
    cards: copyCards(state.cards),
  };
}

function projectNetworkActionState(
  state: GameStateV2,
  active: ActivePlayer,
): NetworkActionState {
  const { seat, player } = active;
  return {
    era: state.era,
    seat,
    player: { money: player.money },
    builtLinks: { ...state.board.builtLinks },
    industries: Object.fromEntries(
      Object.entries(state.board.placedIndustries).map(([spaceId, placement]) => {
        const tile = tileFor(placement);
        return [spaceId, {
          owner: placement.owner,
          locationId: placement.locationId,
          kind: networkKind(tile),
          resources: {
            coal: placement.resources.coal,
            beer: placement.resources.beer,
          },
          flipped: placement.flipped,
        }];
      }),
    ),
    market: { ...state.market },
    cards: copyCards(state.cards),
  };
}

function projectDevelopActionState(
  state: GameStateV2,
  active: ActivePlayer,
): DevelopActionState {
  const { seat, player } = active;
  return {
    seat,
    player: { money: player.money, inventory: copyInventory(player.industryInventory) },
    cards: copyCards(state.cards),
    market: { ...state.market },
    ironIndustries: Object.fromEntries(
      Object.entries(state.board.placedIndustries)
        .filter(([, placement]) => tileFor(placement).industry === "iron")
        .map(([spaceId, placement]) => [spaceId, {
          owner: placement.owner,
          cubes: placement.resources.iron,
          flipped: placement.flipped,
        }]),
    ),
  };
}

function sellIndustry(
  placement: PlacedIndustryStateV2,
): SellIndustryState | null {
  const tile = tileFor(placement);
  if (
    tile.industry !== "manufacturer" &&
    tile.industry !== "cotton" &&
    tile.industry !== "pottery" &&
    tile.industry !== "brewery"
  ) return null;
  return {
    owner: placement.owner,
    locationId: placement.locationId,
    faceId: tile.faceId,
    product: tile.industry === "brewery" ? 0 : placement.flipped ? 0 : 1,
    beer: tile.industry === "brewery" ? placement.resources.beer : 0,
    flipped: placement.flipped,
  };
}

function projectSellActionState(
  state: GameStateV2,
  active: ActivePlayer,
): SellActionState {
  const { seat, player } = active;
  return {
    seat,
    player: {
      money: player.money,
      victoryPoints: player.victoryPoints,
      incomeMarkerSpace: player.incomeMarkerSpace,
    },
    cards: copyCards(state.cards),
    builtLinks: { ...state.board.builtLinks },
    industries: Object.fromEntries(
      Object.entries(state.board.placedIndustries).flatMap(
        ([spaceId, placement]) => {
          const projected = sellIndustry(placement);
          return projected ? [[spaceId, projected]] : [];
        },
      ),
    ),
    merchantSpaces: state.merchants.spaces.map((space) => ({
      ...space,
      demandIndustries: [...space.demandIndustries],
    })),
  };
}

function projectLoanActionState(
  state: GameStateV2,
  active: ActivePlayer,
): LoanActionState {
  const { seat, player } = active;
  return {
    seat,
    player: {
      money: player.money,
      incomeMarkerSpace: player.incomeMarkerSpace,
    },
    cards: copyCards(state.cards),
  };
}

function projectScoutActionState(
  state: GameStateV2,
  active: ActivePlayer,
): ScoutActionState {
  return { seat: active.seat, cards: copyCards(state.cards) };
}

function projectPassActionState(
  state: GameStateV2,
  active: ActivePlayer,
): PassActionState {
  return { seat: active.seat, cards: copyCards(state.cards) };
}

export function executeBuildForGameV2(
  state: GameStateV2,
  selection: BuildActionSelection,
): GameV2ActionAdapterResult<BuildActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  const result = executeBuildAction(projectBuildActionState(state, active), selection);
  if (!result.ok) return reject(state, result.error);

  const placedIndustries = Object.fromEntries(
    Object.entries(result.state.placements).map(([spaceId, placement]) => [
      spaceId,
      canonicalPlacement(placement),
    ]),
  );
  let players: Record<string, PlayerStateV2> = {
    ...state.players,
    [active.seat]: {
      ...active.player,
      money: result.state.player.money,
      industryInventory: result.state.player.inventory,
    },
  };
  if (result.effect.overbuilt) {
    const owner = players[result.effect.overbuilt.owner];
    if (owner) {
      players = {
        ...players,
        [owner.seat]: {
          ...owner,
          removedIndustryTileIds: [
            ...owner.removedIndustryTileIds,
            result.effect.overbuilt.tileId as IndustryTileId,
          ],
        },
      };
    }
  }
  const income = withFlipIncome(
    state.board.placedIndustries,
    placedIndustries,
    players,
  );
  return {
    ok: true,
    state: {
      ...state,
      players: income.players,
      cards: result.state.cards,
      market: result.state.market,
      board: { ...state.board, placedIndustries },
    },
    effect: effectWithAwards(result.effect, income.awards),
  };
}

export function executeNetworkForGameV2(
  state: GameStateV2,
  selection: NetworkActionSelection,
): GameV2ActionAdapterResult<NetworkActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  if (typeof selection !== "object" || selection === null) {
    return reject(state, {
      code: "INVALID_LINK_COUNT",
      message: "Link IDs must be an array.",
    });
  }
  const result = executeNetworkAction(
    projectNetworkActionState(state, active),
    selection,
  );
  if (!result.ok) return reject(state, result.error);
  if (active.player.linkTokensRemaining < result.effect.links.length) {
    return reject(state, {
      code: "INSUFFICIENT_LINK_TOKENS",
      message: "The active player does not have enough link tokens.",
    });
  }
  const placedIndustries = Object.fromEntries(
    Object.entries(state.board.placedIndustries).map(([spaceId, placement]) => {
      const projected = result.state.industries[spaceId];
      return [spaceId, {
        ...placement,
        resources: {
          ...placement.resources,
          coal: projected.resources.coal,
          beer: projected.resources.beer,
        },
        flipped: projected.flipped,
      }];
    }),
  );
  const players: Record<string, PlayerStateV2> = {
    ...state.players,
    [active.seat]: {
      ...active.player,
      money: result.state.player.money,
      linkTokensRemaining:
        active.player.linkTokensRemaining - result.effect.links.length,
    },
  };
  const income = withFlipIncome(
    state.board.placedIndustries,
    placedIndustries,
    players,
  );
  return {
    ok: true,
    state: {
      ...state,
      players: income.players,
      cards: result.state.cards,
      market: result.state.market,
      board: {
        builtLinks: result.state.builtLinks,
        placedIndustries,
      },
    },
    effect: effectWithAwards(result.effect, income.awards),
  };
}

export function executeDevelopForGameV2(
  state: GameStateV2,
  selection: DevelopActionSelection,
): GameV2ActionAdapterResult<DevelopActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  const result = developAction(projectDevelopActionState(state, active), selection);
  if (!result.ok) return reject(state, result.error);
  const placedIndustries = Object.fromEntries(
    Object.entries(state.board.placedIndustries).map(([spaceId, placement]) => {
      const projected = result.state.ironIndustries[spaceId];
      return projected
        ? [spaceId, {
            ...placement,
            resources: { ...placement.resources, iron: projected.cubes },
            flipped: projected.flipped,
          }]
        : [spaceId, placement];
    }),
  );
  let players: Record<string, PlayerStateV2> = {
    ...state.players,
    [active.seat]: {
      ...active.player,
      money: result.state.player.money,
      industryInventory: result.state.player.inventory,
      removedIndustryTileIds: [
        ...active.player.removedIndustryTileIds,
        ...result.effect.removedTileIds,
      ],
    },
  };
  const income = withFlipIncome(
    state.board.placedIndustries,
    placedIndustries,
    players,
  );
  players = income.players;
  return {
    ok: true,
    state: {
      ...state,
      players,
      cards: result.state.cards,
      market: result.state.market,
      board: { ...state.board, placedIndustries },
    },
    effect: effectWithAwards(result.effect, income.awards),
  };
}

export function executeSellForGameV2(
  state: GameStateV2,
  selection: SellActionSelection,
): GameV2ActionAdapterResult<SellActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  const result = sellAction(projectSellActionState(state, active), selection);
  if (!result.ok) return reject(state, result.error);
  const placedIndustries = Object.fromEntries(
    Object.entries(state.board.placedIndustries).map(([spaceId, placement]) => {
      const projected = result.state.industries[spaceId];
      if (!projected) return [spaceId, placement];
      const tile = tileFor(placement);
      return [spaceId, {
        ...placement,
        resources: tile.industry === "brewery"
          ? { ...placement.resources, beer: projected.beer }
          : placement.resources,
        flipped: projected.flipped,
      }];
    }),
  );
  const players: Record<string, PlayerStateV2> = {
    ...state.players,
    [active.seat]: {
      ...active.player,
      money: result.state.player.money,
      victoryPoints: result.state.player.victoryPoints,
      incomeMarkerSpace: result.state.player.incomeMarkerSpace,
    },
  };
  const income = withFlipIncome(
    state.board.placedIndustries,
    placedIndustries,
    players,
    (tile) => tile.industry === "brewery",
  );
  const pendingCount = result.effect.rewards.freeDevelops;
  const merchantSpaceIds = result.effect.sales.flatMap((sale) =>
    sale.beer.kind === "merchant" && sale.beer.bonus.kind === "free_develop"
      ? [sale.merchantSpaceId]
      : [],
  );
  const pending: PendingMerchantFreeDevelopV2 | null = pendingCount > 0
    ? {
        seat: active.seat,
        count: pendingCount,
        source: "merchant_bonus",
        merchantSpaceIds,
      }
    : null;
  return {
    ok: true,
    state: {
      ...state,
      ...(pending
        ? {
            progress: {
              phase: "merchant_free_develop" as const,
              pending,
            },
          }
        : {}),
      players: income.players,
      cards: result.state.cards,
      merchants: {
        ...state.merchants,
        spaces: result.state.merchantSpaces.map((space) => ({
          ...space,
          demandIndustries: [...space.demandIndustries],
        })),
      },
      board: { ...state.board, placedIndustries },
    },
    effect: effectWithAwards(result.effect, income.awards),
    ...(pending
      ? {
          pending: {
            kind: "free_develop" as const,
            ...pending,
          },
        }
      : {}),
  };
}

export function executeLoanForGameV2(
  state: GameStateV2,
  cardId: PlayableCardId,
): GameV2ActionAdapterResult<LoanActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  const result = takeLoan(projectLoanActionState(state, active), cardId);
  if (!result.ok) return reject(state, result.error);
  return {
    ok: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [active.seat]: {
          ...active.player,
          money: result.state.player.money,
          incomeMarkerSpace: result.state.player.incomeMarkerSpace,
        },
      },
      cards: result.state.cards,
    },
    effect: effectWithAwards(result.effect, []),
  };
}

export function executeScoutForGameV2(
  state: GameStateV2,
  selection: ScoutActionSelection,
): GameV2ActionAdapterResult<ScoutActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  const result = scoutAction(projectScoutActionState(state, active), selection);
  if (!result.ok) return reject(state, result.error);
  return {
    ok: true,
    state: { ...state, cards: result.state.cards },
    effect: effectWithAwards(result.effect, []),
  };
}

export function executePassForGameV2(
  state: GameStateV2,
  cardId: PlayableCardId,
): GameV2ActionAdapterResult<PassActionEffect> {
  const active = activePlayer(state);
  if (isAdapterError(active)) return reject(state, active);
  const result = passAction(projectPassActionState(state, active), cardId);
  if (!result.ok) return reject(state, result.error);
  return {
    ok: true,
    state: { ...state, cards: result.state.cards },
    effect: effectWithAwards(result.effect, []),
  };
}

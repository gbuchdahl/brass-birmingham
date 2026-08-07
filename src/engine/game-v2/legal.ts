import {
  WILD_INDUSTRY_CARD_ID,
  WILD_LOCATION_CARD_ID,
  type PlayableCardId,
} from "../cards-v2/types";
import type { NetworkActionSelection } from "../actions-v2/network";
import { canTakeLoan } from "../economy/income";
import { BOARD_V2 } from "../rules/generated/board-v2";
import { WILD_CARD_SUPPLY } from "../rules/generated/cards";
import {
  INDUSTRY_TILE_BY_ID,
  type IndustryTileId,
  type IndustryTileKind,
} from "../rules/generated/industry-tiles-v2";
import { SETUP_DATA } from "../rules/generated/ruleset";
import type {
  GameV2Command,
  GameV2PlayerCommand,
} from "./commands";
import { executeNetworkForGameV2 } from "./action-adapters";
import {
  validateGameStateV2,
  type GameProgressV2,
  type GameStateV2,
} from "./state";

export type GameV2PlayerActionKind = GameV2PlayerCommand["type"];
export type GameV2LegalCommandKind = GameV2Command["type"];
export type GameV2SystemCommandKind = "SETTLE_ROUND" | "RESOLVE_ERA";

export type GameV2LegalityDisabledReasonCode =
  | "INVALID_GAME_STATE"
  | "GAME_ALREADY_ENDED"
  | "NOT_ACTION_PHASE"
  | "ACTOR_REQUIRED"
  | "UNKNOWN_ACTOR"
  | "NOT_CURRENT_ACTOR"
  | "ACTION_LIMIT_REACHED"
  | "NO_ACTION_CARD"
  | "LOAN_INCOME_FLOOR"
  | "WILD_CARD_IN_HAND"
  | "WILD_SUPPLY_EMPTY"
  | "INSUFFICIENT_SCOUT_CARDS"
  | "NO_LINK_TOKENS"
  | "INSUFFICIENT_NETWORK_MONEY"
  | "NO_REACHABLE_CANAL_LINK"
  | "RAIL_NETWORK_OPTIONS_NOT_ENUMERATED"
  | "NO_MERCHANT_FREE_DEVELOP_PENDING"
  | "NOT_PENDING_ACTOR"
  | "NO_SYSTEM_COMMAND_REQUIRED"
  | "SYSTEM_ACTOR_NOT_ALLOWED"
  | "ERA_BOUNDARY_INCOMPLETE";

export type GameV2LegalityDisabledReason = {
  readonly code: GameV2LegalityDisabledReasonCode;
  readonly message: string;
};

/**
 * `exact` means the selector also exposes every supported input choice.
 * `attemptable` means the phase/card preconditions are met, but detailed target
 * enumeration is not implemented yet. Canal Network is exact; Rail Network
 * remains attemptable until coal, beer, and optional two-link inputs are listed.
 */
export type GameV2PlayerActionAvailability = {
  readonly kind: GameV2PlayerActionKind;
  readonly availability: "exact" | "attemptable" | "disabled";
  readonly reason: GameV2LegalityDisabledReason | null;
};

export type GameV2ScoutOptions = {
  readonly selectableRegularCardIds: readonly PlayableCardId[];
  readonly cardTriples: readonly (readonly [
    PlayableCardId,
    PlayableCardId,
    PlayableCardId,
  ])[];
  readonly reason: GameV2LegalityDisabledReason | null;
};

export type GameV2CanalNetworkOption = {
  readonly linkId: string;
  readonly adjacentLocations: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly linkCost: 3;
  readonly totalCost: 3;
  readonly selection: Omit<NetworkActionSelection, "cardId">;
};

export type GameV2NetworkOptions = {
  readonly availability: "exact" | "attemptable" | "disabled";
  readonly selectableCardIds: readonly PlayableCardId[];
  readonly canalLinks: readonly GameV2CanalNetworkOption[];
  readonly reason: GameV2LegalityDisabledReason | null;
};

export type GameV2MerchantFreeDevelopOptions = {
  readonly availability: "exact" | "disabled";
  readonly seat: string | null;
  readonly bonusCount: number;
  /** Tiles that may be selected first from the current inventory. */
  readonly eligibleTopTileIds: readonly IndustryTileId[];
  /** Complete selections accepted by the current all-at-once command. */
  readonly legalTileIdSelections: readonly (readonly IndustryTileId[])[];
  readonly reason: GameV2LegalityDisabledReason | null;
};

export type GameV2SystemCommandOptions = {
  readonly kind: GameV2SystemCommandKind | null;
  /** Settlement still requires caller-supplied liquidation choices. */
  readonly availability: "exact" | "attemptable" | "disabled";
  readonly reason: GameV2LegalityDisabledReason | null;
};

export type GameV2LegalOptions = {
  readonly phase: GameProgressV2["phase"] | "invalid";
  readonly actorSeat: string | null;
  readonly legalCommandKinds: readonly GameV2LegalCommandKind[];
  readonly playerActions: readonly GameV2PlayerActionAvailability[];
  readonly passCardIds: readonly PlayableCardId[];
  readonly loanCardIds: readonly PlayableCardId[];
  readonly scout: GameV2ScoutOptions;
  readonly network: GameV2NetworkOptions;
  readonly merchantFreeDevelop: GameV2MerchantFreeDevelopOptions;
  readonly system: GameV2SystemCommandOptions;
};

const PLAYER_ACTION_KINDS = [
  "BUILD",
  "NETWORK",
  "DEVELOP",
  "SELL",
  "LOAN",
  "SCOUT",
  "PASS",
] as const satisfies readonly GameV2PlayerActionKind[];

const PARTIALLY_ENUMERATED_ACTIONS = new Set<GameV2PlayerActionKind>([
  "BUILD",
  "DEVELOP",
  "SELL",
]);

const INDUSTRY_KIND_ORDER = [
  "manufacturer",
  "cotton",
  "brewery",
  "coal",
  "pottery",
  "iron",
] as const satisfies readonly IndustryTileKind[];

function reason(
  code: GameV2LegalityDisabledReasonCode,
  message: string,
): GameV2LegalityDisabledReason {
  return { code, message };
}

function isWild(cardId: PlayableCardId): boolean {
  return cardId === WILD_LOCATION_CARD_ID || cardId === WILD_INDUSTRY_CARD_ID;
}

function defaultActor(state: GameStateV2): string | null {
  if (state.progress?.phase === "action") return state.currentSeat;
  if (state.progress?.phase === "merchant_free_develop") {
    return state.progress.pending.seat;
  }
  return null;
}

function commonPlayerReason(
  state: GameStateV2,
  actorSeat: string | null,
): GameV2LegalityDisabledReason | null {
  if (state.progress.phase === "ended") {
    return reason("GAME_ALREADY_ENDED", "The game has ended.");
  }
  if (state.progress.phase !== "action") {
    return reason(
      "NOT_ACTION_PHASE",
      `Player actions are unavailable during ${state.progress.phase}.`,
    );
  }
  if (actorSeat === null) {
    return reason("ACTOR_REQUIRED", "Player actions require an actor seat.");
  }
  if (!state.turnOrder.includes(actorSeat)) {
    return reason("UNKNOWN_ACTOR", `Unknown actor seat: ${actorSeat}.`);
  }
  if (actorSeat !== state.currentSeat) {
    return reason(
      "NOT_CURRENT_ACTOR",
      `Only ${state.currentSeat} may act now.`,
    );
  }
  if (state.actionsUsed >= state.actionLimit) {
    return reason(
      "ACTION_LIMIT_REACHED",
      "The current turn has already used its action allowance.",
    );
  }
  return null;
}

function cardTriples(
  cardIds: readonly PlayableCardId[],
): readonly (readonly [PlayableCardId, PlayableCardId, PlayableCardId])[] {
  const triples: Array<readonly [
    PlayableCardId,
    PlayableCardId,
    PlayableCardId,
  ]> = [];
  for (let first = 0; first < cardIds.length - 2; first += 1) {
    for (let second = first + 1; second < cardIds.length - 1; second += 1) {
      for (let third = second + 1; third < cardIds.length; third += 1) {
        triples.push([cardIds[first], cardIds[second], cardIds[third]]);
      }
    }
  }
  return triples;
}

type InventoryStacks = Readonly<Record<
  IndustryTileKind,
  readonly IndustryTileId[]
>>;

function eligibleTopTiles(stacks: InventoryStacks): IndustryTileId[] {
  return INDUSTRY_KIND_ORDER.flatMap((kind) => {
    const tileId = stacks[kind][0];
    return tileId !== undefined && INDUSTRY_TILE_BY_ID[tileId].developable
      ? [tileId]
      : [];
  });
}

function removeTopTile(
  stacks: InventoryStacks,
  tileId: IndustryTileId,
): InventoryStacks {
  const kind = INDUSTRY_TILE_BY_ID[tileId].industry;
  return { ...stacks, [kind]: stacks[kind].slice(1) };
}

function legalFreeDevelopSelections(
  stacks: InventoryStacks,
  remaining: number,
  selected: readonly IndustryTileId[] = [],
): readonly (readonly IndustryTileId[])[] {
  const eligible = eligibleTopTiles(stacks);
  if (remaining === 0 || eligible.length === 0) return [[...selected]];
  return eligible.flatMap((tileId) =>
    legalFreeDevelopSelections(
      removeTopTile(stacks, tileId),
      remaining - 1,
      [...selected, tileId],
    )
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResolvableEraBoundary(state: GameStateV2): boolean {
  const playerCount = state.turnOrder.length as 2 | 3 | 4;
  const finalRound = SETUP_DATA.playerCounts[playerCount]?.roundsPerEra;
  const settlement = [...state.events].reverse().find(
    (event) =>
      event.type === "GAME_CREATED" ||
      event.type === "ACTION_ACCEPTED" ||
      event.type === "ROUND_SETTLED" ||
      event.type === "ERA_SCORED" ||
      event.type === "RAIL_STARTED" ||
      event.type === "GAME_ENDED",
  );
  return (
    state.round === finalRound &&
    state.cards.draw.length === 0 &&
    state.turnOrder.every((seat) => state.cards.hands[seat].length === 0) &&
    state.cards.wildSupplies.location === WILD_CARD_SUPPLY.location &&
    state.cards.wildSupplies.industry === WILD_CARD_SUPPLY.industry &&
    settlement?.type === "ROUND_SETTLED" &&
    isRecord(settlement.data) &&
    settlement.data.settlementComplete === true &&
    settlement.data.eraComplete === true &&
    settlement.data.era === state.era &&
    settlement.data.completedRound === state.round
  );
}

function disabledActions(
  disabledReason: GameV2LegalityDisabledReason,
): GameV2PlayerActionAvailability[] {
  return PLAYER_ACTION_KINDS.map((kind) => ({
    kind,
    availability: "disabled",
    reason: disabledReason,
  }));
}

function disabledMerchant(
  disabledReason: GameV2LegalityDisabledReason,
): GameV2MerchantFreeDevelopOptions {
  return {
    availability: "disabled",
    seat: null,
    bonusCount: 0,
    eligibleTopTileIds: [],
    legalTileIdSelections: [],
    reason: disabledReason,
  };
}

function disabledNetwork(
  disabledReason: GameV2LegalityDisabledReason,
): GameV2NetworkOptions {
  return {
    availability: "disabled",
    selectableCardIds: [],
    canalLinks: [],
    reason: disabledReason,
  };
}

function canalNetworkOptions(
  state: GameStateV2,
  hand: readonly PlayableCardId[],
  playerBaseReason: GameV2LegalityDisabledReason | null,
): GameV2NetworkOptions {
  if (playerBaseReason !== null) return disabledNetwork(playerBaseReason);
  if (state.era === "rail") {
    return {
      availability: "attemptable",
      selectableCardIds: [...hand],
      canalLinks: [],
      reason: reason(
        "RAIL_NETWORK_OPTIONS_NOT_ENUMERATED",
        "Rail Network targets still require coal, beer, and optional two-link enumeration.",
      ),
    };
  }

  const player = state.players[state.currentSeat];
  if (player.linkTokensRemaining < 1) {
    return disabledNetwork(reason(
      "NO_LINK_TOKENS",
      "The active player has no link tokens remaining.",
    ));
  }
  if (player.money < 3) {
    return disabledNetwork(reason(
      "INSUFFICIENT_NETWORK_MONEY",
      "A Canal Network action costs £3.",
    ));
  }

  const cardId = hand[0];
  const canalLinks: GameV2CanalNetworkOption[] = [];
  for (const link of BOARD_V2.links) {
    if (!(link.eras as readonly string[]).includes("canal")) continue;
    const selection: NetworkActionSelection = {
      linkIds: [link.id],
      coalSources: [],
      beerSourceId: null,
      cardId,
    };
    const planned = executeNetworkForGameV2(state, selection);
    if (!planned.ok) continue;
    canalLinks.push({
      linkId: link.id,
      adjacentLocations: link.adjacentLocations.map((id) => ({
        id,
        label: BOARD_V2.locations[id as keyof typeof BOARD_V2.locations].label,
      })),
      linkCost: 3,
      totalCost: 3,
      selection: {
        linkIds: [link.id],
        coalSources: [],
        beerSourceId: null,
      },
    });
  }
  if (canalLinks.length === 0) {
    return disabledNetwork(reason(
      "NO_REACHABLE_CANAL_LINK",
      "No unbuilt Canal link is connected to the active player's network.",
    ));
  }
  return {
    availability: "exact",
    selectableCardIds: [...hand],
    canalLinks,
    reason: null,
  };
}

/**
 * Selects the currently usable command kinds and exact simple-action inputs.
 * Complex board targets remain explicitly `attemptable` until their dedicated
 * legal-target selectors are implemented. Canal Network is the first exact
 * board-target slice and is planned through the authoritative action adapter.
 */
export function getGameV2LegalOptions(
  state: GameStateV2,
  requestedActorSeat?: string | null,
): GameV2LegalOptions {
  const validation = validateGameStateV2(state);
  const actorSeat = requestedActorSeat === undefined
    ? validation.ok ? defaultActor(state) : null
    : requestedActorSeat;
  if (!validation.ok) {
    const first = validation.errors[0];
    const invalid = reason(
      "INVALID_GAME_STATE",
      `${first.path}: ${first.message}`,
    );
    return {
      phase: "invalid",
      actorSeat,
      legalCommandKinds: [],
      playerActions: disabledActions(invalid),
      passCardIds: [],
      loanCardIds: [],
      scout: {
        selectableRegularCardIds: [],
        cardTriples: [],
        reason: invalid,
      },
      network: disabledNetwork(invalid),
      merchantFreeDevelop: disabledMerchant(invalid),
      system: { kind: null, availability: "disabled", reason: invalid },
    };
  }

  const commonReason = commonPlayerReason(state, actorSeat);
  const hand = commonReason === null && actorSeat !== null
    ? [...state.cards.hands[actorSeat]]
    : [];
  const noCardReason = hand.length === 0
    ? reason("NO_ACTION_CARD", "The active player has no action card.")
    : null;
  const playerBaseReason = commonReason ?? noCardReason;

  const passReason = playerBaseReason;
  const passCardIds = passReason === null ? [...hand] : [];

  const player = actorSeat === null ? undefined : state.players[actorSeat];
  const loanFloorReason = player !== undefined && !canTakeLoan(
      player.incomeMarkerSpace,
    )
    ? reason(
      "LOAN_INCOME_FLOOR",
      "A loan would lower income below the permitted minimum.",
    )
    : null;
  const loanReason = playerBaseReason ?? loanFloorReason;
  const loanCardIds = loanReason === null ? [...hand] : [];

  const regularCardIds = hand.filter((cardId) => !isWild(cardId));
  const scoutSpecificReason = hand.some(isWild)
    ? reason("WILD_CARD_IN_HAND", "Scout is unavailable while holding a Wild card.")
    : state.cards.wildSupplies.location < 1 ||
        state.cards.wildSupplies.industry < 1
      ? reason(
        "WILD_SUPPLY_EMPTY",
        "Scout requires both Wild card supplies.",
      )
      : regularCardIds.length < 3
        ? reason(
          "INSUFFICIENT_SCOUT_CARDS",
          "Scout requires three distinct regular cards.",
        )
        : null;
  const scoutReason = commonReason ?? scoutSpecificReason;
  const scoutTriples = scoutReason === null ? cardTriples(regularCardIds) : [];
  const network = canalNetworkOptions(state, hand, playerBaseReason);

  const playerActions = PLAYER_ACTION_KINDS.map((kind) => {
    if (kind === "NETWORK") {
      return {
        kind,
        availability: network.availability,
        reason: network.reason,
      };
    }
    const actionReason = kind === "PASS"
      ? passReason
      : kind === "LOAN"
        ? loanReason
        : kind === "SCOUT"
          ? scoutReason
          : playerBaseReason;
    return {
      kind,
      availability: actionReason === null
        ? PARTIALLY_ENUMERATED_ACTIONS.has(kind)
          ? "attemptable" as const
          : "exact" as const
        : "disabled" as const,
      reason: actionReason,
    };
  });

  let merchantFreeDevelop = disabledMerchant(reason(
    "NO_MERCHANT_FREE_DEVELOP_PENDING",
    "No Merchant free Develop is pending.",
  ));
  if (state.progress.phase === "merchant_free_develop") {
    const pending = state.progress.pending;
    if (actorSeat !== pending.seat) {
      merchantFreeDevelop = {
        ...disabledMerchant(reason(
          "NOT_PENDING_ACTOR",
          `Only ${pending.seat} may resolve the Merchant free Develop.`,
        )),
        seat: pending.seat,
        bonusCount: pending.count,
      };
    } else {
      const stacks = state.players[pending.seat].industryInventory.stacks;
      merchantFreeDevelop = {
        availability: "exact",
        seat: pending.seat,
        bonusCount: pending.count,
        eligibleTopTileIds: eligibleTopTiles(stacks),
        legalTileIdSelections: legalFreeDevelopSelections(
          stacks,
          pending.count,
        ),
        reason: null,
      };
    }
  }

  let system: GameV2SystemCommandOptions;
  if (state.progress.phase === "round_settlement") {
    system = actorSeat === null
      ? { kind: "SETTLE_ROUND", availability: "attemptable", reason: null }
      : {
          kind: "SETTLE_ROUND",
          availability: "disabled",
          reason: reason(
            "SYSTEM_ACTOR_NOT_ALLOWED",
            "Round settlement requires a null actor.",
          ),
        };
  } else if (state.progress.phase === "era_transition") {
    system = actorSeat !== null
      ? {
          kind: "RESOLVE_ERA",
          availability: "disabled",
          reason: reason(
            "SYSTEM_ACTOR_NOT_ALLOWED",
            "Era resolution requires a null actor.",
          ),
        }
      : isResolvableEraBoundary(state)
      ? { kind: "RESOLVE_ERA", availability: "exact", reason: null }
      : {
          kind: "RESOLVE_ERA",
          availability: "disabled",
          reason: reason(
            "ERA_BOUNDARY_INCOMPLETE",
            "Era resolution requires the settled final round and exhausted card zones.",
          ),
        };
  } else {
    system = {
      kind: null,
      availability: "disabled",
      reason: state.progress.phase === "ended"
        ? reason("GAME_ALREADY_ENDED", "The game has ended.")
        : reason(
          "NO_SYSTEM_COMMAND_REQUIRED",
          "No system boundary command is currently required.",
        ),
    };
  }

  const legalCommandKinds: GameV2LegalCommandKind[] = playerActions
    .filter((action) => action.availability !== "disabled")
    .map((action) => action.kind);
  if (merchantFreeDevelop.availability === "exact") {
    legalCommandKinds.push("RESOLVE_MERCHANT_FREE_DEVELOP");
  }
  if (system.kind !== null && system.availability !== "disabled") {
    legalCommandKinds.push(system.kind);
  }

  return {
    phase: state.progress.phase,
    actorSeat,
    legalCommandKinds,
    playerActions,
    passCardIds,
    loanCardIds,
    scout: {
      selectableRegularCardIds: regularCardIds,
      cardTriples: scoutTriples,
      reason: scoutReason,
    },
    network,
    merchantFreeDevelop,
    system,
  };
}

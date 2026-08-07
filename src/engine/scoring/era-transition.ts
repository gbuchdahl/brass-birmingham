import { BOARD_V2 } from "../rules/generated/board-v2";
import { INCOME_TRACK_DATA } from "../rules/generated/income-track";
import {
  INDUSTRY_TILE_FACE_BY_ID,
  type IndustryTileFaceId,
} from "../rules/generated/industry-tiles-v2";

export type Era = "canal" | "rail";
export type BoardLocationId = keyof typeof BOARD_V2.locations;
export type BoardLinkId = (typeof BOARD_V2.links)[number]["id"];

export type EraIndustryPlacement = {
  readonly id: string;
  readonly ownerId: string;
  readonly locationId: BoardLocationId;
  readonly faceId: IndustryTileFaceId;
  readonly flipped: boolean;
};

export type EraLinkPlacement = {
  readonly linkId: BoardLinkId;
  readonly ownerId: string;
  readonly era: Era;
};

/** Minimal Merchant state needed to replenish its beer between eras. */
export type EraMerchantSpace = {
  readonly merchantSpaceId: string;
  readonly active: boolean;
  readonly demandIndustries: readonly string[];
  readonly beer: 0 | 1;
};

export type CopiedEraMerchantSpace<T extends EraMerchantSpace> = Omit<
  T,
  "demandIndustries" | "beer"
> & {
  demandIndustries: string[];
  beer: 0 | 1;
};

export type LinkLocationScore = {
  locationId: BoardLocationId;
  permanentIcons: number;
  industryIcons: number;
  totalIcons: number;
};

export type BuiltLinkScore = {
  linkId: BoardLinkId;
  ownerId: string;
  points: number;
  locations: LinkLocationScore[];
};

export type LinkScoringResult = {
  totalByOwner: Record<string, number>;
  links: BuiltLinkScore[];
};

export type BuiltIndustryScore = {
  industryId: string;
  ownerId: string;
  faceId: IndustryTileFaceId;
  flipped: boolean;
  points: number;
};

export type IndustryScoringResult = {
  totalByOwner: Record<string, number>;
  industries: BuiltIndustryScore[];
};

export type EraAssetScoringResult = {
  totalByOwner: Record<string, number>;
  linkPointsByOwner: Record<string, number>;
  industryPointsByOwner: Record<string, number>;
  links: BuiltLinkScore[];
  industries: BuiltIndustryScore[];
};

export type EraEndInput<
  TMerchant extends EraMerchantSpace = EraMerchantSpace,
> = {
  readonly completedEra: Era;
  readonly links: readonly EraLinkPlacement[];
  readonly industries: readonly EraIndustryPlacement[];
  readonly merchantSpaces: readonly TMerchant[];
};

export type EraEndResolution<
  TMerchant extends EraMerchantSpace = EraMerchantSpace,
> = {
  completedEra: Era;
  nextEra: "rail" | null;
  gameEnded: boolean;
  scoring: EraAssetScoringResult;
  links: EraLinkPlacement[];
  industries: EraIndustryPlacement[];
  merchantSpaces: CopiedEraMerchantSpace<TMerchant>[];
  removedLinkIds: BoardLinkId[];
  removedIndustryIds: string[];
};

export type PlayerStandingInput = {
  readonly playerId: string;
  readonly victoryPoints: number;
  readonly incomeLevel: number;
  readonly cash: number;
};

export type PlayerStanding = PlayerStandingInput & {
  rank: number;
  tied: boolean;
};

function requireNonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonempty string`);
  }
  return value;
}

function requireSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  return value as number;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  const integer = requireSafeInteger(value, label);
  if (integer < 0) {
    throw new RangeError(`${label} must not be negative`);
  }
  return integer;
}

function requireEra(value: unknown): Era {
  if (value !== "canal" && value !== "rail") {
    throw new TypeError(`Unknown era: ${String(value)}`);
  }
  return value;
}

function requireLocationId(value: unknown): BoardLocationId {
  if (
    typeof value !== "string" ||
    !Object.hasOwn(BOARD_V2.locations, value)
  ) {
    throw new Error(`Unknown board location: ${String(value)}`);
  }
  return value as BoardLocationId;
}

function requireFaceId(value: unknown): IndustryTileFaceId {
  if (
    typeof value !== "string" ||
    !Object.hasOwn(INDUSTRY_TILE_FACE_BY_ID, value)
  ) {
    throw new Error(`Unknown industry face: ${String(value)}`);
  }
  return value as IndustryTileFaceId;
}

function requireLinkId(value: unknown): BoardLinkId {
  if (
    typeof value !== "string" ||
    !BOARD_V2.links.some((link) => link.id === value)
  ) {
    throw new Error(`Unknown board link: ${String(value)}`);
  }
  return value as BoardLinkId;
}

function linkRule(linkId: BoardLinkId): (typeof BOARD_V2.links)[number] {
  const rule = BOARD_V2.links.find((link) => link.id === linkId);
  if (!rule) throw new Error(`Generated board is missing link ${linkId}`);
  return rule;
}

function validateIndustries(
  industries: readonly EraIndustryPlacement[],
): EraIndustryPlacement[] {
  if (!Array.isArray(industries)) {
    throw new TypeError("Industries must be an array");
  }

  const ids = new Set<string>();
  return industries.map((industry, index) => {
    if (typeof industry !== "object" || industry === null) {
      throw new TypeError(`industries[${index}] must be an object`);
    }
    const id = requireNonemptyString(industry.id, `industries[${index}].id`);
    if (ids.has(id)) throw new Error(`Duplicate industry id: ${id}`);
    ids.add(id);
    const ownerId = requireNonemptyString(
      industry.ownerId,
      `industries[${index}].ownerId`,
    );
    const locationId = requireLocationId(industry.locationId);
    if (BOARD_V2.locations[locationId].kind === "merchant") {
      throw new Error(`Industries cannot occupy Merchant location ${locationId}`);
    }
    const faceId = requireFaceId(industry.faceId);
    if (typeof industry.flipped !== "boolean") {
      throw new TypeError(`industries[${index}].flipped must be boolean`);
    }
    return { id, ownerId, locationId, faceId, flipped: industry.flipped };
  });
}

function validateLinks(links: readonly EraLinkPlacement[]): EraLinkPlacement[] {
  if (!Array.isArray(links)) throw new TypeError("Links must be an array");

  const linkIds = new Set<BoardLinkId>();
  return links.map((link, index) => {
    if (typeof link !== "object" || link === null) {
      throw new TypeError(`links[${index}] must be an object`);
    }
    const linkId = requireLinkId(link.linkId);
    if (linkIds.has(linkId)) throw new Error(`Duplicate built link: ${linkId}`);
    linkIds.add(linkId);
    const ownerId = requireNonemptyString(
      link.ownerId,
      `links[${index}].ownerId`,
    );
    const era = requireEra(link.era);
    if (!(linkRule(linkId).eras as readonly Era[]).includes(era)) {
      throw new Error(`${linkId} cannot contain a ${era} link`);
    }
    return { linkId, ownerId, era };
  });
}

function addPoints(
  totals: Map<string, number>,
  ownerId: string,
  points: number,
): void {
  totals.set(ownerId, (totals.get(ownerId) ?? 0) + points);
}

function totalsRecord(totals: Map<string, number>): Record<string, number> {
  return Object.fromEntries(totals);
}

/** Scores every built link from permanent and built-industry icons at all ends. */
export function scoreBuiltLinks(
  links: readonly EraLinkPlacement[],
  industries: readonly EraIndustryPlacement[],
): LinkScoringResult {
  const validLinks = validateLinks(links);
  const validIndustries = validateIndustries(industries);
  const iconsByLocation = new Map<BoardLocationId, number>();
  for (const industry of validIndustries) {
    const face = INDUSTRY_TILE_FACE_BY_ID[industry.faceId];
    iconsByLocation.set(
      industry.locationId,
      (iconsByLocation.get(industry.locationId) ?? 0) + face.linkIcons,
    );
  }

  const totals = new Map<string, number>();
  const scoredLinks = validLinks.map((link): BuiltLinkScore => {
    const rule = linkRule(link.linkId);
    const locations = rule.adjacentLocations.map((rawLocationId) => {
      const locationId = requireLocationId(rawLocationId);
      const permanentIcons = BOARD_V2.locations[locationId].baseLinkIcons;
      const industryIcons = iconsByLocation.get(locationId) ?? 0;
      return {
        locationId,
        permanentIcons,
        industryIcons,
        totalIcons: permanentIcons + industryIcons,
      };
    });
    const points = locations.reduce(
      (total, location) => total + location.totalIcons,
      0,
    );
    addPoints(totals, link.ownerId, points);
    return { linkId: link.linkId, ownerId: link.ownerId, points, locations };
  });

  return { totalByOwner: totalsRecord(totals), links: scoredLinks };
}

/** Scores a built Industry only when its tile is flipped. */
export function scoreBuiltIndustries(
  industries: readonly EraIndustryPlacement[],
): IndustryScoringResult {
  const validIndustries = validateIndustries(industries);
  const totals = new Map<string, number>();
  const scoredIndustries = validIndustries.map(
    (industry): BuiltIndustryScore => {
      const points = industry.flipped
        ? INDUSTRY_TILE_FACE_BY_ID[industry.faceId].victoryPoints
        : 0;
      addPoints(totals, industry.ownerId, points);
      return {
        industryId: industry.id,
        ownerId: industry.ownerId,
        faceId: industry.faceId,
        flipped: industry.flipped,
        points,
      };
    },
  );
  return {
    totalByOwner: totalsRecord(totals),
    industries: scoredIndustries,
  };
}

/** Combines the two independent era-scoring passes without mutating assets. */
export function scoreEraAssets(
  links: readonly EraLinkPlacement[],
  industries: readonly EraIndustryPlacement[],
): EraAssetScoringResult {
  const linkScoring = scoreBuiltLinks(links, industries);
  const industryScoring = scoreBuiltIndustries(industries);
  const totals = new Map<string, number>();

  for (const [ownerId, points] of Object.entries(linkScoring.totalByOwner)) {
    addPoints(totals, ownerId, points);
  }
  for (const [ownerId, points] of Object.entries(industryScoring.totalByOwner)) {
    addPoints(totals, ownerId, points);
  }

  return {
    totalByOwner: totalsRecord(totals),
    linkPointsByOwner: linkScoring.totalByOwner,
    industryPointsByOwner: industryScoring.totalByOwner,
    links: linkScoring.links,
    industries: industryScoring.industries,
  };
}

function copyMerchantSpaces<T extends EraMerchantSpace>(
  spaces: readonly T[],
  replenish: boolean,
): CopiedEraMerchantSpace<T>[] {
  if (!Array.isArray(spaces)) {
    throw new TypeError("Merchant spaces must be an array");
  }
  const ids = new Set<string>();

  return spaces.map((space, index) => {
    if (typeof space !== "object" || space === null) {
      throw new TypeError(`merchantSpaces[${index}] must be an object`);
    }
    const merchantSpaceId = requireNonemptyString(
      space.merchantSpaceId,
      `merchantSpaces[${index}].merchantSpaceId`,
    );
    if (ids.has(merchantSpaceId)) {
      throw new Error(`Duplicate Merchant space id: ${merchantSpaceId}`);
    }
    ids.add(merchantSpaceId);
    if (typeof space.active !== "boolean") {
      throw new TypeError(`merchantSpaces[${index}].active must be boolean`);
    }
    if (!Array.isArray(space.demandIndustries)) {
      throw new TypeError(
        `merchantSpaces[${index}].demandIndustries must be an array`,
      );
    }
    const demandIndustries = space.demandIndustries.map(
      (industry: string, demandIndex: number) =>
        requireNonemptyString(
          industry,
          `merchantSpaces[${index}].demandIndustries[${demandIndex}]`,
        ),
    );
    if (new Set(demandIndustries).size !== demandIndustries.length) {
      throw new Error(`Merchant space ${merchantSpaceId} has duplicate demands`);
    }
    if (space.beer !== 0 && space.beer !== 1) {
      throw new RangeError(`merchantSpaces[${index}].beer must be 0 or 1`);
    }

    return {
      ...space,
      merchantSpaceId,
      demandIndustries,
      beer: replenish
        ? space.active && demandIndustries.length > 0
          ? 1
          : 0
        : space.beer,
    } as CopiedEraMerchantSpace<T>;
  });
}

/** Replenishes exactly the active, demand-bearing Merchant spaces for Rail. */
export function replenishMerchantBeer<T extends EraMerchantSpace>(
  spaces: readonly T[],
): CopiedEraMerchantSpace<T>[] {
  return copyMerchantSpaces(spaces, true);
}

/**
 * Scores the completed era before cleanup. Canal links and every level-1
 * Industry are then removed and Merchant beer is replenished. At game end,
 * Rail assets and the current Merchant state remain represented unchanged.
 */
export function resolveEraEnd<TMerchant extends EraMerchantSpace>(
  input: EraEndInput<TMerchant>,
): EraEndResolution<TMerchant> {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Era-end input must be an object");
  }
  const completedEra = requireEra(input.completedEra);
  const links = validateLinks(input.links);
  const wrongEraLink = links.find((link) => link.era !== completedEra);
  if (wrongEraLink) {
    throw new Error(
      `${wrongEraLink.linkId} contains a ${wrongEraLink.era} link during ${completedEra} scoring`,
    );
  }
  const industries = validateIndustries(input.industries);
  const scoring = scoreEraAssets(links, industries);

  if (completedEra === "rail") {
    return {
      completedEra,
      nextEra: null,
      gameEnded: true,
      scoring,
      links: links.map((link) => ({ ...link })),
      industries: industries.map((industry) => ({ ...industry })),
      merchantSpaces: copyMerchantSpaces(input.merchantSpaces, false),
      removedLinkIds: [],
      removedIndustryIds: [],
    };
  }

  const removedLinkIds = links
    .filter((link) => link.era === "canal")
    .map((link) => link.linkId);
  const removedIndustryIds = industries
    .filter(
      (industry) => INDUSTRY_TILE_FACE_BY_ID[industry.faceId].level === 1,
    )
    .map((industry) => industry.id);

  return {
    completedEra,
    nextEra: "rail",
    gameEnded: false,
    scoring,
    links: links.filter((link) => link.era !== "canal"),
    industries: industries.filter(
      (industry) => INDUSTRY_TILE_FACE_BY_ID[industry.faceId].level !== 1,
    ),
    merchantSpaces: replenishMerchantBeer(input.merchantSpaces),
    removedLinkIds,
    removedIndustryIds,
  };
}

function compareStandingCriteria(
  left: PlayerStandingInput,
  right: PlayerStandingInput,
): number {
  return (
    right.victoryPoints - left.victoryPoints ||
    right.incomeLevel - left.incomeLevel ||
    right.cash - left.cash
  );
}

/**
 * Applies the complete rules tie-break chain. Fully tied players retain their
 * input order, share a competition rank, and are explicitly marked as tied.
 */
export function rankFinalStandings(
  players: readonly PlayerStandingInput[],
): PlayerStanding[] {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
    throw new RangeError("Final standings require 2–4 players");
  }
  const playerIds = new Set<string>();
  const validated = players.map((player, originalIndex) => {
    if (typeof player !== "object" || player === null) {
      throw new TypeError(`players[${originalIndex}] must be an object`);
    }
    const playerId = requireNonemptyString(
      player.playerId,
      `players[${originalIndex}].playerId`,
    );
    if (playerIds.has(playerId)) throw new Error(`Duplicate player: ${playerId}`);
    playerIds.add(playerId);
    const victoryPoints = requireNonNegativeInteger(
      player.victoryPoints,
      `players[${originalIndex}].victoryPoints`,
    );
    const incomeLevel = requireSafeInteger(
      player.incomeLevel,
      `players[${originalIndex}].incomeLevel`,
    );
    if (
      incomeLevel < INCOME_TRACK_DATA.track.minimumIncomeLevel ||
      incomeLevel > INCOME_TRACK_DATA.track.maximumIncomeLevel
    ) {
      throw new RangeError(
        `players[${originalIndex}].incomeLevel is outside the income track`,
      );
    }
    const cash = requireNonNegativeInteger(
      player.cash,
      `players[${originalIndex}].cash`,
    );
    return { playerId, victoryPoints, incomeLevel, cash, originalIndex };
  });

  const ordered = [...validated].sort(
    (left, right) =>
      compareStandingCriteria(left, right) ||
      left.originalIndex - right.originalIndex,
  );

  let currentRank = 1;
  return ordered.map((player, index) => {
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    if (
      previous !== undefined &&
      compareStandingCriteria(previous, player) !== 0
    ) {
      currentRank = index + 1;
    }
    const tied =
      (previous !== undefined && compareStandingCriteria(previous, player) === 0) ||
      (next !== undefined && compareStandingCriteria(player, next) === 0);

    return {
      playerId: player.playerId,
      victoryPoints: player.victoryPoints,
      incomeLevel: player.incomeLevel,
      cash: player.cash,
      rank: currentRank,
      tied,
    };
  });
}

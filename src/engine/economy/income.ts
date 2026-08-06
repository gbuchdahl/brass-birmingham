import { INCOME_TRACK_DATA } from "../rules/generated/income-track";

type IncomeTrackSpace = {
  readonly space: number;
  readonly incomeLevel: number;
};

type IncomeTrackBand = {
  readonly incomeLevel: number;
  readonly firstSpace: number;
  readonly lastSpace: number;
};

export type LiquidatableIndustry = {
  readonly id: string;
  readonly buildCost: number;
};

export type RoundIncomeSettlementInput = {
  readonly markerSpace: number;
  readonly money: number;
  readonly victoryPoints: number;
  readonly finalRoundOfGame: boolean;
  readonly liquidatableIndustries?: readonly LiquidatableIndustry[];
  readonly industriesToRemove?: readonly string[];
};

export type RoundIncomeSettlement = {
  readonly incomeLevel: number;
  readonly skipped: boolean;
  readonly money: number;
  readonly moneyChange: number;
  readonly victoryPoints: number;
  readonly victoryPointsLost: number;
  readonly requiredPayment: number;
  readonly liquidationProceeds: number;
  readonly removedIndustryIds: readonly string[];
  readonly unpaidShortfall: number;
};

const SPACES: readonly IncomeTrackSpace[] = INCOME_TRACK_DATA.track.spaces;
const BANDS: readonly IncomeTrackBand[] = INCOME_TRACK_DATA.track.bands;
const FIRST_SPACE = INCOME_TRACK_DATA.track.firstSpace;
const LAST_SPACE = INCOME_TRACK_DATA.track.lastSpace;

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
  return value;
}

function requireMarkerSpace(markerSpace: number): number {
  if (
    !Number.isInteger(markerSpace) ||
    markerSpace < FIRST_SPACE ||
    markerSpace > LAST_SPACE
  ) {
    throw new RangeError(
      `markerSpace must be an integer from ${FIRST_SPACE} through ${LAST_SPACE}.`,
    );
  }
  return markerSpace;
}

function requireUnusedRemovalChoices(ids: readonly string[]): void {
  if (ids.length > 0) {
    throw new Error("Industry removal choices are not used for this income settlement.");
  }
}

export function incomeLevelAt(markerSpace: number): number {
  const validSpace = requireMarkerSpace(markerSpace);
  const entry = SPACES[validSpace - FIRST_SPACE];
  if (!entry || entry.space !== validSpace) {
    throw new Error(`Income track data is missing space ${validSpace}.`);
  }
  return entry.incomeLevel;
}

export function highestSpaceForIncomeLevel(incomeLevel: number): number {
  if (!Number.isInteger(incomeLevel)) {
    throw new RangeError("incomeLevel must be an integer.");
  }
  const band = BANDS.find((candidate) => candidate.incomeLevel === incomeLevel);
  if (!band) {
    throw new RangeError(
      `incomeLevel must be from ${INCOME_TRACK_DATA.track.minimumIncomeLevel} through ${INCOME_TRACK_DATA.track.maximumIncomeLevel}.`,
    );
  }
  return band.lastSpace;
}

export function advanceIncomeSpaces(
  markerSpace: number,
  spacesToAdvance: number,
): number {
  const validSpace = requireMarkerSpace(markerSpace);
  requireNonNegativeInteger(spacesToAdvance, "spacesToAdvance");
  return Math.min(LAST_SPACE, validSpace + spacesToAdvance);
}

export function canTakeLoan(markerSpace: number): boolean {
  const currentIncomeLevel = incomeLevelAt(markerSpace);
  return (
    currentIncomeLevel - INCOME_TRACK_DATA.rules.loan.incomeLevelsBack >=
    INCOME_TRACK_DATA.rules.loan.minimumTargetIncomeLevel
  );
}

export function applyLoanToIncome(markerSpace: number): {
  readonly markerSpace: number;
  readonly incomeLevel: number;
  readonly moneyReceived: number;
} {
  const currentIncomeLevel = incomeLevelAt(markerSpace);
  const targetIncomeLevel =
    currentIncomeLevel - INCOME_TRACK_DATA.rules.loan.incomeLevelsBack;
  if (targetIncomeLevel < INCOME_TRACK_DATA.rules.loan.minimumTargetIncomeLevel) {
    throw new Error("A loan cannot lower income below level -10.");
  }
  return {
    markerSpace: highestSpaceForIncomeLevel(targetIncomeLevel),
    incomeLevel: targetIncomeLevel,
    moneyReceived: INCOME_TRACK_DATA.rules.loan.moneyReceived,
  };
}

export function liquidationValue(buildCost: number): number {
  requireNonNegativeInteger(buildCost, "buildCost");
  return Math.floor(buildCost / 2);
}

export function settleRoundIncome(
  input: RoundIncomeSettlementInput,
): RoundIncomeSettlement {
  const incomeLevel = incomeLevelAt(input.markerSpace);
  const startingMoney = requireNonNegativeInteger(input.money, "money");
  const startingVictoryPoints = requireNonNegativeInteger(
    input.victoryPoints,
    "victoryPoints",
  );
  const industries = input.liquidatableIndustries ?? [];
  const requestedRemovalIds = input.industriesToRemove ?? [];
  const industryById = new Map<string, LiquidatableIndustry>();

  for (const [index, industry] of industries.entries()) {
    if (!industry || typeof industry.id !== "string" || industry.id.length === 0) {
      throw new Error(`liquidatableIndustries[${index}].id must be a non-empty string.`);
    }
    if (industryById.has(industry.id)) {
      throw new Error(`Duplicate liquidatable industry id: ${industry.id}.`);
    }
    liquidationValue(industry.buildCost);
    industryById.set(industry.id, industry);
  }

  if (new Set(requestedRemovalIds).size !== requestedRemovalIds.length) {
    throw new Error("industriesToRemove must not contain duplicate ids.");
  }

  const unchanged = (skipped: boolean): RoundIncomeSettlement => ({
    incomeLevel,
    skipped,
    money: startingMoney,
    moneyChange: 0,
    victoryPoints: startingVictoryPoints,
    victoryPointsLost: 0,
    requiredPayment: 0,
    liquidationProceeds: 0,
    removedIndustryIds: [],
    unpaidShortfall: 0,
  });

  if (input.finalRoundOfGame) {
    requireUnusedRemovalChoices(requestedRemovalIds);
    return unchanged(true);
  }
  if (incomeLevel === 0) {
    requireUnusedRemovalChoices(requestedRemovalIds);
    return unchanged(false);
  }
  if (incomeLevel > 0) {
    requireUnusedRemovalChoices(requestedRemovalIds);
    return {
      ...unchanged(false),
      money: startingMoney + incomeLevel,
      moneyChange: incomeLevel,
    };
  }

  const requiredPayment = -incomeLevel;
  if (startingMoney >= requiredPayment) {
    requireUnusedRemovalChoices(requestedRemovalIds);
    return {
      ...unchanged(false),
      money: startingMoney - requiredPayment,
      moneyChange: -requiredPayment,
      requiredPayment,
    };
  }

  const initialShortfall = requiredPayment - startingMoney;
  let liquidationProceeds = 0;
  const removedIndustryIds: string[] = [];
  for (const industryId of requestedRemovalIds) {
    if (liquidationProceeds >= initialShortfall) {
      throw new Error("Industry removal must stop as soon as the shortfall is covered.");
    }
    const industry = industryById.get(industryId);
    if (!industry) {
      throw new Error(`Unknown liquidatable industry id: ${industryId}.`);
    }
    const value = liquidationValue(industry.buildCost);
    if (value === 0) {
      throw new Error(`Industry ${industryId} has no liquidation value.`);
    }
    liquidationProceeds += value;
    removedIndustryIds.push(industryId);
  }

  if (liquidationProceeds < initialShortfall) {
    const remainingUsefulIndustry = industries.find(
      (industry) =>
        !removedIndustryIds.includes(industry.id) &&
        liquidationValue(industry.buildCost) > 0,
    );
    if (remainingUsefulIndustry) {
      throw new Error(
        `Income shortfall remains while industry ${remainingUsefulIndustry.id} can still be removed.`,
      );
    }
  }

  const moneyAfterPayment = Math.max(
    0,
    startingMoney + liquidationProceeds - requiredPayment,
  );
  const remainingShortfall = Math.max(
    0,
    requiredPayment - startingMoney - liquidationProceeds,
  );
  const victoryPointsLost = Math.min(startingVictoryPoints, remainingShortfall);

  return {
    incomeLevel,
    skipped: false,
    money: moneyAfterPayment,
    moneyChange: moneyAfterPayment - startingMoney,
    victoryPoints: startingVictoryPoints - victoryPointsLost,
    victoryPointsLost,
    requiredPayment,
    liquidationProceeds,
    removedIndustryIds,
    unpaidShortfall: remainingShortfall - victoryPointsLost,
  };
}

import { describe, expect, it } from "vitest";
import {
  advanceIncomeSpaces,
  applyLoanToIncome,
  canTakeLoan,
  highestSpaceForIncomeLevel,
  incomeLevelAt,
  liquidationValue,
  settleRoundIncome,
} from "@/engine/economy/income";
import { INCOME_TRACK_DATA } from "@/engine/rules/generated/income-track";

const expectedBands = [
  ...Array.from({ length: 11 }, (_, index) => ({
    incomeLevel: index - 10,
    width: 1,
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    incomeLevel: index + 1,
    width: 2,
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    incomeLevel: index + 11,
    width: 3,
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    incomeLevel: index + 21,
    width: 4,
  })),
];

describe("authoritative printed income track", () => {
  it("records claim-level provenance with high confidence", () => {
    expect(INCOME_TRACK_DATA.provenance.confidence).toBe("high");
    expect(INCOME_TRACK_DATA.provenance.sources.map((source) => source.id)).toEqual([
      "official-rulebook",
      "board-reference",
      "rulespal-rulebook",
    ]);
    for (const source of INCOME_TRACK_DATA.provenance.sources) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.claims.length).toBeGreaterThan(0);
    }
  });

  it("maps every one of the 101 printed spaces in order", () => {
    expect(INCOME_TRACK_DATA.track.spaces).toHaveLength(101);
    expect(INCOME_TRACK_DATA.track.spaces.map((entry) => entry.space)).toEqual(
      Array.from({ length: 101 }, (_, space) => space),
    );
    expect(INCOME_TRACK_DATA.track.spaces.map((entry) => entry.incomeLevel)).toEqual(
      expectedBands.flatMap(({ incomeLevel, width }) =>
        Array.from({ length: width }, () => incomeLevel),
      ),
    );
  });

  it("keeps progress spaces distinct from payout levels", () => {
    expect(INCOME_TRACK_DATA.track.startingSpace).toBe(10);
    expect(incomeLevelAt(10)).toBe(0);
    expect(incomeLevelAt(25)).toBe(8);
    expect(incomeLevelAt(26)).toBe(8);
    expect(incomeLevelAt(31)).toBe(11);
    expect(incomeLevelAt(33)).toBe(11);
    expect(incomeLevelAt(97)).toBe(30);
    expect(incomeLevelAt(100)).toBe(30);
  });

  it.each(expectedBands)(
    "gives income level $incomeLevel exactly $width printed space(s)",
    ({ incomeLevel, width }) => {
      const entries = INCOME_TRACK_DATA.track.spaces.filter(
        (entry) => entry.incomeLevel === incomeLevel,
      );
      expect(entries).toHaveLength(width);
      expect(highestSpaceForIncomeLevel(incomeLevel)).toBe(entries.at(-1)?.space);
    },
  );

  it("rejects invalid spaces and levels", () => {
    expect(() => incomeLevelAt(-1)).toThrow(RangeError);
    expect(() => incomeLevelAt(101)).toThrow(RangeError);
    expect(() => incomeLevelAt(1.5)).toThrow(RangeError);
    expect(() => highestSpaceForIncomeLevel(-11)).toThrow(RangeError);
    expect(() => highestSpaceForIncomeLevel(31)).toThrow(RangeError);
  });
});

describe("income movement", () => {
  it("advances by spaces and clamps at the end of income level 30", () => {
    expect(advanceIncomeSpaces(10, 5)).toBe(15);
    expect(incomeLevelAt(advanceIncomeSpaces(10, 5))).toBe(3);
    expect(advanceIncomeSpaces(96, 2)).toBe(98);
    expect(advanceIncomeSpaces(99, 20)).toBe(100);
    expect(advanceIncomeSpaces(100, 0)).toBe(100);
  });

  it("rejects invalid advance amounts", () => {
    expect(() => advanceIncomeSpaces(10, -1)).toThrow(RangeError);
    expect(() => advanceIncomeSpaces(10, 1.5)).toThrow(RangeError);
  });

  it("moves a loan three levels, not three spaces, to the target band's highest space", () => {
    expect(applyLoanToIncome(10)).toEqual({
      markerSpace: 7,
      incomeLevel: -3,
      moneyReceived: 30,
    });
    expect(applyLoanToIncome(30)).toEqual({
      markerSpace: 24,
      incomeLevel: 7,
      moneyReceived: 30,
    });
    expect(applyLoanToIncome(100)).toEqual({
      markerSpace: 88,
      incomeLevel: 27,
      moneyReceived: 30,
    });
  });

  it("handles the loan floor exhaustively from every printed space", () => {
    for (const entry of INCOME_TRACK_DATA.track.spaces) {
      const legal = entry.incomeLevel >= -7;
      expect(canTakeLoan(entry.space)).toBe(legal);
      if (legal) {
        const result = applyLoanToIncome(entry.space);
        expect(result.incomeLevel).toBe(entry.incomeLevel - 3);
        expect(result.markerSpace).toBe(
          highestSpaceForIncomeLevel(entry.incomeLevel - 3),
        );
      } else {
        expect(() => applyLoanToIncome(entry.space)).toThrow(
          "A loan cannot lower income below level -10.",
        );
      }
    }
  });
});

describe("end-of-round income settlement", () => {
  it("pays positive income and leaves level zero unchanged", () => {
    expect(
      settleRoundIncome({
        markerSpace: 25,
        money: 4,
        victoryPoints: 7,
        finalRoundOfGame: false,
      }),
    ).toMatchObject({
      incomeLevel: 8,
      money: 12,
      moneyChange: 8,
      victoryPoints: 7,
      skipped: false,
    });
    expect(
      settleRoundIncome({
        markerSpace: 10,
        money: 4,
        victoryPoints: 7,
        finalRoundOfGame: false,
      }),
    ).toMatchObject({ incomeLevel: 0, money: 4, moneyChange: 0 });
  });

  it("skips all income, including negative income, after the final game round", () => {
    expect(
      settleRoundIncome({
        markerSpace: 0,
        money: 0,
        victoryPoints: 0,
        finalRoundOfGame: true,
        liquidatableIndustries: [{ id: "coal", buildCost: 5 }],
      }),
    ).toEqual({
      incomeLevel: -10,
      skipped: true,
      money: 0,
      moneyChange: 0,
      victoryPoints: 0,
      victoryPointsLost: 0,
      requiredPayment: 0,
      liquidationProceeds: 0,
      removedIndustryIds: [],
      unpaidShortfall: 0,
    });
  });

  it("pays negative income directly when cash is sufficient", () => {
    expect(
      settleRoundIncome({
        markerSpace: 5,
        money: 8,
        victoryPoints: 6,
        finalRoundOfGame: false,
      }),
    ).toMatchObject({
      incomeLevel: -5,
      money: 3,
      moneyChange: -5,
      requiredPayment: 5,
      liquidationProceeds: 0,
      victoryPointsLost: 0,
    });
  });

  it("liquidates chosen industries at half cost rounded down and keeps excess", () => {
    expect(liquidationValue(5)).toBe(2);
    expect(liquidationValue(8)).toBe(4);
    expect(
      settleRoundIncome({
        markerSpace: 2,
        money: 3,
        victoryPoints: 10,
        finalRoundOfGame: false,
        liquidatableIndustries: [
          { id: "coal", buildCost: 5 },
          { id: "cotton", buildCost: 8 },
        ],
        industriesToRemove: ["coal", "cotton"],
      }),
    ).toEqual({
      incomeLevel: -8,
      skipped: false,
      money: 1,
      moneyChange: -2,
      victoryPoints: 10,
      victoryPointsLost: 0,
      requiredPayment: 8,
      liquidationProceeds: 6,
      removedIndustryIds: ["coal", "cotton"],
      unpaidShortfall: 0,
    });
  });

  it("requires liquidation while any positive-value industry can cover part of a shortfall", () => {
    expect(() =>
      settleRoundIncome({
        markerSpace: 4,
        money: 0,
        victoryPoints: 10,
        finalRoundOfGame: false,
        liquidatableIndustries: [{ id: "iron", buildCost: 7 }],
      }),
    ).toThrow("Income shortfall remains while industry iron can still be removed.");
  });

  it("forbids removing another tile after the shortfall is covered", () => {
    expect(() =>
      settleRoundIncome({
        markerSpace: 6,
        money: 0,
        victoryPoints: 10,
        finalRoundOfGame: false,
        liquidatableIndustries: [
          { id: "pottery", buildCost: 17 },
          { id: "brewery", buildCost: 5 },
        ],
        industriesToRemove: ["pottery", "brewery"],
      }),
    ).toThrow("Industry removal must stop as soon as the shortfall is covered.");
  });

  it("uses VP for an unavoidable remainder and clamps both VP and money at zero", () => {
    expect(
      settleRoundIncome({
        markerSpace: 0,
        money: 1,
        victoryPoints: 3,
        finalRoundOfGame: false,
        liquidatableIndustries: [
          { id: "useful", buildCost: 5 },
          { id: "zero-value", buildCost: 0 },
        ],
        industriesToRemove: ["useful"],
      }),
    ).toEqual({
      incomeLevel: -10,
      skipped: false,
      money: 0,
      moneyChange: -1,
      victoryPoints: 0,
      victoryPointsLost: 3,
      requiredPayment: 10,
      liquidationProceeds: 2,
      removedIndustryIds: ["useful"],
      unpaidShortfall: 4,
    });
  });

  it("does not mutate settlement input", () => {
    const input = {
      markerSpace: 3,
      money: 1,
      victoryPoints: 10,
      finalRoundOfGame: false,
      liquidatableIndustries: [{ id: "manufacturer", buildCost: 12 }],
      industriesToRemove: ["manufacturer"],
    } as const;
    const before = JSON.stringify(input);
    settleRoundIncome(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("strictly validates liquidation data and unused choices", () => {
    expect(() => liquidationValue(-1)).toThrow(RangeError);
    expect(() =>
      settleRoundIncome({
        markerSpace: 10,
        money: 0,
        victoryPoints: 0,
        finalRoundOfGame: false,
        industriesToRemove: ["unused"],
      }),
    ).toThrow("Industry removal choices are not used");
    expect(() =>
      settleRoundIncome({
        markerSpace: 0,
        money: 0,
        victoryPoints: 0,
        finalRoundOfGame: false,
        liquidatableIndustries: [{ id: "x", buildCost: 5 }],
        industriesToRemove: ["missing"],
      }),
    ).toThrow("Unknown liquidatable industry id: missing.");
    expect(() =>
      settleRoundIncome({
        markerSpace: 0,
        money: 0,
        victoryPoints: 0,
        finalRoundOfGame: false,
        liquidatableIndustries: [{ id: "free-pottery", buildCost: 0 }],
        industriesToRemove: ["free-pottery"],
      }),
    ).toThrow("Industry free-pottery has no liquidation value.");
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { createCashShortLiquidationFixture } from "./fixtures/liquidation-session";

const SAVE_KEY = "brass-birmingham:hotseat-session:v1";

function summaryValue(page: Page, label: string): Locator {
  return page.locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

function seatMetric(seatCard: Locator, label: string): Locator {
  return seatCard.locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

async function expectNoPrivateView(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /private hand$/ }))
    .toHaveCount(0);
  await expect(page.getByRole("button", {
    name: /^Use .* as the action card$/,
  })).toHaveCount(0);
}

async function savedProjection(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) throw new Error("Expected a hot-seat save");
    const document = JSON.parse(raw) as {
      readonly head: string;
      readonly acceptedCommands: readonly {
        readonly expectedRevision: number;
        readonly command: {
          readonly type: string;
          readonly liquidationChoices?: Readonly<Record<string, readonly string[]>>;
        };
      }[];
      readonly draft?: unknown;
    };
    const head = JSON.parse(document.head) as {
      readonly revision: number;
      readonly round: number;
      readonly players: Readonly<Record<string, { readonly money: number }>>;
      readonly board: {
        readonly placedIndustries: Readonly<Record<string, unknown>>;
      };
    };
    const lastCommand = document.acceptedCommands.at(-1);
    return {
      hasDraft: Object.hasOwn(document, "draft"),
      revision: head.revision,
      round: head.round,
      player1Money: head.players["Player 1"]?.money,
      placedIndustryIds: Object.keys(head.board.placedIndustries).sort(),
      acceptedCommandCount: document.acceptedCommands.length,
      lastCommand: lastCommand === undefined
        ? null
        : {
            expectedRevision: lastCommand.expectedRevision,
            command: lastCommand.command,
          },
    };
  }, SAVE_KEY);
}

test("progressively liquidates two exact industries and restores the settled handoff", async ({
  page,
}) => {
  const fixture = createCashShortLiquidationFixture();
  await page.addInitScript(({ key, serializedSession }) => {
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, serializedSession);
    }
  }, { key: SAVE_KEY, serializedSession: fixture.serializedSession });

  await page.goto("/dev");
  await expect(
    page.getByText(
      `Restored revision ${fixture.expected.boundaryRevision}. The hand is hidden for privacy.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(summaryValue(page, "Phase")).toHaveText("round_settlement");
  await expect(summaryValue(page, "Round")).toHaveText(
    String(fixture.expected.boundaryRound),
  );
  await expectNoPrivateView(page);

  const settlement = page.getByRole("heading", { name: "Round complete" })
    .locator("xpath=ancestor::section");
  const seatCard = settlement.getByRole("heading", {
    name: fixture.expected.seat,
    exact: true,
  }).locator("xpath=ancestor::article");
  const apply = settlement.getByRole("button", {
    name: "Apply settlement and continue",
  });
  await expect(seatCard).toContainText("Income -3 · owes £3 · cash £0");
  await expect(seatCard.getByText("£3 SHORT", { exact: true })).toBeVisible();
  await expect(seatMetric(seatCard, "Sale proceeds")).toHaveText("£0");
  await expect(seatMetric(seatCard, "Cash after")).toHaveText("£0");
  await expect(seatMetric(seatCard, "VP after")).toHaveText("0");
  await expect(seatMetric(seatCard, "Unpaid")).toHaveText("£3");
  await expect(apply).toBeDisabled();

  await seatCard.getByRole("button", {
    name: fixture.expected.firstLiquidationLabel,
  }).click();
  await expect(seatCard.getByText("£1 SHORT", { exact: true })).toBeVisible();
  await expect(seatCard.getByRole("listitem")).toHaveText([
    "1. Stone · brewery level 1 · £2",
  ]);
  await expect(seatMetric(seatCard, "Sale proceeds")).toHaveText("£2");
  await expect(seatMetric(seatCard, "Cash after")).toHaveText("£0");
  await expect(seatMetric(seatCard, "VP after")).toHaveText("0");
  await expect(seatMetric(seatCard, "Unpaid")).toHaveText("£1");
  await expect(apply).toBeDisabled();
  await expect.poll(() => savedProjection(page)).toMatchObject({
    hasDraft: false,
    revision: fixture.expected.boundaryRevision,
    acceptedCommandCount: fixture.expected.boundaryRevision,
  });

  await seatCard.getByRole("button", {
    name: fixture.expected.secondLiquidationLabel,
  }).click();
  await expect(seatCard.getByText("READY", { exact: true })).toBeVisible();
  await expect(seatCard.getByRole("listitem")).toHaveText([
    "1. Stone · brewery level 1 · £2",
    "2. Worcester · cotton level 1 · £6",
  ]);
  await expect(seatMetric(seatCard, "Sale proceeds")).toHaveText(
    `£${fixture.expected.saleProceeds}`,
  );
  await expect(seatMetric(seatCard, "Cash after")).toHaveText(
    `£${fixture.expected.cashAfter}`,
  );
  await expect(seatMetric(seatCard, "VP after")).toHaveText(
    String(fixture.expected.victoryPointsAfter),
  );
  await expect(seatMetric(seatCard, "Unpaid")).toHaveText(
    `£${fixture.expected.unpaidAfter}`,
  );
  await expect(apply).toBeEnabled();
  expect(await savedProjection(page)).toMatchObject({
    hasDraft: false,
    revision: fixture.expected.boundaryRevision,
    acceptedCommandCount: fixture.expected.boundaryRevision,
  });

  await apply.click();
  await expect(
    page.getByText("Round settled. The next round is ready.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`revision ${fixture.expected.nextRevision}`, { exact: true }),
  ).toBeVisible();
  await expect(summaryValue(page, "Phase")).toHaveText("action");
  await expect(summaryValue(page, "Round")).toHaveText(
    String(fixture.expected.nextRound),
  );
  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 2" }),
  ).toBeVisible();
  await expectNoPrivateView(page);

  const builtIndustries = page.locator('[aria-label="Built industries"]');
  await expect(builtIndustries.locator("article")).toHaveCount(1);
  await expect(builtIndustries).toContainText("Stafford · Pottery level 1");
  await expect(builtIndustries).not.toContainText("Stone · Brewery level 1");
  await expect(builtIndustries).not.toContainText("Worcester · Cotton mill level 1");
  const player1 = page.getByRole("heading", {
    name: "Player 1",
    exact: true,
  }).locator("xpath=ancestor::article");
  await expect(player1).toContainText(`£${fixture.expected.cashAfter}`);

  await expect(
    page.getByText(
      `Saved revision ${fixture.expected.nextRevision} in this browser.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect.poll(() => savedProjection(page)).toEqual({
    hasDraft: false,
    revision: fixture.expected.nextRevision,
    round: fixture.expected.nextRound,
    player1Money: fixture.expected.cashAfter,
    placedIndustryIds: [fixture.expected.survivingBuildSpaceId],
    acceptedCommandCount: fixture.expected.nextRevision,
    lastCommand: {
      expectedRevision: fixture.expected.boundaryRevision,
      command: {
        type: "SETTLE_ROUND",
        liquidationChoices: {
          [fixture.expected.seat]: [
            fixture.expected.firstBuildSpaceId,
            fixture.expected.secondBuildSpaceId,
          ],
        },
      },
    },
  });

  await page.reload();
  await expect(
    page.getByText(
      `Restored revision ${fixture.expected.nextRevision}. The hand is hidden for privacy.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(summaryValue(page, "Round")).toHaveText(
    String(fixture.expected.nextRound),
  );
  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 2" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Round complete" }))
    .toHaveCount(0);
  await expectNoPrivateView(page);
  expect(await savedProjection(page)).toMatchObject({
    hasDraft: false,
    revision: fixture.expected.nextRevision,
    acceptedCommandCount: fixture.expected.nextRevision,
  });
});

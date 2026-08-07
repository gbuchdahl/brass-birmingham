import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PLAYER_COUNTS = [3, 4] as const;

function publicPlayerState(page: Page) {
  return page.getByRole("heading", { name: "Public player state" }).locator("..");
}

function actionCards(page: Page) {
  return page.getByRole("button", {
    name: /^Use .* as the action card$/,
  });
}

async function expectRevision(page: Page, revision: number): Promise<void> {
  await expect(
    page.getByText(`revision ${revision}`, { exact: true }),
  ).toBeVisible();
}

async function expectPublicPlayers(
  page: Page,
  playerCount: 2 | 3 | 4,
): Promise<void> {
  const section = publicPlayerState(page);
  await expect(section.locator('ul[aria-label$=" industry inventory"]'))
    .toHaveCount(playerCount);
  for (let player = 1; player <= playerCount; player += 1) {
    await expect(
      section.getByLabel(`Player ${player} industry inventory`),
    ).toBeVisible();
  }
  await expect(
    section.getByLabel(`Player ${playerCount + 1} industry inventory`),
  ).toHaveCount(0);
}

async function expectPrivateViewUnmounted(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /private hand$/ }))
    .toHaveCount(0);
  await expect(actionCards(page)).toHaveCount(0);
}

async function expectNoSeriousAxeViolations(
  page: Page,
  checkpoint: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations
    .filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical"
    )
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target),
    }));
  expect(
    violations,
    `${checkpoint} must have no serious/critical WCAG A/AA violations`,
  ).toEqual([]);
}

async function resetToPlayerCount(
  page: Page,
  playerCount: 3 | 4,
  seed: string,
): Promise<void> {
  await page.goto("/dev");
  await expect(
    page.getByText("Saved revision 0 in this browser.", { exact: true }),
  ).toBeVisible();
  await expectPublicPlayers(page, 2);

  await page.getByLabel("Player count").selectOption(String(playerCount));
  await page.getByLabel("Deterministic seed").fill(seed);
  await page.getByRole("button", { name: "New / reset game" }).click();

  const warning = page.getByRole("alertdialog", {
    name: "Replace the current hot-seat game?",
  });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Current: 2 players");
  await expect(warning).toContainText("seed “game-v2-dev-alpha”");
  await expect(warning).toContainText("revision 0");
  await expect(warning).toContainText(`New: ${playerCount} players`);
  await expect(warning).toContainText(`seed “${seed}”`);

  // Merely requesting a reset must leave the authoritative two-player game.
  const currentPlayers = publicPlayerState(page);
  await expect(currentPlayers.locator('ul[aria-label$=" industry inventory"]'))
    .toHaveCount(2);
  await expectRevision(page, 0);
  await expectNoSeriousAxeViolations(
    page,
    `${playerCount}-player reset warning`,
  );

  await page.getByRole("button", { name: "Confirm new game" }).click();
  await expect(warning).toHaveCount(0);
  await expectRevision(page, 0);
  await expectPublicPlayers(page, playerCount);
  await expect(
    page.getByText("Saved revision 0 in this browser.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() =>
    page.evaluate((expectedSeed) =>
      window.localStorage
        .getItem("brass-birmingham:hotseat-session:v1")
        ?.includes(expectedSeed) ?? false, seed)
  ).toBe(true);
}

for (const playerCount of PLAYER_COUNTS) {
  test(`${playerCount}-player reset, reload, reveal, and Pass preserve hot-seat privacy`, async ({
    page,
  }) => {
    const seed = `e2e-${playerCount}-player-handoff`;
    await resetToPlayerCount(page, playerCount, seed);

    await expect(
      page.getByRole("heading", { name: "Pass the device to Player 1" }),
    ).toBeVisible();
    await expectPrivateViewUnmounted(page);

    await page.reload();
    await expect(
      page.getByText(
        "Restored revision 0. The hand is hidden for privacy.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pass the device to Player 1" }),
    ).toBeVisible();
    await expectPublicPlayers(page, playerCount);
    await expectPrivateViewUnmounted(page);

    await page.getByRole("button", {
      name: "Reveal Player 1's private view",
    }).click();
    await expect(
      page.getByRole("heading", { name: "Player 1's private hand" }),
    ).toBeVisible();
    await expect(actionCards(page).first()).toBeEnabled();
    await actionCards(page).first().click();
    const pass = page.getByRole("button", { name: "Pass", exact: true });
    await expect(pass).toBeEnabled();
    await pass.click();

    await expectRevision(page, 1);
    await expect(
      page.getByText("Saved revision 1 in this browser.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Player 1: PASS accepted. Turn complete.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pass the device to Player 2" }),
    ).toBeVisible();
    await expectPublicPlayers(page, playerCount);
    await expectPrivateViewUnmounted(page);

    await page.reload();
    await expect(
      page.getByText(
        "Restored revision 1. The hand is hidden for privacy.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pass the device to Player 2" }),
    ).toBeVisible();
    await expectPublicPlayers(page, playerCount);
    await expectPrivateViewUnmounted(page);
    await expectNoSeriousAxeViolations(
      page,
      `${playerCount}-player restored Player 2 handoff`,
    );
  });
}

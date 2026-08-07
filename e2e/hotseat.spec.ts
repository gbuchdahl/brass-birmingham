import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function summaryValue(page: Page, label: string) {
  return page.locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

async function expectRevision(page: Page, revision: number): Promise<void> {
  await expect(
    page.getByText(`revision ${revision}`, { exact: true }),
  ).toBeVisible();
}

async function expectNoWcagViolations(
  page: Page,
  checkpoint: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target),
  }));
  expect(violations, `${checkpoint} must have no WCAG A/AA violations`)
    .toEqual([]);
}

async function resetGame(page: Page, seed: string): Promise<void> {
  await page.goto("/dev");
  await expect(
    page.getByText("Saved revision 0 in this browser.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Deterministic seed").fill(seed);
  await page.getByRole("button", { name: "New / reset game" }).click();
  await expectRevision(page, 0);
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

test("reload never remounts a private hand or draft during hot-seat handoff", async ({
  page,
}) => {
  await resetGame(page, "e2e-private-handoff");

  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 1" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Use .* as the action card$/ }),
  ).toHaveCount(0);
  await expectNoWcagViolations(page, "initial privacy-safe handoff");

  await page.getByRole("button", {
    name: "Reveal Player 1's private view",
  }).click();
  await expect(
    page.getByRole("heading", { name: "Player 1's private hand" }),
  ).toBeVisible();
  const actionCards = page.getByRole("button", {
    name: /^Use .* as the action card$/,
  });
  await expect(actionCards).toHaveCount(8);
  const firstActionCard = actionCards.first();
  await firstActionCard.click();
  await expect(firstActionCard).toHaveAttribute("aria-pressed", "true");
  await expectNoWcagViolations(page, "revealed private hand");

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
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(actionCards).toHaveCount(0);

  await page.getByRole("button", {
    name: "Reveal Player 1's private view",
  }).click();
  await expect(actionCards).toHaveCount(8);
  await expect(page.locator(
    'button[aria-label^="Use "][aria-label$=" as the action card"][aria-pressed="true"]',
  )).toHaveCount(0);
  await actionCards.first().click();
  await page.getByRole("button", { name: "Pass", exact: true }).click();
  await expectRevision(page, 1);
  await expect(
    page.getByText("Saved revision 1 in this browser.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 2" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(actionCards).toHaveCount(0);

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
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(actionCards).toHaveCount(0);
  await expectNoWcagViolations(page, "restored Player 2 handoff");
});

test("completes and restores a two-era journey with one exact Rail action", async ({
  page,
}) => {
  await resetGame(page, "e2e-complete-all-pass");

  let revision = 0;
  let passes = 0;
  let railNetworks = 0;
  let settlements = 0;
  let eraResolutions = 0;
  let railMoneyAfter: string | null = null;

  while ((await summaryValue(page, "Phase").textContent()) !== "ended") {
    expect(revision, "the UI journey must terminate within 100 commands")
      .toBeLessThan(100);
    const phase = await summaryValue(page, "Phase").textContent();

    if (phase === "action") {
      const reveal = page.getByRole("button", {
        name: /^Reveal Player [12]'s private view$/,
      });
      if (await reveal.count() === 1) await reveal.click();

      const actionCard = page.getByRole("button", {
        name: /^Use .* as the action card$/,
      }).first();
      await expect(actionCard).toBeEnabled();
      await actionCard.click();

      if (
        railNetworks === 0 &&
        (await summaryValue(page, "Era").textContent()) === "rail"
      ) {
        const firstLink = page.getByLabel("Rail first-link plan");
        await expect(firstLink.locator("option")).not.toHaveCount(1);
        await firstLink.selectOption({ index: 1 });
        await expect(page.getByText("Selected route", { exact: true }))
          .toBeVisible();
        railMoneyAfter = await page.locator("dt")
          .filter({ hasText: /^Money after$/ })
          .locator("xpath=following-sibling::dd[1]")
          .textContent();
        expect(railMoneyAfter).toMatch(/^£\d+$/);
        const buildRail = page.getByRole("button", {
          name: "Build 1 Rail link",
        });
        await expect(buildRail).toBeEnabled();
        await buildRail.click();
        railNetworks += 1;
      } else {
        const pass = page.getByRole("button", { name: "Pass", exact: true });
        await expect(pass).toBeEnabled();
        await pass.click();
        passes += 1;
      }
    } else if (phase === "round_settlement") {
      const settle = page.getByRole("button", {
        name: "Apply settlement and continue",
      });
      await expect(settle).toBeEnabled();
      await settle.click();
      settlements += 1;
    } else if (phase === "era_transition") {
      await page.getByRole("button", { name: "Score era and continue" }).click();
      eraResolutions += 1;
    } else {
      throw new Error(`Unexpected hot-seat phase: ${String(phase)}`);
    }

    revision += 1;
    await expectRevision(page, revision);
  }

  expect({ revision, passes, railNetworks, settlements, eraResolutions }).toEqual({
    revision: 100,
    passes: 77,
    railNetworks: 1,
    settlements: 20,
    eraResolutions: 2,
  });
  await expect(summaryValue(page, "Era")).toHaveText("rail");
  await expect(summaryValue(page, "Round")).toHaveText("10");
  // Player 1's Rail spend moves the zero-spend Player 2 to the front next round.
  await expect(summaryValue(page, "Current")).toHaveText("Player 2");
  await expect(
    page.getByRole("heading", { name: "Final standings" }),
  ).toBeVisible();
  const standings = page.getByRole("heading", { name: "Final standings" })
    .locator("..");
  await expect(standings.getByRole("listitem")).toHaveCount(2);
  await expect(standings).toContainText("Player 1");
  await expect(standings).toContainText("Player 2");
  expect(railMoneyAfter).not.toBeNull();
  await expect(standings).toContainText(railMoneyAfter!);
  await expect(standings).toContainText("£17");
  await expect(summaryValue(page, "Built links")).toHaveText("1");
  await expectNoWcagViolations(page, "final standings");

  await expect(
    page.getByText("Saved revision 100 in this browser.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(
      "Restored revision 100. The hand is hidden for privacy.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(summaryValue(page, "Phase")).toHaveText("ended");
  await expect(
    page.getByRole("heading", { name: "Final standings" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
});

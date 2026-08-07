import { expect, test, type Page } from "@playwright/test";
import { createRailTwoLinkBrowserFixture } from "./fixtures/rail-two-link-session";

function summaryValue(page: Page, label: string) {
  return page.locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

function playerPanel(page: Page, seat: string) {
  const escaped = seat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const publicPlayers = page.getByRole("heading", {
    name: "Public player state",
    exact: true,
  }).locator("..");
  return publicPlayers.locator("article").filter({
    hasText: new RegExp(`${escaped}\\s*£`),
  });
}

test("submits an exact progressive two-link Rail action from an authoritative save", async ({
  page,
}) => {
  const fixture = createRailTwoLinkBrowserFixture();
  await page.addInitScript(
    ({ key, serialized }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, serialized);
      }
    },
    {
      key: fixture.storageKey,
      serialized: fixture.serializedSession,
    },
  );

  await page.goto("/dev");
  await expect(
    page.getByText(
      `Restored revision ${fixture.baseline.revision}. The hand is hidden for privacy.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(summaryValue(page, "Era")).toHaveText("rail");
  await expect(summaryValue(page, "Round")).toHaveText(
    String(fixture.baseline.round),
  );
  await expect(summaryValue(page, "Built links")).toHaveText(
    String(fixture.baseline.builtLinks),
  );
  await expect(summaryValue(page, "Coal market")).toHaveText(
    String(fixture.baseline.marketCoal),
  );
  await expect(
    page.getByRole("heading", {
      name: `Pass the device to ${fixture.actorSeat}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(playerPanel(page, fixture.actorSeat)).toContainText(
    `£${fixture.baseline.money}`,
  );
  await expect(playerPanel(page, fixture.actorSeat)).toContainText(
    `${fixture.baseline.linkTokens} links`,
  );

  await page.getByRole("button", {
    name: `Reveal ${fixture.actorSeat}'s private view`,
  }).click();
  const cardArticle = page.getByText(fixture.cardId, { exact: true })
    .locator("xpath=ancestor::article[1]");
  await expect(cardArticle).toBeVisible();
  await cardArticle.getByRole("button", {
    name: /^Use .* as the action card$/,
  }).click();

  const firstSelect = page.getByLabel("Rail first-link plan");
  await expect(firstSelect).toBeEnabled();
  await firstSelect.selectOption(fixture.firstPlan.id);
  const selectedRoute = page.getByText("Selected route", { exact: true })
    .locator("..");
  await expect(selectedRoute).toContainText(fixture.firstPlan.endpointLabel);
  await expect(selectedRoute).toContainText(fixture.firstPlan.coalSummary);
  await expect(
    page.getByRole("button", { name: "Build 1 Rail link" }),
  ).toBeEnabled();

  await page.getByRole("button", {
    name: "Keep first link and consider a second",
  }).click();
  const firstReady = page.getByText("First link ready", { exact: true })
    .locator("..");
  await expect(firstReady).toContainText(fixture.firstPlan.endpointLabel);
  await expect(firstReady).toContainText(fixture.firstPlan.coalSummary);

  const secondSelect = page.getByLabel("Rail second-link extension");
  await expect(secondSelect).toBeEnabled();
  await secondSelect.selectOption(fixture.secondPlan.id);
  for (const endpointLabel of fixture.secondPlan.endpointLabels) {
    await expect(selectedRoute).toContainText(endpointLabel);
  }
  for (const coalSummary of fixture.secondPlan.coalSummaries) {
    await expect(selectedRoute).toContainText(coalSummary);
  }
  await expect(selectedRoute).toContainText(fixture.secondPlan.beerSummary);
  const selectedRouteDetails = selectedRoute.locator("..");
  await expect(
    selectedRouteDetails.locator("dt")
      .filter({ hasText: /^Total cost$/ })
      .locator("xpath=following-sibling::dd[1]"),
  ).toHaveText(
    `£${fixture.secondPlan.totalCost}`,
  );
  const buildTwo = page.getByRole("button", { name: "Build 2 Rail links" });
  await expect(buildTwo).toBeEnabled();
  await buildTwo.click();

  await expect(
    page.getByText(`revision ${fixture.expected.revision}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${fixture.actorSeat}: NETWORK accepted. Turn complete.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: `Pass the device to ${fixture.nextSeat}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(summaryValue(page, "Built links")).toHaveText(
    String(fixture.expected.builtLinks),
  );
  await expect(summaryValue(page, "Coal market")).toHaveText(
    String(fixture.expected.marketCoal),
  );
  await expect(playerPanel(page, fixture.actorSeat)).toContainText(
    `£${fixture.expected.money}`,
  );
  await expect(playerPanel(page, fixture.actorSeat)).toContainText(
    `${fixture.expected.linkTokens} links`,
  );
  const brewery = page.getByLabel("Built industries").locator("article")
    .filter({ hasText: `${fixture.actorSeat}` })
    .filter({ hasText: "Brewery level 2" });
  await expect(brewery).toHaveCount(1);
  await expect(brewery).toContainText(`🍺 ${fixture.expected.breweryBeer} beer`);
  await expect(
    page.getByText(
      `Saved revision ${fixture.expected.revision} in this browser.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect.poll(() =>
    page.evaluate(
      ({ key, staleFirstId, staleSecondId }) => {
        const save = window.localStorage.getItem(key) ?? "";
        return !save.includes("railNetworkPrefix") &&
          !save.includes(staleFirstId) &&
          !save.includes(staleSecondId);
      },
      {
        key: fixture.storageKey,
        staleFirstId: fixture.firstPlan.id,
        staleSecondId: fixture.secondPlan.id,
      },
    )
  ).toBe(true);

  await page.reload();
  await expect(
    page.getByText(
      `Restored revision ${fixture.expected.revision}. The hand is hidden for privacy.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: `Pass the device to ${fixture.nextSeat}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /private hand$/ })).toHaveCount(0);
  await expect(summaryValue(page, "Built links")).toHaveText(
    String(fixture.expected.builtLinks),
  );
  await expect(summaryValue(page, "Coal market")).toHaveText(
    String(fixture.expected.marketCoal),
  );
  await expect(playerPanel(page, fixture.actorSeat)).toContainText(
    `£${fixture.expected.money}`,
  );
  await expect(playerPanel(page, fixture.actorSeat)).toContainText(
    `${fixture.expected.linkTokens} links`,
  );
  await expect(brewery).toContainText(`🍺 ${fixture.expected.breweryBeer} beer`);
});

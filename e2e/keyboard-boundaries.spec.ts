import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  createMerchantFreeDevelopSave,
  MERCHANT_PENDING_REVISION,
} from "./fixtures/merchant-free-develop-save";

const STORAGE_KEY = "brass-birmingham:hotseat-session:v1";

function actionCards(page: Page) {
  return page.getByRole("button", {
    name: /^Use .* as the action card$/,
  });
}

async function expectPrivateChoicesHidden(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /private hand$/ }))
    .toHaveCount(0);
  await expect(page.getByRole("heading", { name: /free Develop$/ }))
    .toHaveCount(0);
  await expect(actionCards(page)).toHaveCount(0);
  await expect(page.getByLabel("Merchant free Develop selection"))
    .toHaveCount(0);
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

async function requestResetWithKeyboard(
  page: Page,
  requestedSeed: string,
) {
  await page.goto("/dev");
  await expect(
    page.getByText("Saved revision 0 in this browser.", { exact: true }),
  ).toBeVisible();
  const reveal = page.getByRole("button", {
    name: "Reveal Player 1's private view",
  });
  await expect(reveal).toBeFocused();

  const reset = page.getByRole("button", { name: "New / reset game" });
  await page.keyboard.press("Shift+Tab");
  await expect(reset).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  const seed = page.getByLabel("Deterministic seed");
  await expect(seed).toBeFocused();
  await seed.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(requestedSeed);
  await page.keyboard.press("Tab");
  await expect(reset).toBeFocused();
  await page.keyboard.press("Enter");

  const warning = page.getByRole("alertdialog", {
    name: "Replace the current hot-seat game?",
  });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(`seed “${requestedSeed}”`);
  await expect(reset).toBeFocused();
  await expectPrivateChoicesHidden(page);
  return warning;
}

test("reset warning can be canceled entirely from the keyboard", async ({
  page,
}) => {
  const requestedSeed = "e2e-keyboard-cancel";
  const warning = await requestResetWithKeyboard(page, requestedSeed);
  await page.keyboard.press("Tab");
  const cancel = page.getByRole("button", { name: "Cancel reset" });
  await expect(cancel).toBeFocused();
  await expectNoWcagViolations(page, "keyboard reset warning");
  await page.keyboard.press("Space");

  await expect(warning).toHaveCount(0);
  await expect(
    page.getByText("New game canceled. The current game is unchanged.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("revision 0", { exact: true })).toBeVisible();
  await expectPrivateChoicesHidden(page);
  expect(await page.evaluate(
    ({ key, unexpectedSeed }) =>
      window.localStorage.getItem(key)?.includes(unexpectedSeed) ?? false,
    { key: STORAGE_KEY, unexpectedSeed: requestedSeed },
  )).toBe(false);
});

test("reset warning can be confirmed entirely from the keyboard", async ({
  page,
}) => {
  const requestedSeed = "e2e-keyboard-confirm";
  const warning = await requestResetWithKeyboard(page, requestedSeed);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel reset" }))
    .toBeFocused();
  await page.keyboard.press("Tab");
  const confirm = page.getByRole("button", { name: "Confirm new game" });
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(warning).toHaveCount(0);
  await expect(page.getByLabel("Deterministic seed"))
    .toHaveValue(requestedSeed);
  await expect(page.getByText("revision 0", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 1" }),
  ).toBeVisible();
  await expectPrivateChoicesHidden(page);
  await expect.poll(() =>
    page.evaluate(
      ({ key, expectedSeed }) =>
        window.localStorage.getItem(key)?.includes(expectedSeed) ?? false,
      { key: STORAGE_KEY, expectedSeed: requestedSeed },
    )
  ).toBe(true);
});

test("Merchant free Develop remains private and resolves from the keyboard", async ({
  page,
}) => {
  const pendingSave = createMerchantFreeDevelopSave();
  await page.goto("/dev");
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: pendingSave },
  );
  await page.reload();

  await expect(
    page.getByText(
      `Restored revision ${MERCHANT_PENDING_REVISION}. The hand is hidden for privacy.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 1" }),
  ).toBeVisible();
  await expectPrivateChoicesHidden(page);
  const reveal = page.getByRole("button", {
    name: "Reveal Player 1's private view",
  });
  await expect(reveal).toBeFocused();
  await expectNoWcagViolations(page, "pending Merchant handoff");
  await page.keyboard.press("Enter");

  const heading = page.getByRole("heading", {
    name: "Player 1's free Develop",
  });
  await expect(heading).toBeFocused();
  await expect(actionCards(page)).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Hide choices" }))
    .toBeFocused();
  await page.keyboard.press("Tab");
  const selection = page.getByLabel("Merchant free Develop selection");
  await expect(selection).toBeFocused();
  await selection.selectOption({ index: 1 });
  await expect(selection).not.toHaveValue("");
  const resolve = page.getByRole("button", { name: "Resolve free Develop" });
  await expect(resolve).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(resolve).toBeFocused();
  await expectNoWcagViolations(page, "revealed Merchant free Develop choice");
  await page.keyboard.press("Space");

  await expect(
    page.getByText(
      "Merchant free Develop resolved. Turn complete.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(`revision ${MERCHANT_PENDING_REVISION + 1}`, { exact: true }),
  ).toBeVisible();
  const roundComplete = page.getByRole("heading", { name: "Round complete" });
  await expect(roundComplete).toBeFocused();
  await expectPrivateChoicesHidden(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", {
    name: "Clear / restart settlement",
  })).toBeFocused();
  await page.keyboard.press("Tab");
  const applySettlement = page.getByRole("button", {
    name: "Apply settlement and continue",
  });
  await expect(applySettlement).toBeFocused();
  await page.keyboard.press("Space");

  const settledRevision = MERCHANT_PENDING_REVISION + 2;
  await expect(
    page.getByText(`revision ${settledRevision}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pass the device to Player 2" }),
  ).toBeVisible();
  await expectPrivateChoicesHidden(page);
  const nextReveal = page.getByRole("button", {
    name: "Reveal Player 2's private view",
  });
  await expect(nextReveal).toBeFocused();
  await expect(
    page.getByText(
      `Saved revision ${settledRevision} in this browser.`,
      { exact: true },
    ),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText(
      `Restored revision ${settledRevision}. The hand is hidden for privacy.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(nextReveal).toBeFocused();
  await expectPrivateChoicesHidden(page);
});

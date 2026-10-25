import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";

/** Client home (nationality step). Matches `tests/e2e` conventions. */
const CLIENT_HOME_PATH =
  process.env.PLAYWRIGHT_CLIENT_HOME_PATH ?? "/visa-processing";

const NATIONALITY_CODE = process.env.SYNTHETIC_NATIONALITY_CODE ?? "IN";
const NATIONALITY_NAME = process.env.SYNTHETIC_NATIONALITY_NAME ?? "India";
const SYNTHETIC_EMAIL =
  process.env.SYNTHETIC_EMAIL ?? "synthetic+uptime@example.com";
const PASSPORT_PATH = process.env.SYNTHETIC_PASSPORT_PATH;

const clickFirstVisible = async (page: Page, names: readonly string[]) => {
  for (const name of names) {
    const button = page.getByRole("button", { name, exact: false }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return true;
    }
  }
  return false;
};

test.describe("apply flow synthetic", () => {
  test("walks nationality → visa → draft and stops on payment without paying", async ({
    page,
  }) => {
    await page.goto(CLIENT_HOME_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-ui='client']")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toHaveCount(0);

    const nationalityInput = page.locator("#home-nationality-input");
    await expect(nationalityInput).toBeVisible({ timeout: 20_000 });
    await nationalityInput.fill(NATIONALITY_NAME);
    const option = page.getByRole("option", { name: new RegExp(NATIONALITY_NAME, "i") }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
    } else {
      await page.keyboard.press("Enter");
    }

    const continueHome = page.getByRole("button", { name: /continue/i }).first();
    if (await continueHome.isVisible().catch(() => false)) {
      await continueHome.click();
    }

    await page.waitForURL(new RegExp(`/apply/start\\?nationality=${NATIONALITY_CODE}`), {
      timeout: 20_000,
    });

    await clickFirstVisible(page, [
      "1–14 days",
      "1-14",
      "14 days",
      "30 days",
      "60 days",
      "How long",
    ]);
    await clickFirstVisible(page, ["Single entry", "Multiple entry"]);
    await clickFirstVisible(page, ["Adult", "Child"]);

    const visaCard = page.locator("button").filter({ hasText: /AED|USD|day/i }).first();
    if (await visaCard.isVisible().catch(() => false)) {
      await visaCard.click();
    }

    const email = page.locator("#apply-email");
    await expect(email).toBeVisible({ timeout: 20_000 });
    await email.fill(SYNTHETIC_EMAIL);

    await page.getByRole("button", { name: /continue/i }).last().click();
    await page.waitForURL(/\/apply\/applications\/[^/]+/, { timeout: 30_000 });

    const applicationUrl = page.url();
    expect(applicationUrl).toMatch(/\/apply\/applications\/[^/]+/);

    if (PASSPORT_PATH && existsSync(PASSPORT_PATH)) {
      const fileInput = page.locator('input[type="file"]').first();
      await expect(fileInput).toBeAttached({ timeout: 20_000 });
      await fileInput.setInputFiles(PASSPORT_PATH);
      const toPayment = page.getByRole("link", { name: /pay|payment|checkout/i }).first();
      if (await toPayment.isVisible().catch(() => false)) {
        await toPayment.click();
      } else {
        await page.goto(applicationUrl.replace(/\/?(\?.*)?$/, "/payment"));
      }
      await page.waitForURL(/\/apply\/applications\/[^/]+\/payment/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: /pay now|pay with/i })).toHaveCount(0);
    } else {
      test.info().annotations.push({
        type: "note",
        description:
          "Set SYNTHETIC_PASSPORT_PATH to a JPEG/PNG to continue to /payment. Draft page reached.",
      });
    }
  });
});

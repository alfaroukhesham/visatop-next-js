import { expect, test, type Page } from "@playwright/test";

/** Client home (nationality step); `/apply` redirects to `/`. */
const CLIENT_HOME_PATH =
  process.env.PLAYWRIGHT_CLIENT_HOME_PATH ?? "/visa-processing/";

async function assertAppShellHealthy(page: Page) {
  await expect(page.getByRole("heading", { name: /something went wrong/i })).toHaveCount(0);
  await expect(page.getByText(/failed to load chunk/i)).toHaveCount(0);

  const stylesheetOk = await page.evaluate(() => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const appSheet = links.find((l) => {
      const href = l.getAttribute("href") ?? "";
      return href.includes("/_next/static/") && href.endsWith(".css");
    });
    if (!appSheet) return { ok: false, reason: "no-next-css-link" };

    try {
      const sheet = [...document.styleSheets].find((s) => {
        const href = s.href ?? "";
        return href.includes("/_next/static/") && href.endsWith(".css");
      });
      if (!sheet) return { ok: false, reason: "next-css-not-in-document.styleSheets" };
      // Rules accessible when sheet loaded from same origin; cross-origin may throw.
      const ruleCount = sheet.cssRules?.length ?? 0;
      return { ok: ruleCount > 0, reason: ruleCount > 0 ? "ok" : "next-css-empty" };
    } catch {
      // Cross-origin stylesheet: still count the link as present.
      return { ok: true, reason: "next-css-link-only" };
    }
  });
  expect(stylesheetOk.ok, `App CSS: ${stylesheetOk.reason}`).toBe(true);

  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont.toLowerCase()).not.toMatch(/^times/);

  await expect(page.locator("[data-ui='client']")).toBeVisible({ timeout: 15_000 });
}

test.describe("client home", () => {
  test("loads Tailwind shell without runtime or chunk errors", async ({ page }) => {
    await page.goto(CLIENT_HOME_PATH, { waitUntil: "networkidle" });
    await assertAppShellHealthy(page);
  });

  test("step rail and hero card use layout (not unstyled stack)", async ({ page }, testInfo) => {
    await page.goto(CLIENT_HOME_PATH, { waitUntil: "domcontentloaded" });
    await assertAppShellHealthy(page);

    const viewportWidth = page.viewportSize()?.width ?? 1280;
    const isMobileLayout =
      testInfo.project.name === "mobile-safari" || viewportWidth < 1024;

    if (isMobileLayout) {
      // ApplyTwoColumn hides the left rail below lg; mobile uses the bottom journey bar.
      await expect(page.getByText("Step 1/5")).toBeVisible();
      await expect(page.getByText("Start your application")).toBeVisible();
    } else {
      await expect(page.getByText("Step 1", { exact: false }).first()).toBeVisible();
    }

    const heroHeading = page.getByRole("heading", {
      name: /traveling to dubai/i,
    });
    await expect(heroHeading).toBeVisible();

    const heroBox = await heroHeading.evaluate((el) => {
      const card = el.closest("div");
      if (!card) return { display: "", borderRadius: "" };
      const cs = getComputedStyle(card);
      return { display: cs.display, borderRadius: cs.borderRadius };
    });
    expect(["flex", "grid", "block"]).toContain(heroBox.display);
    expect(heroBox.borderRadius).not.toBe("0px");
  });
});

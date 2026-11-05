import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_PATH = "/visa-processing/apply/dev/ux-ready-route-mirror";
const ARTIFACT_DIR = process.env.APPLY_READY_SHOT_DIR ?? "/opt/cursor/artifacts/apply-ready";

const COMPACT_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x740", width: 360, height: 740 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x664", width: 390, height: 664 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "430x932", width: 430, height: 932 },
  { name: "440x956", width: 440, height: 956 },
  { name: "1024x768", width: 1024, height: 768 },
] as const;

const DESKTOP_VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

const REQUESTED_BAR_SHOTS = new Set(["320x568", "390x664", "390x844", "440x956", "1024x768"]);
const REQUESTED_DESKTOP_SHOTS = new Set(["1280x800", "1440x900"]);

const saveShot = async (page: Page, name: string) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
  });
  await page.screenshot({
    path: join(ARTIFACT_DIR, `${name}.png`),
    fullPage: false,
  });
};

const openReady = async (page: Page, locale: "en" | "ar", viewport: { width: number; height: number }) => {
  await page.setViewportSize(viewport);
  await page.goto(`${FIXTURE_PATH}?locale=${locale}&screen=ready`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-ui='client']")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /what you'll need|ما ستحتاج إليه/i })).toBeVisible({
    timeout: 20_000,
  });
};

const measureContinue = async (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>("[data-apply-sticky-cta]");
    const rise = document.querySelector<HTMLElement>(".theme-client-rise");
    if (!bar) {
      return {
        hasBar: false,
        bottom: 0,
        top: 0,
        vh: window.innerHeight,
        portal: false,
        inRise: false,
        riseTransform: rise ? getComputedStyle(rise).transform : null,
        parentUi: null as string | null,
      };
    }
    const rect = bar.getBoundingClientRect();
    return {
      hasBar: true,
      bottom: rect.bottom,
      top: rect.top,
      vh: window.innerHeight,
      portal: bar.hasAttribute("data-apply-sticky-cta-portal"),
      inRise: Boolean(bar.closest(".theme-client-rise")),
      riseTransform: rise ? getComputedStyle(rise).transform : null,
      parentUi: bar.parentElement?.getAttribute("data-ui") ?? bar.parentElement?.tagName ?? null,
    };
  });

const measureBarButtons = async (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>("[data-apply-sticky-cta-portal]");
    if (!bar) return [];
    return [...bar.querySelectorAll("button")].map((btn) => {
      const rect = btn.getBoundingClientRect();
      const style = getComputedStyle(btn);
      return {
        text: (btn.textContent ?? "").trim(),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    });
  });

test.describe("apply ready Continue bar", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "viewport matrix is chromium-only");

  for (const locale of ["en", "ar"] as const) {
    for (const viewport of COMPACT_VIEWPORTS) {
      test(`${locale} ${viewport.name} keeps Continue in the first viewport outside rise`, async ({
        page,
      }) => {
        await openReady(page, locale, viewport);
        await expect(page.locator("[data-apply-sticky-cta-portal]")).toBeVisible({ timeout: 10_000 });
        const metrics = await measureContinue(page);
        expect(metrics.hasBar).toBe(true);
        expect(metrics.portal).toBe(true);
        expect(metrics.inRise).toBe(false);
        expect(metrics.parentUi).toBe("client");
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.vh + 1);
        expect(metrics.top).toBeGreaterThanOrEqual(0);
        const buttons = await measureBarButtons(page);
        expect(buttons).toHaveLength(2);
        const previous = buttons[0];
        const continueBtn = buttons[1];
        expect(previous.height).toBeGreaterThanOrEqual(46);
        expect(previous.height).toBeLessThanOrEqual(50);
        expect(continueBtn.height).toBeGreaterThanOrEqual(46);
        expect(continueBtn.height).toBeLessThanOrEqual(50);
        expect(Math.abs(previous.y - continueBtn.y)).toBeLessThan(2);
        expect(previous.borderRadius).toMatch(/^5px/);
        expect(continueBtn.borderRadius).toMatch(/^5px/);
        expect(Number.parseFloat(previous.borderTopWidth)).toBeGreaterThan(0);
        expect(previous.fontSize).toBe("15px");
        expect(continueBtn.fontSize).toBe("16px");
        if (locale === "ar") {
          await expect(page.locator("[data-ui='client']")).toHaveAttribute("dir", "rtl");
          expect(previous.x).toBeGreaterThan(continueBtn.x);
        } else {
          expect(previous.x).toBeLessThan(continueBtn.x);
        }
        await saveShot(page, `after-${locale}-${viewport.name}`);
        if (REQUESTED_BAR_SHOTS.has(viewport.name)) {
          await saveShot(page, `bar-${locale}-${viewport.name}`);
        }
      });
    }

    for (const viewport of DESKTOP_VIEWPORTS) {
      test(`${locale} ${viewport.name} keeps Continue inline (not portaled)`, async ({ page }) => {
        await openReady(page, locale, viewport);
        await expect(page.getByRole("button", { name: /i have these - continue|لديّ هذه المستندات/i })).toBeVisible({
          timeout: 10_000,
        });
        const metrics = await measureContinue(page);
        expect(metrics.hasBar).toBe(true);
        expect(metrics.portal).toBe(false);
        expect(metrics.inRise).toBe(true);
        await saveShot(page, `after-${locale}-${viewport.name}`);
        if (REQUESTED_DESKTOP_SHOTS.has(viewport.name)) {
          await saveShot(page, `desktop-${locale}-${viewport.name}`);
        }
      });
    }
  }

  test("upcoming and current step taps produce visible feedback at 390x844", async ({ page }) => {
    await openReady(page, "en", { width: 390, height: 844 });
    await expect(page.locator("[data-apply-sticky-cta-portal]")).toBeVisible();
    await page.getByRole("button", { name: "Details", exact: true }).click({ force: true });
    await expect(page.getByRole("status")).toContainText(/finish this step first/i);
    const continueBtn = page.locator("[data-apply-sticky-cta-portal]").getByRole("button", {
      name: /i have these - continue/i,
    });
    await expect(continueBtn).toBeVisible();
    const continueBox = await continueBtn.boundingBox();
    expect(continueBox).toBeTruthy();
    expect((continueBox?.y ?? 0) + (continueBox?.height ?? 0)).toBeLessThanOrEqual(844 + 1);

    await page.getByRole("status").click();
    await expect(continueBtn).toBeVisible();

    await page.locator("[aria-current='step']").click();
    await expect(page.getByRole("status")).toBeVisible();

    const photo = page.getByRole("button", { name: /personal photo/i });
    await photo.click();
    await expect(photo).toHaveAttribute("aria-expanded", "true");
    await saveShot(page, "after-en-390x844-taps");
  });
});

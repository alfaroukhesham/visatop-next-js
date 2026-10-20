import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CLIENT_HOME_PATH = process.env.PLAYWRIGHT_CLIENT_HOME_PATH ?? "/visa-processing";

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
] as const;

const LOCALES = ["en", "ar"] as const;

const SCREENSHOT_DIR = "/opt/cursor/artifacts/screenshots";

const NATIONALITIES = [
  { code: "KE", name: "Kenya" },
  { code: "IN", name: "India" },
  { code: "KW", name: "Kuwait" },
  { code: "US", name: "United States" },
];

const mockNationalities = async (page: Page) => {
  await page.route("**/catalog/nationalities**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { nationalities: NATIONALITIES },
        meta: { requestId: "e2e-nationality-combobox" },
      }),
    });
  });
};

const simulateKeyboardVisualViewport = async (page: Page, keyboardHeight: number) => {
  await page.evaluate((kh) => {
    const original = window.visualViewport;
    const width = original?.width ?? window.innerWidth;
    const layoutHeight = window.innerHeight;
    const height = Math.max(160, layoutHeight - kh);
    document.getElementById("e2e-fake-keyboard")?.remove();
    const kb = document.createElement("div");
    kb.id = "e2e-fake-keyboard";
    kb.setAttribute("aria-hidden", "true");
    kb.textContent = "keyboard";
    kb.style.cssText = [
      "position:fixed",
      "left:0",
      "right:0",
      "bottom:0",
      `height:${kh}px`,
      "z-index:50",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:linear-gradient(#d8dce1,#b7bec6)",
      "color:#333",
      "font:13px system-ui,sans-serif",
      "letter-spacing:.12em",
      "text-transform:uppercase",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(kb);
    const listeners = new Map<string, Set<EventListener>>();
    const fake: VisualViewport = {
      get width() {
        return width;
      },
      get height() {
        return height;
      },
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: window.scrollY,
      pageLeft: window.scrollX,
      scale: original?.scale ?? 1,
      addEventListener: (type, fn) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn as EventListener);
        listeners.set(type, set);
      },
      removeEventListener: (type, fn) => {
        listeners.get(type)?.delete(fn as EventListener);
      },
      dispatchEvent: (event) => {
        listeners.get(event.type)?.forEach((fn) => fn(event));
        return true;
      },
      onresize: null,
      onscroll: null,
    } as VisualViewport;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: fake });
    window.dispatchEvent(new Event("resize"));
    fake.dispatchEvent(new Event("resize"));
  }, keyboardHeight);
};

const measureListVsVisualViewport = async (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('[role="listbox"]');
    const input = document.querySelector<HTMLElement>('[role="combobox"]');
    const vv = window.visualViewport;
    if (!list || !input || !vv) {
      return { ok: false as const, reason: "missing-nodes" };
    }
    const box = list.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    const vvTop = vv.offsetTop;
    const vvLeft = vv.offsetLeft;
    const vvBottom = vv.offsetTop + vv.height;
    const vvRight = vv.offsetLeft + vv.width;
    const pad = 2;
    const inside =
      box.top >= vvTop - pad &&
      box.bottom <= vvBottom + pad &&
      box.left >= vvLeft - pad &&
      box.right <= vvRight + pad;
    const belowInput = box.top >= inputBox.bottom - pad;
    const overlapsInput = box.top < inputBox.bottom - pad && box.bottom > inputBox.top + pad;
    const headings = Array.from(document.querySelectorAll("h1, h2"));
    const overlapsHeading = headings.some((node) => {
      const h = node.getBoundingClientRect();
      if (h.width === 0 || h.height === 0) return false;
      return box.top < h.bottom - pad && box.bottom > h.top + pad && box.left < h.right && box.right > h.left;
    });
    const dir = document.querySelector("[data-ui='client']")?.getAttribute("dir") ?? "ltr";
    const sampleX =
      dir === "rtl"
        ? inputBox.right - Math.min(48, inputBox.width / 2)
        : inputBox.left + Math.min(48, inputBox.width / 2);
    const sampleY = inputBox.top + inputBox.height / 2;
    const hit = document.elementFromPoint(sampleX, sampleY);
    const inputPointCoveredByList = Boolean(hit && list.contains(hit));
    return {
      ok: true as const,
      inside,
      belowInput,
      overlapsInput,
      overlapsHeading,
      inputPointCoveredByList,
      dir,
      list: { top: box.top, bottom: box.bottom, left: box.left, right: box.right, height: box.height },
      input: {
        top: inputBox.top,
        bottom: inputBox.bottom,
        left: inputBox.left,
        right: inputBox.right,
      },
      vv: { offsetTop: vv.offsetTop, offsetLeft: vv.offsetLeft, width: vv.width, height: vv.height },
    };
  });

const saveShot = async (page: Page, name: string) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
};

const saveViewportShots = async (page: Page, name: string, extraAlias?: string) => {
  const file = await saveShot(page, name);
  if (extraAlias) await saveShot(page, extraAlias);
  return file;
};

test.describe("nationality combobox stays in the visual viewport", () => {
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`${viewport.width}x${viewport.height} ${locale} with keyboard-sized visualViewport`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(viewport);
        await mockNationalities(page);
        const home =
          locale === "en" ? CLIENT_HOME_PATH : `${CLIENT_HOME_PATH}?locale=${locale}`;
        await page.goto(home, { waitUntil: "domcontentloaded" });

        const combobox = page.getByRole("combobox");
        await expect(combobox).toBeVisible({ timeout: 20_000 });

        await simulateKeyboardVisualViewport(page, Math.round(viewport.height * 0.48));

        await combobox.tap().catch(async () => {
          await combobox.click();
        });
        await combobox.fill("Ken");

        const list = page.getByRole("listbox");
        await expect(list).toBeVisible();
        await expect(page.getByRole("option", { name: /kenya/i })).toBeVisible();

        const prefix = process.env.PLAYWRIGHT_SHOT_PREFIX ?? "after";
        const shotName = `${prefix}-${testInfo.project.name}-${viewport.width}x${viewport.height}-${locale}`;
        const alias =
          testInfo.project.name === "chromium" || testInfo.project.name === "mobile-safari"
            ? `${prefix}-${viewport.width}x${viewport.height}-${locale}`
            : undefined;

        try {
          await expect
            .poll(async () => {
              const measured = await measureListVsVisualViewport(page);
              return (
                measured.ok &&
                measured.belowInput &&
                measured.inside &&
                !measured.overlapsInput &&
                !measured.overlapsHeading &&
                !measured.inputPointCoveredByList
              );
            }, { timeout: 5_000 })
            .toBe(true);
        } finally {
          await saveViewportShots(page, shotName, alias);
        }

        const measured = await measureListVsVisualViewport(page);
        expect(measured.ok, "listbox and visualViewport should exist").toBe(true);
        if (measured.ok) {
          if (locale === "ar") expect(measured.dir).toBe("rtl");
          else expect(measured.dir).not.toBe("rtl");
          expect(measured.overlapsInput, `list overlapped input ${JSON.stringify(measured)}`).toBe(
            false,
          );
          expect(
            measured.overlapsHeading,
            `list overlapped heading ${JSON.stringify(measured)}`,
          ).toBe(false);
          expect(
            measured.inputPointCoveredByList,
            `list covered typed input text ${JSON.stringify(measured)}`,
          ).toBe(false);
          expect(measured.belowInput, `list was not below input ${JSON.stringify(measured)}`).toBe(
            true,
          );
          expect(
            measured.inside,
            `list ${JSON.stringify(measured.list)} vs visualViewport ${JSON.stringify(measured.vv)}`,
          ).toBe(true);
          expect(measured.list.height).toBeGreaterThan(0);
          expect(measured.list.height).toBeLessThanOrEqual(measured.vv.height);
        }
      });
    }
  }
});

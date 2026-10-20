import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CLIENT_HOME_PATH = process.env.PLAYWRIGHT_CLIENT_HOME_PATH ?? "/visa-processing";

const WIDTHS = [360, 390, 412] as const;
const LOCALES = ["en", "ar"] as const;
const KEYBOARD_VISUAL_HEIGHTS = [500, 560] as const;

const SCREENSHOT_DIR = "/opt/cursor/artifacts/screenshots";

const NATIONALITIES = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "AL", name: "Albania" },
  { code: "AM", name: "Armenia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BJ", name: "Benin" },
  { code: "EG", name: "Egypt" },
  { code: "IN", name: "India" },
  { code: "IQ", name: "Iraq" },
  { code: "JO", name: "Jordan" },
  { code: "KE", name: "Kenya" },
  { code: "KW", name: "Kuwait" },
  { code: "LB", name: "Lebanon" },
  { code: "MA", name: "Morocco" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "PK", name: "Pakistan" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SD", name: "Sudan" },
  { code: "SY", name: "Syria" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "US", name: "United States" },
  { code: "YE", name: "Yemen" },
];

const layoutHeightFor = (width: number): number => (width <= 360 ? 640 : 844);

const SCROLL_NATIONALITIES: Array<{ code: string; name: string }> = [];
for (let i = 0; SCROLL_NATIONALITIES.length < 194; i += 1) {
  const code = `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}`;
  if (code === "AE") continue;
  SCROLL_NATIONALITIES.push({
    code,
    name: `Nationality ${String(SCROLL_NATIONALITIES.length).padStart(3, "0")} Label`,
  });
}

const mockNationalities = async (
  page: Page,
  nationalities: Array<{ code: string; name: string }> = NATIONALITIES,
) => {
  await page.route("**/catalog/nationalities**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { nationalities },
        meta: { requestId: "e2e-nationality-combobox" },
      }),
    });
  });
};

const installFixedHeader = async (page: Page) => {
  await page.evaluate(() => {
    document.querySelector("[data-ui='client'] > header")?.setAttribute("hidden", "");
    document.getElementById("e2e-fixed-header")?.remove();
    const bar = document.createElement("header");
    bar.id = "e2e-fixed-header";
    bar.setAttribute("data-e2e-header", "true");
    bar.textContent = "VisaTop.com";
    bar.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "height:117px",
      "z-index:2147483000",
      "background:#012031",
      "color:#fff",
      "display:flex",
      "align-items:center",
      "padding:0 16px",
      "font:600 18px system-ui,sans-serif",
    ].join(";");
    document.body.appendChild(bar);
    const h = bar.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--wp-shell-header-height", `${Math.ceil(h)}px`);
  });
};

const simulateKeyboardVisualViewport = async (page: Page, visualHeight: number) => {
  await page.evaluate((vh) => {
    const original = window.visualViewport;
    const width = original?.width ?? window.innerWidth;
    const layoutHeight = window.innerHeight;
    const height = Math.min(vh, layoutHeight);
    const kh = Math.max(0, layoutHeight - height);
    document.getElementById("e2e-fake-keyboard")?.remove();
    if (kh > 0) {
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
    }
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
  }, visualHeight);
};

const measureCombobox = async (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('[role="listbox"]');
    const input = document.querySelector<HTMLElement>('[role="combobox"]');
    const header = document.getElementById("e2e-fixed-header");
    const vv = window.visualViewport;
    if (!list || !input || !vv) {
      return { ok: false as const, reason: "missing-nodes" };
    }
    const box = list.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    const headerBottom = headerBox?.bottom ?? 0;
    const varPx = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--wp-shell-header-height"),
    );
    const vvTop = vv.offsetTop;
    const vvBottom = vv.offsetTop + vv.height;
    const pad = 2;
    const belowHeader = inputBox.top >= headerBottom + 8 - pad;
    const belowInput = box.top >= inputBox.bottom - pad;
    const overlapsInput = box.top < inputBox.bottom - pad && box.bottom > inputBox.top + pad;
    const overlapsHeader = Boolean(
      headerBox && box.top < headerBox.bottom - pad && box.bottom > headerBox.top + pad,
    );
    const listOnScreen =
      box.top >= Math.max(vvTop, headerBottom) - pad && box.bottom <= vvBottom + pad;
    const inputOnScreen =
      inputBox.top >= Math.max(vvTop, headerBottom) - pad && inputBox.bottom <= vvBottom + pad;
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
      belowHeader,
      belowInput,
      overlapsInput,
      overlapsHeader,
      listOnScreen,
      inputOnScreen,
      inputPointCoveredByList,
      dir,
      headerBottom,
      headerVarPx: Number.isFinite(varPx) ? varPx : 0,
      list: { top: box.top, bottom: box.bottom, height: box.height, scrollHeight: list.scrollHeight },
      input: { top: inputBox.top, bottom: inputBox.bottom },
      vv: { offsetTop: vv.offsetTop, height: vv.height },
    };
  });

const saveShot = async (page: Page, name: string) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
};

const typeIntoCombobox = async (page: Page, text: string) => {
  await page.getByRole("combobox").evaluate((el, value) => {
    const input = (
      el instanceof HTMLInputElement ? el : el.querySelector("input")
    ) as HTMLInputElement | null;
    if (!input) throw new Error("combobox input missing");
    input.focus();
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    proto?.set?.call(input, value);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: value,
        inputType: "insertFromPaste",
      }),
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, text);
};

const openHome = async (
  page: Page,
  width: number,
  layoutHeight: number,
  locale: string,
  nationalities: Array<{ code: string; name: string }> = NATIONALITIES,
) => {
  await page.setViewportSize({ width, height: layoutHeight });
  await mockNationalities(page, nationalities);
  const home = locale === "en" ? CLIENT_HOME_PATH : `${CLIENT_HOME_PATH}?locale=${locale}`;
  await page.goto(home, { waitUntil: "domcontentloaded" });
  const combobox = page.getByRole("combobox");
  await expect(combobox).toBeVisible({ timeout: 20_000 });
  await installFixedHeader(page);
  return combobox;
};

const assertOpenLayout = async (page: Page, locale: string) => {
  await expect
    .poll(async () => {
      const measured = await measureCombobox(page);
      return (
        measured.ok &&
        measured.belowHeader &&
        measured.belowInput &&
        measured.inputOnScreen &&
        measured.listOnScreen &&
        !measured.overlapsInput &&
        !measured.overlapsHeader &&
        !measured.inputPointCoveredByList
      );
    }, { timeout: 6_000 })
    .toBe(true);

  const measured = await measureCombobox(page);
  expect(measured.ok).toBe(true);
  if (!measured.ok) return;
  if (locale === "ar") expect(measured.dir).toBe("rtl");
  else expect(measured.dir).not.toBe("rtl");
  expect(measured.headerVarPx, "header CSS var should be measured").toBeGreaterThan(40);
  expect(measured.belowHeader, `input under header ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.inputOnScreen, `input off screen ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.belowInput, `list not below input ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.listOnScreen, `list not fully on screen ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.overlapsHeader).toBe(false);
  expect(measured.overlapsInput).toBe(false);
};

test.describe("nationality combobox header offset and keyboard", () => {
  for (const width of WIDTHS) {
    for (const locale of LOCALES) {
      test(`${width} ${locale} without keyboard stays below the header`, async ({ page }) => {
        const layoutHeight = layoutHeightFor(width);
        const combobox = await openHome(page, width, layoutHeight, locale);
        await combobox.tap().catch(async () => {
          await combobox.click();
        });
        await expect(page.getByRole("listbox")).toBeVisible();
        await assertOpenLayout(page, locale);
      });

      for (const visualHeight of KEYBOARD_VISUAL_HEIGHTS) {
        test(`${width} ${locale} keyboard visual ${visualHeight}`, async ({ page }, testInfo) => {
          const layoutHeight = layoutHeightFor(width);
          const combobox = await openHome(page, width, layoutHeight, locale);
          await simulateKeyboardVisualViewport(page, visualHeight);
          await combobox.tap().catch(async () => {
            await combobox.click();
          });
          const typed = locale === "ar" ? "ني" : "Ken";
          await typeIntoCombobox(page, typed);
          await expect(page.getByRole("listbox")).toBeVisible();
          if (locale === "ar") {
            const names = await page.getByRole("option").allTextContents();
            expect(names.slice(0, 2).join(" ")).toMatch(/نيجيريا/);
            expect(names.slice(0, 2).join(" ")).toMatch(/النيجر/);
          } else {
            await expect(page.getByRole("option", { name: /kenya/i })).toBeVisible();
          }

          const prefix = process.env.PLAYWRIGHT_SHOT_PREFIX ?? "after";
          const shotName = `${prefix}-${testInfo.project.name}-${width}x${visualHeight}-${locale}`;
          const alias =
            width === 390 &&
            visualHeight === 500 &&
            (testInfo.project.name === "chromium" || testInfo.project.name === "mobile-safari")
              ? `${prefix}-390-${locale}-focus-typed`
              : undefined;

          try {
            await assertOpenLayout(page, locale);
          } finally {
            await saveShot(page, shotName);
            if (alias) await saveShot(page, alias);
          }
        });
      }
    }
  }
});

const pause = async (page: Page, ms: number) => {
  await page.evaluate((wait) => new Promise((resolve) => setTimeout(resolve, wait)), ms);
};

const listScrollState = (list: Locator) =>
  list.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));

const touchDragList = async (page: Page, list: Locator, distancePx: number) => {
  await list.evaluate((el, dy) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const startY = rect.top + Math.min(48, rect.height / 3);
    const endY = startY - dy;
    const fire = (type: string, y: number, extra: PointerEventInit = {}) => {
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: x,
          clientY: y,
          buttons: type === "pointerup" ? 0 : 1,
          pressure: type === "pointerup" ? 0 : 1,
          ...extra,
        }),
      );
    };
    fire("pointerdown", startY);
    const steps = 12;
    for (let i = 1; i <= steps; i += 1) {
      fire("pointermove", startY + ((endY - startY) * i) / steps);
    }
    fire("pointerup", endY);
  }, distancePx);
};

const wheelList = async (page: Page, list: Locator, deltaY: number) => {
  await list.evaluate((el, dy) => {
    el.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        composed: true,
        deltaY: dy,
        deltaMode: 0,
      }),
    );
  }, deltaY);
};

test.describe("nationality combobox Arabic search and inner scroll", () => {
  test("AR locale matches الإمارات after typing الإم", async ({ page }) => {
    const combobox = await openHome(page, 390, 844, "ar");
    await simulateKeyboardVisualViewport(page, 500);
    await combobox.tap().catch(async () => {
      await combobox.click();
    });
    await typeIntoCombobox(page, "الإم");
    await expect(page.getByRole("option", { name: /إمارات|الامارات|الإمارات/ })).toBeVisible();
    await assertOpenLayout(page, "ar");
  });

  for (const width of WIDTHS) {
    for (const locale of LOCALES) {
      for (const visualHeight of [null, 500] as const) {
        const keyboardLabel = visualHeight ? `keyboard visual ${visualHeight}` : "no keyboard";
        test(`${width} ${locale} ${keyboardLabel} list stays scrolled after touch drag and wheel`, async ({
          page,
        }, testInfo) => {
          const layoutHeight = layoutHeightFor(width);
          const combobox = await openHome(page, width, layoutHeight, locale, SCROLL_NATIONALITIES);
          if (visualHeight) await simulateKeyboardVisualViewport(page, visualHeight);
          await combobox.tap().catch(async () => {
            await combobox.click();
          });
          const list = page.getByRole("listbox");
          await expect(list).toBeVisible();
          await expect
            .poll(async () => {
              const state = await listScrollState(list);
              return (
                /auto|scroll/.test(state.overflowY) &&
                state.scrollHeight - state.clientHeight > 400 &&
                state.clientHeight > 80
              );
            })
            .toBe(true);

          const pageYBefore = await page.evaluate(() => window.scrollY);
          const beforeTouch = await listScrollState(list);
          await touchDragList(page, list, 180);
          await pause(page, 500);
          const afterTouch = await listScrollState(list);
          expect(afterTouch.scrollTop, `touch drag did not stick ${JSON.stringify({ beforeTouch, afterTouch })}`).toBeGreaterThan(
            beforeTouch.scrollTop + 24,
          );

          const beforeWheel = afterTouch.scrollTop;
          await wheelList(page, list, 240);
          await pause(page, 500);
          const afterWheel = await listScrollState(list);
          expect(afterWheel.scrollTop, `wheel did not stick ${JSON.stringify(afterWheel)}`).toBeGreaterThan(beforeWheel + 24);
          await expect(list).toBeVisible();
          const pageYAfter = await page.evaluate(() => window.scrollY);
          expect(Math.abs(pageYAfter - pageYBefore)).toBeLessThan(24);

          const assigned = 400;
          await list.evaluate((el, top) => {
            el.scrollTop = top;
          }, assigned);
          await pause(page, 500);
          const held = await list.evaluate((el) => el.scrollTop);
          expect(held, "assigned scrollTop snapped back").toBeGreaterThan(assigned - 40);

          if (
            width === 390 &&
            visualHeight === 500 &&
            (testInfo.project.name === "chromium" || testInfo.project.name === "mobile-safari")
          ) {
            await saveShot(page, `after-390-${locale}-list-scrolled`);
          }
        });
      }
    }
  }
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CLIENT_HOME_PATH = process.env.PLAYWRIGHT_CLIENT_HOME_PATH ?? "/visa-processing";

const WIDTHS = [360, 390, 412] as const;
const LOCALES = ["en", "ar"] as const;
const KEYBOARD_VISUAL_HEIGHTS = [500, 560] as const;

const SCREENSHOT_DIR = "/opt/cursor/artifacts/screenshots";

const NATIONALITIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AE", name: "United Arab Emirates" },
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

const WP_FOOTER_HEIGHT_PX = 400;

const installFixedFooter = async (page: Page) => {
  await page.evaluate((footerHeight) => {
    document.querySelector("[data-ui='client'] > footer")?.setAttribute("hidden", "");
    document.querySelectorAll('iframe[title="WP Footer"]').forEach((node) => {
      if (!(node instanceof HTMLElement) || node.id === "e2e-wp-footer") return;
      node.setAttribute("hidden", "");
      node.style.display = "none";
    });
    document.getElementById("e2e-wp-footer")?.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "e2e-wp-footer";
    iframe.title = "WP Footer";
    iframe.setAttribute("data-wp-shell", "footer");
    iframe.setAttribute("data-e2e-footer", "true");
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = [
      "position:fixed",
      "left:0",
      "right:0",
      "bottom:0",
      "width:100%",
      `height:${footerHeight}px`,
      "border:0",
      "display:block",
      // Above the apply stacking context (z-index:0) so uncovered list pixels
      // would lose hit-testing — matching the in-flow WP footer iframe.
      "z-index:10",
      "background:#012031",
    ].join(";");
    iframe.srcdoc = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#012031;color:#d5dde3;font:14px/1.45 system-ui,sans-serif;}
  .wrap{min-height:100%;padding:22px 20px 28px;text-align:center;box-sizing:border-box;}
  .links{color:#9aa7b2;margin-bottom:18px;}
  .links span{margin:0 12px;}
  .contact{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin:12px 0 18px;color:#e8eef2;}
  .brand{font:700 22px/1.1 system-ui,sans-serif;color:#fff;margin:10px 0 8px;}
  .brand span{color:#FCCD64;}
  .blurb{max-width:340px;margin:0 auto 10px;color:#c5d0d8;font-size:13px;}
  .copy{color:#8b98a3;font-size:12px;margin:8px 0;}
  .license{color:#8b98a3;font-size:12px;}
  .license u{color:#FCCD64;}
  .social{display:flex;justify-content:center;gap:8px;margin-top:14px;}
  .social i{width:28px;height:28px;border-radius:6px;background:#FCCD64;display:inline-block;}
</style></head><body>
  <div class="wrap">
    <div class="links"><span>Privacy Policy</span><span>Term Of Use</span></div>
    <div class="contact"><span>info@visatop.com</span><span>+971 503 156 105</span></div>
    <div class="brand">Visa<span>Top</span>.com</div>
    <p class="blurb">We are proud to offer top-tier Visa Services in the UAE, setting ourselves apart as a leading choice in the industry</p>
    <p class="copy">Copyright ©2026 Visatop Travel Agency LLC - All rights reserved</p>
    <p class="license">(License No. 1649936) <u>Verify License</u></p>
    <div class="social"><i></i><i></i><i></i><i></i></div>
  </div>
</body></html>`;
    document.body.appendChild(iframe);
    document.documentElement.style.setProperty("--wp-shell-footer-height", `${footerHeight}px`);
  }, WP_FOOTER_HEIGHT_PX);
};

const revealComboboxInShellGap = async (page: Page) => {
  await page.evaluate(() => {
    const input = document.querySelector<HTMLElement>('[role="combobox"]');
    if (!input) return;
    document.getElementById("e2e-shell-scroll-spacer")?.remove();
    const spacer = document.createElement("div");
    spacer.id = "e2e-shell-scroll-spacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = "display:block;width:100%;height:1600px;flex-shrink:0;pointer-events:none;";
    document.body.appendChild(spacer);
    const headerBottom = document.getElementById("e2e-fixed-header")?.getBoundingClientRect().bottom ?? 0;
    const targetTop = headerBottom + 12;
    const delta = input.getBoundingClientRect().top - targetTop;
    if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
  });
};

const openCombobox = async (page: Page, combobox: Locator) => {
  await revealComboboxInShellGap(page);
  await combobox.evaluate((el) => {
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.dispatchEvent(new Event("focus", { bubbles: true }));
      el.click();
    }
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
    const footer =
      document.getElementById("e2e-wp-footer") ??
      document.querySelector<HTMLElement>('iframe[data-wp-shell="footer"], iframe[title="WP Footer"]');
    const vv = window.visualViewport;
    if (!list || !input || !vv) {
      return { ok: false as const, reason: "missing-nodes" };
    }
    const box = list.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    const footerBox = footer?.getBoundingClientRect();
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
    const overlapsFooter = Boolean(
      footerBox &&
        footerBox.height > 0 &&
        box.top < footerBox.bottom - pad &&
        box.bottom > footerBox.top + pad,
    );
    const listOnScreen =
      box.top >= Math.max(vvTop, headerBottom) - pad && box.bottom <= vvBottom + pad;
    const inputOnScreen =
      inputBox.top >= Math.max(vvTop, headerBottom) - pad && inputBox.bottom <= vvBottom + pad;
    const listAboveFooter = !footerBox || box.bottom <= footerBox.top + pad;
    const dir = document.querySelector("[data-ui='client']")?.getAttribute("dir") ?? "ltr";
    const sampleX =
      dir === "rtl"
        ? inputBox.right - Math.min(48, inputBox.width / 2)
        : inputBox.left + Math.min(48, inputBox.width / 2);
    const sampleY = inputBox.top + inputBox.height / 2;
    const hit = document.elementFromPoint(sampleX, sampleY);
    const inputPointCoveredByList = Boolean(hit && list.contains(hit));
    const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    let lastVisible: DOMRect | null = null;
    for (const opt of options) {
      const r = opt.getBoundingClientRect();
      if (r.height <= 0) continue;
      if (r.top >= box.top - pad && r.bottom <= box.bottom + pad) lastVisible = r;
    }
    const optionHitX = lastVisible
      ? lastVisible.left + Math.min(40, lastVisible.width / 2)
      : box.left + Math.min(40, Math.max(16, box.width / 2));
    const optionHitY = lastVisible
      ? lastVisible.top + lastVisible.height / 2
      : Math.max(box.top + 8, box.bottom - 16);
    const bottomHit = document.elementFromPoint(optionHitX, optionHitY);
    const bottomRowHitsOption = Boolean(
      bottomHit instanceof Element &&
        (bottomHit.closest('[role="option"]') || list.contains(bottomHit)),
    );
    const bottomHitTag =
      bottomHit instanceof Element
        ? `${bottomHit.tagName.toLowerCase()}${bottomHit.id ? `#${bottomHit.id}` : ""}${
            bottomHit.getAttribute("role") ? `[role=${bottomHit.getAttribute("role")}]` : ""
          }`
        : String(bottomHit);
    return {
      ok: true as const,
      belowHeader,
      belowInput,
      overlapsInput,
      overlapsHeader,
      overlapsFooter,
      listAboveFooter,
      listOnScreen,
      inputOnScreen,
      inputPointCoveredByList,
      bottomRowHitsOption,
      bottomHitTag,
      dir,
      headerBottom,
      headerVarPx: Number.isFinite(varPx) ? varPx : 0,
      list: {
        top: box.top,
        bottom: box.bottom,
        height: box.height,
        left: box.left,
        width: box.width,
        scrollHeight: list.scrollHeight,
      },
      optionHit: { x: optionHitX, y: optionHitY },
      input: { top: inputBox.top, bottom: inputBox.bottom },
      footer: footerBox
        ? { top: footerBox.top, bottom: footerBox.bottom, height: footerBox.height }
        : null,
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
  await installFixedFooter(page);
  await revealComboboxInShellGap(page);
  return combobox;
};

const assertOpenLayout = async (page: Page, locale: string) => {
  await expect
    .poll(async () => {
      const measured = await measureCombobox(page);
      return Boolean(measured.ok && measured.list && measured.footer);
    }, { timeout: 6_000 })
    .toBe(true);

  const measured = await measureCombobox(page);
  expect(measured.ok, `combobox nodes missing ${JSON.stringify(measured)}`).toBe(true);
  if (!measured.ok) return;
  if (locale === "ar") expect(measured.dir).toBe("rtl");
  else expect(measured.dir).not.toBe("rtl");
  expect(measured.headerVarPx, "header CSS var should be measured").toBeGreaterThan(40);
  expect(measured.footer, "WP footer shell should be present").toBeTruthy();
  expect(measured.belowHeader, `input under header ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.inputOnScreen, `input off screen ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.belowInput, `list not below input ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.listOnScreen, `list not fully on screen ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.listAboveFooter, `list under footer ${JSON.stringify(measured)}`).toBe(true);
  expect(measured.overlapsHeader).toBe(false);
  expect(measured.overlapsInput).toBe(false);
  expect(measured.overlapsFooter, `footer covers list ${JSON.stringify(measured)}`).toBe(false);
  expect(measured.bottomRowHitsOption, `bottom row missed option ${JSON.stringify(measured)}`).toBe(
    true,
  );
};

test.describe("nationality combobox header offset and keyboard", () => {
  for (const width of WIDTHS) {
    for (const locale of LOCALES) {
      test(`${width} ${locale} without keyboard stays below the header`, async ({ page }, testInfo) => {
        const layoutHeight = layoutHeightFor(width);
        const combobox = await openHome(page, width, layoutHeight, locale);
        await openCombobox(page, combobox);
        await expect(page.getByRole("listbox")).toBeVisible();
        await expect(page.getByRole("option").first()).toBeVisible();
        try {
          await assertOpenLayout(page, locale);
        } finally {
          if (
            width === 390 &&
            (testInfo.project.name === "chromium" || testInfo.project.name === "mobile-safari")
          ) {
            const prefix = process.env.PLAYWRIGHT_SHOT_PREFIX ?? "after";
            await saveShot(page, `${prefix}-390-${locale}-nokb-footer`);
          }
        }
      });

      for (const visualHeight of KEYBOARD_VISUAL_HEIGHTS) {
        test(`${width} ${locale} keyboard visual ${visualHeight}`, async ({ page }, testInfo) => {
          const layoutHeight = layoutHeightFor(width);
          const combobox = await openHome(page, width, layoutHeight, locale);
          await simulateKeyboardVisualViewport(page, visualHeight);
          await openCombobox(page, combobox);
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
    await openCombobox(page, combobox);
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
          await openCombobox(page, combobox);
          const list = page.getByRole("listbox");
          await expect(list).toBeVisible();
          await assertOpenLayout(page, locale);
          const scrollable = await listScrollState(list);
          const canHandScroll =
            /auto|scroll/.test(scrollable.overflowY) &&
            scrollable.scrollHeight - scrollable.clientHeight > 400 &&
            scrollable.clientHeight > 80;

          if (canHandScroll) {
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
          } else {
            expect(scrollable.clientHeight, `list too short under footer ${JSON.stringify(scrollable)}`).toBeGreaterThan(24);
          }

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

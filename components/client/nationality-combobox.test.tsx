/** @vitest-environment jsdom */

import type { ReactElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { NationalityCombobox } from "@/components/client/nationality-combobox";
import { getCustomerI18nBundle, getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";

const en = getEnglishCustomerMessages();

const NATIONALITIES = [
  { code: "IN", name: "India" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "US", name: "United States" },
];

const ANCHOR = {
  x: 16,
  y: 72,
  top: 72,
  left: 16,
  bottom: 136,
  right: 374,
  width: 358,
  height: 64,
  toJSON: () => ({}),
};

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      {ui}
    </CustomerI18nProvider>,
  );

const installVisualViewport = (box: { width: number; height: number; offsetTop?: number; offsetLeft?: number }) => {
  const listeners = new Map<string, Set<EventListener>>();
  const vv = {
    width: box.width,
    height: box.height,
    offsetTop: box.offsetTop ?? 0,
    offsetLeft: box.offsetLeft ?? 0,
    scale: 1,
    pageTop: 0,
    pageLeft: 0,
    addEventListener: (type: string, fn: EventListener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((fn) => fn(event));
      return true;
    },
    onresize: null,
    onscroll: null,
  };
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  return vv;
};

describe("NationalityCombobox visual viewport", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.querySelector?.('input[role="combobox"]')) {
        return ANCHOR as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
    vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("constrains the list to a keyboard-shrunk visual viewport and opens below the input", async () => {
    installVisualViewport({ width: 390, height: 400, offsetTop: 0 });
    const user = userEvent.setup();
    wrap(
      <NationalityCombobox
        id="home-nationality-input"
        nationalities={NATIONALITIES}
        valueCode={null}
        onSelectCode={() => undefined}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Ken");

    const list = await screen.findByRole("listbox");
    const positioned = list.style.top ? list : list.parentElement;
    expect(positioned).toBeTruthy();
    expect(positioned!.style.top).toBe("100%");
    expect(Number.parseFloat(positioned!.style.maxHeight)).toBeGreaterThan(0);
    expect(Number.parseFloat(positioned!.style.maxHeight)).toBeLessThanOrEqual(400);
    expect(positioned!.getAttribute("data-list-mode")).toBe("inline");
    expect(positioned!.getAttribute("data-placement")).toBe("below");
    expect(screen.getByRole("option", { name: /kenya/i })).toBeVisible();
  });

  it("uses visualViewport offset so a fixed list is not pinned to the layout top", async () => {
    installVisualViewport({ width: 390, height: 400, offsetTop: 300, offsetLeft: 0 });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.querySelector?.('input[role="combobox"]')) {
        return {
          x: 16,
          y: 360,
          top: 360,
          left: 16,
          bottom: 424,
          right: 374,
          width: 358,
          height: 64,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
    const user = userEvent.setup();
    wrap(
      <NationalityCombobox
        nationalities={NATIONALITIES}
        valueCode={null}
        onSelectCode={() => undefined}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const list = await screen.findByRole("listbox");
    const positioned = list.style.top ? list : list.parentElement!;
    const maxHeight = Number.parseFloat(positioned.style.maxHeight);
    expect(positioned.style.top).toBe("100%");
    expect(positioned.getAttribute("data-list-mode")).toBe("inline");
    expect(maxHeight).toBe(260);
    expect(maxHeight).toBeGreaterThan(0);
    expect(maxHeight).toBeLessThanOrEqual(400);
  });

  it("does not reset listbox scrollTop on window or visualViewport scroll", async () => {
    const vv = installVisualViewport({ width: 390, height: 500, offsetTop: 0 });
    const many = Array.from({ length: 40 }, (_, i) => ({
      code: `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
      name: `Nationality ${String(i).padStart(2, "0")}`,
    })).filter((n) => n.code !== "AE");

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.querySelector?.('input[role="combobox"]')) return ANCHOR as DOMRect;
      if (this.getAttribute?.("role") === "listbox") {
        return {
          x: 16,
          y: 200,
          top: 200,
          left: 16,
          bottom: 552,
          right: 374,
          width: 358,
          height: 352,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if (this.getAttribute?.("role") === "option") {
        const list = this.closest?.("[role='listbox']") as HTMLElement | null;
        const top =
          this.getAttribute("aria-selected") === "true" ? 204 - (list?.scrollTop ?? 0) : 248;
        return {
          x: 16,
          y: top,
          top,
          left: 16,
          bottom: top + 44,
          right: 374,
          width: 358,
          height: 44,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    const user = userEvent.setup();
    wrap(
      <NationalityCombobox
        nationalities={many}
        valueCode={null}
        onSelectCode={() => undefined}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const list = await screen.findByRole("listbox");
    Object.defineProperty(list, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 352 });
    list.scrollTop = 400;
    expect(list.scrollTop).toBe(400);

    await act(async () => {
      list.dispatchEvent(new Event("scroll", { bubbles: true }));
      window.dispatchEvent(new Event("scroll"));
      vv.dispatchEvent(new Event("scroll"));
      vv.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(list.scrollTop).toBe(400);
  });

  it("matches Arabic nationality names in the AR locale", async () => {
    installVisualViewport({ width: 390, height: 400, offsetTop: 0 });
    const ar = getCustomerI18nBundle("ar");
    const user = userEvent.setup();
    render(
      <CustomerI18nProvider locale="ar" messages={ar.messages} fallback={ar.fallback}>
        <NationalityCombobox
          nationalities={NATIONALITIES}
          valueCode={null}
          onSelectCode={() => undefined}
        />
      </CustomerI18nProvider>,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "ني");
    expect(await screen.findByRole("option", { name: /نيجيريا/ })).toBeVisible();

    await user.clear(input);
    await user.type(input, "الإم");
    expect(await screen.findByRole("option", { name: /إمارات|الامارات|الإمارات/ })).toBeVisible();
  });
});

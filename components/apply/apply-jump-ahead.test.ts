/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureApplyStickyCtaVisible } from "./apply-jump-ahead";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ensureApplyStickyCtaVisible", () => {
  it("is a no-op when the Continue bar is fully in the viewport", () => {
    const bar = document.createElement("div");
    bar.setAttribute("data-apply-sticky-cta", "");
    document.body.appendChild(bar);
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      top: 800,
      bottom: 900,
      left: 0,
      right: 400,
      width: 400,
      height: 100,
      x: 0,
      y: 800,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 956 });
    const scroll = vi.fn();
    bar.scrollIntoView = scroll;
    ensureApplyStickyCtaVisible();
    expect(scroll).not.toHaveBeenCalled();
  });

  it("scrolls only when the Continue bar is below the fold", () => {
    const bar = document.createElement("div");
    bar.setAttribute("data-apply-sticky-cta", "");
    document.body.appendChild(bar);
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      top: 995,
      bottom: 1064,
      left: 0,
      right: 440,
      width: 440,
      height: 69,
      x: 0,
      y: 995,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 956 });
    const scroll = vi.fn();
    bar.scrollIntoView = scroll;
    ensureApplyStickyCtaVisible();
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  });
});

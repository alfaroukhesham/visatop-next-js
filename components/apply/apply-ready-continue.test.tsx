/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplyJumpAheadProvider, useApplyJumpAhead } from "./apply-jump-ahead";
import {
  APPLY_READY_CONTINUE_INLINE_CLASS,
  APPLY_STICKY_CTA_MEDIA_QUERY,
  ApplyReadyContinue,
} from "./apply-ready-continue";

const wrap = (ui: ReactElement) =>
  render(
    <div data-ui="client">
      <ApplyJumpAheadProvider>{ui}</ApplyJumpAheadProvider>
    </div>,
  );

const installMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }) as MediaQueryList,
  });
};

afterEach(() => {
  cleanup();
});

const PulseTrigger = () => {
  const { pulse } = useApplyJumpAhead();
  return (
    <button type="button" onClick={pulse}>
      jump
    </button>
  );
};

describe("ApplyReadyContinue desktop (>=1025px)", () => {
  afterEach(() => {
    installMatchMedia(false);
  });

  it("is a full-width gold bar that stays inline and is not portaled", () => {
    installMatchMedia(false);
    wrap(<ApplyReadyContinue onClick={() => undefined}>I have these - Continue</ApplyReadyContinue>);
    const bar = document.querySelector("[data-apply-sticky-cta]") as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar?.hasAttribute("data-apply-sticky-cta-portal")).toBe(false);
    expect(bar?.className).toContain("max-md:fixed");
    expect(bar?.className).toContain("max-md:bottom-0");
    expect(bar?.className).toContain("safe-area-inset-bottom");
    expect(bar?.className).toContain("md:static");
    expect(bar?.className).not.toMatch(/(?:^|\s)hidden(?:\s|$)/);
    expect(bar?.className).not.toContain("max-[1024px]:hidden");
    expect(APPLY_READY_CONTINUE_INLINE_CLASS).toContain("md:static");
    expect(screen.getByRole("button", { name: /i have these - continue/i })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: /i have these - continue/i })).toHaveClass("normal-case");
    expect(document.querySelector("[data-apply-sticky-cta-portal]")).toBeNull();
  });

  it("pulses once when jump-ahead fires", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const onClick = vi.fn();
    wrap(
      <>
        <PulseTrigger />
        <ApplyReadyContinue onClick={onClick}>I have these - Continue</ApplyReadyContinue>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "jump" }));
    expect(screen.getByRole("button", { name: /i have these - continue/i }).className).toMatch(
      /apply-continue-pulse/,
    );
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ApplyReadyContinue compact (<=1024px)", () => {
  it("portals the bar to the client shell outside theme-client-rise", () => {
    installMatchMedia(true);
    wrap(
      <div className="theme-client-rise" style={{ transform: "matrix(1, 0, 0, 1, 0, 0)" }}>
        <ApplyReadyContinue
          previousLabel="Previous"
          onPrevious={() => undefined}
          onClick={() => undefined}
        >
          I have these - Continue
        </ApplyReadyContinue>
      </div>,
    );
    const bar = document.querySelector("[data-apply-sticky-cta]") as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute("data-apply-sticky-cta-portal")).toBe("");
    expect(bar?.parentElement?.getAttribute("data-ui")).toBe("client");
    expect(bar?.closest(".theme-client-rise")).toBeNull();
    expect(bar?.hasAttribute("data-apply-sticky-cta-portal")).toBe(true);
    expect(bar?.style.position).toBe("fixed");
    expect(bar?.style.bottom).toBe("0px");
    expect(screen.getByRole("button", { name: "Previous" })).toHaveClass("self-start");
    expect(screen.getByRole("button", { name: "Previous" })).toHaveClass("text-start");
    expect(screen.getByRole("button", { name: /i have these - continue/i })).toHaveClass("w-full");
  });

  it("uses the compact media query inclusive of 1024px", () => {
    expect(APPLY_STICKY_CTA_MEDIA_QUERY).toBe("(max-width: 1024px)");
  });
});

describe("sticky Continue CSS contracts", () => {
  it("reserves scroll padding and disables pulse under reduced motion", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/html:has\(\[data-apply-sticky-cta\]\)/);
    expect(css).toMatch(/scroll-padding-bottom/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).toMatch(/a\[data-whatsapp-fab\]/);
    expect(css).toMatch(/@media \(max-width: 1024px\)/);
    expect(css).toMatch(/--apply-sticky-cta-height/);
    const rise = css.slice(css.indexOf("@keyframes theme-client-rise"));
    const toBlock = rise.slice(rise.indexOf("to {"), rise.indexOf("}", rise.indexOf("to {")) + 1);
    expect(toBlock).toMatch(/transform:\s*translate3d\(0,\s*0,\s*0\)/);
    expect(css).toMatch(/animation:\s*theme-client-rise[^;]*both/);
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
    const wizard = readFileSync(
      join(process.cwd(), "components/apply/draft/apply-document-wizard.tsx"),
      "utf8",
    );
    expect(wizard).toMatch(/docsReadyViewed/);
    expect(wizard).toMatch(/wizard\.continueWithDocuments/);
    expect(wizard).toMatch(/data-apply-ready-inline-previous/);
    expect(wizard).toMatch(/previousLabel/);
    expect(wizard).toMatch(/data-apply-ready-section/);
    expect(css).toMatch(/\[data-apply-sticky-cta-portal\]/);
    expect(css).toMatch(/\[data-apply-ready-inline-previous\]/);
    const applyPage = readFileSync(
      join(process.cwd(), "app/(client)/apply/applications/[id]/page.tsx"),
      "utf8",
    );
    expect(applyPage).toContain('contentClassName="theme-client-rise mx-auto w-full max-w-4xl space-y-8"');
  });
});

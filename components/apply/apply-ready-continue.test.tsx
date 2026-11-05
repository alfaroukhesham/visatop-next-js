/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplyJumpAheadProvider, useApplyJumpAhead } from "./apply-jump-ahead";
import { ApplyReadyContinue } from "./apply-ready-continue";

const wrap = (ui: ReactElement) => render(<ApplyJumpAheadProvider>{ui}</ApplyJumpAheadProvider>);

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

describe("ApplyReadyContinue", () => {
  it("is a full-width gold bar that is sticky on mobile and inline on desktop", () => {
    wrap(<ApplyReadyContinue onClick={() => undefined}>I have these - Continue</ApplyReadyContinue>);
    const bar = document.querySelector("[data-apply-sticky-cta]") as HTMLElement | null;
    expect(bar).toBeTruthy();
    expect(bar?.className).toMatch(/max-md:fixed/);
    expect(bar?.className).toMatch(/max-md:bottom-0/);
    expect(bar?.className).toMatch(/safe-area-inset-bottom/);
    expect(bar?.className).toMatch(/md:static/);
    expect(screen.getByRole("button", { name: /i have these - continue/i })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: /i have these - continue/i })).toHaveClass("normal-case");
  });

  it("pulses once when jump-ahead fires", async () => {
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

describe("sticky Continue CSS contracts", () => {
  it("reserves scroll padding and disables pulse under reduced motion", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/html:has\(\[data-apply-sticky-cta\]\)/);
    expect(css).toMatch(/scroll-padding-bottom/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).toMatch(/a\[data-whatsapp-fab\]/);
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
    const wizard = readFileSync(
      join(process.cwd(), "components/apply/draft/apply-document-wizard.tsx"),
      "utf8",
    );
    expect(wizard).toMatch(/docsReadyViewed/);
    expect(wizard).toMatch(/wizard\.continueWithDocuments/);
  });
});

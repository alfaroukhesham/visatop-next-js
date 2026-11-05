/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_LAST_STEP_LIVE_HINT } from "./use-admin-application-last-step";
import {
  AdminApplicationLastStepLive,
  AdminApplicationLastStepRow,
} from "./admin-application-last-step-row";

const initial = {
  fieldLabel: "Stopped at",
  value: "Passport upload",
  secondary: "2 hours ago · 11/5/2026, 4:00:00 PM",
};

describe("AdminApplicationLastStepRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows only the last-step label, value, and refresh control", () => {
    render(
      <AdminApplicationLastStepRow
        lastStep={initial}
        fetching={false}
        hintId="last-step-hint"
        onRefresh={() => undefined}
      />,
    );
    expect(screen.getByText("Stopped at")).toBeInTheDocument();
    expect(screen.getByText("Passport upload")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-describedby", "last-step-hint");
    expect(screen.queryByText(ADMIN_LAST_STEP_LIVE_HINT)).not.toBeInTheDocument();
    expect(screen.queryByText("2 hours ago · 11/5/2026, 4:00:00 PM")).not.toBeInTheDocument();
  });

  it("disables the refresh button and shows a reduced-motion-safe loading state while fetching", () => {
    render(
      <AdminApplicationLastStepRow
        lastStep={initial}
        fetching
        hintId="last-step-hint"
        onRefresh={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toBeDisabled();
    expect(button.querySelector(".motion-safe\\:animate-spin")).not.toBeNull();
    expect(button.querySelector(".animate-spin:not(.motion-safe\\:animate-spin)")).toBeNull();
  });

  it("invokes onRefresh when clicked", () => {
    const onRefresh = vi.fn();
    render(
      <AdminApplicationLastStepRow
        lastStep={initial}
        fetching={false}
        hintId="last-step-hint"
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("AdminApplicationLastStepLive", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the live hint under the grid and wires it to Refresh", () => {
    render(
      <AdminApplicationLastStepLive applicationId="app_demo_1" initial={initial}>
        <div>Nationality</div>
      </AdminApplicationLastStepLive>,
    );
    const hint = screen.getByText("Live applicants updates every 15 seconds");
    expect(hint.tagName).toBe("P");
    expect(hint.className).toContain("text-xs");
    expect(hint.className).toContain("text-muted-foreground");
    expect(hint.closest("dl")).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-describedby",
      hint.id,
    );
  });

  it("shows a muted stale cue next to the hint after a failed refresh", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    render(
      <AdminApplicationLastStepLive applicationId="app_demo_1" initial={initial}>
        <div>Nationality</div>
      </AdminApplicationLastStepLive>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.getByText("Live applicants updates every 15 seconds")).toBeInTheDocument();
  });
});

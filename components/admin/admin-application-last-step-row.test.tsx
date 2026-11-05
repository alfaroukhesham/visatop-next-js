/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_LAST_STEP_LIVE_HINT } from "./use-admin-application-last-step";
import { AdminApplicationLastStepRow } from "./admin-application-last-step-row";

const initial = {
  fieldLabel: "Stopped at",
  value: "Passport upload",
  secondary: "2 hours ago · 11/5/2026, 4:00:00 PM",
};

describe("AdminApplicationLastStepRow", () => {
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

  it("shows the last-step value, refresh control, and live helper text", () => {
    render(<AdminApplicationLastStepRow applicationId="app_demo_1" initial={initial} />);
    expect(screen.getByText("Stopped at")).toBeInTheDocument();
    expect(screen.getByText("Passport upload")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(screen.getByText(ADMIN_LAST_STEP_LIVE_HINT)).toBeInTheDocument();
    expect(screen.getByText("Live applicants updates every 15 seconds")).toBeInTheDocument();
  });

  it("disables the refresh button and shows a loading state while fetching", async () => {
    render(<AdminApplicationLastStepRow applicationId="app_demo_1" initial={initial} />);
    const button = screen.getByRole("button", { name: "Refresh" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });
});

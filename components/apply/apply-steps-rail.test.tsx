/** @vitest-environment jsdom */

import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import { ApplyJumpAheadProvider } from "./apply-jump-ahead";
import { ApplyStepsRail } from "./apply-steps-rail";

const en = getEnglishCustomerMessages();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      <ApplyJumpAheadProvider>{ui}</ApplyJumpAheadProvider>
    </CustomerI18nProvider>,
  );

afterEach(() => {
  cleanup();
});

describe("ApplyStepsRail on documents (ready)", () => {
  it("does not link Trip to marketing home and keeps the current step non-navigable", () => {
    wrap(
      <ApplyStepsRail
        currentStep={3}
        phase="documents"
        applicationId="app-1"
        tripHref="/apply/start?nationality=IN"
      />,
    );

    expect(screen.getByText(/Step 2 of 5/)).toHaveTextContent("Documents");
    expect(screen.getByText("Docs")).toHaveClass("sm:hidden");
    expect(screen.getAllByText("Documents").some((el) => el.className.includes("hidden sm:inline"))).toBe(
      true,
    );
    const trip = screen.getByRole("link", { name: /trip, completed/i });
    expect(trip).toHaveAttribute("href", "/apply/start?nationality=IN");
    expect(trip.getAttribute("href")).not.toBe("/");
    expect(trip.getAttribute("href")).not.toContain("/visa-processing");

    expect(screen.queryByRole("link", { name: /^documents$/i })).not.toBeInTheDocument();
    const current = screen.getByText("2").closest("[aria-current='step']");
    expect(current).toBeTruthy();
    expect(current?.tagName).not.toBe("A");
    expect(current?.tagName).toBe("BUTTON");
  });

  it("announces a persistent jump-ahead hint when an upcoming step is tapped", async () => {
    const user = userEvent.setup();
    wrap(
      <ApplyStepsRail
        currentStep={3}
        phase="documents"
        applicationId="app-1"
        tripHref="/apply/start?nationality=IN"
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /details/i }));
    const hint = screen.getByRole("status");
    expect(hint).toHaveAttribute("aria-live", "polite");
    expect(hint).toHaveTextContent(/finish this step first/i);
    expect(screen.getByRole("button", { name: /details/i })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: /pay/i })).not.toBeInTheDocument();
  });

  it("shows the same jump-ahead hint when the current step is tapped", async () => {
    const user = userEvent.setup();
    wrap(
      <ApplyStepsRail
        currentStep={3}
        phase="documents"
        applicationId="app-1"
        tripHref="/apply/start?nationality=IN"
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByText("2").closest("[aria-current='step']") as HTMLElement);
    const hint = screen.getByRole("status");
    expect(hint).toHaveTextContent(/finish this step first/i);
    await user.click(hint);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not invent a home link when tripHref is missing", () => {
    wrap(<ApplyStepsRail currentStep={3} phase="documents" applicationId="app-1" />);
    expect(screen.queryByRole("link", { name: /trip/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link").some((link) => link.getAttribute("href") === "/")).toBe(false);
  });
});

/** @vitest-environment jsdom */

import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { DEFAULT_APPLY_PRICE_BADGES } from "@/lib/apply/apply-config";
import type { IService } from "@/components/apply/guided-visa-chooser";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { SelectedVisaSummary } from "@/components/apply/start-application-form";

const en = getEnglishCustomerMessages();

const service = (name: string, entries: "single" | "multiple"): IService => ({
  id: name,
  name,
  durationDays: 30,
  entries,
  displayPriceMinor: "81400",
  currency: "AED",
  stayBucket: "15_30",
  entryKind: entries,
  travelerKind: "adult",
  showInGuidedChooser: true,
});

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      {ui}
    </CustomerI18nProvider>,
  );

const multiple = service("30 Days - Multiple Entry", "multiple");

describe("SelectedVisaSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps one title and the entry fact when travellers share a visa", () => {
    wrap(
      <SelectedVisaSummary
        service={multiple}
        answers={{ stay: "15_30", entry: "multiple", kind: "adult" }}
        travelerCount={2}
        totalText="AED 162.80"
        price={{ text: "AED 81.40", isEstimate: false }}
        badges={DEFAULT_APPLY_PRICE_BADGES}
      />,
    );
    expect(screen.getByRole("heading", { name: "30 Days - Multiple Entry" })).toBeInTheDocument();
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getByText("Multiple")).toBeInTheDocument();
    expect(screen.getByText("Stay")).toBeInTheDocument();
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it("lists each visa with a count and drops the shared entry fact when visas differ", () => {
    wrap(
      <SelectedVisaSummary
        service={multiple}
        answers={{ stay: "15_30", entry: "multiple", kind: "adult" }}
        travelerCount={2}
        totalText="AED 151.40"
        price={{ text: "AED 81.40", isEstimate: false }}
        badges={DEFAULT_APPLY_PRICE_BADGES}
        mixedVisaLines={[
          { key: "multi", label: "30 Days - Multiple Entry", count: 1, amount: "AED 81.40" },
          { key: "single", label: "30 Days - Single Entry", count: 1, amount: "AED 70.00" },
        ]}
      />,
    );
    expect(screen.queryByRole("heading", { name: "30 Days - Multiple Entry" })).not.toBeInTheDocument();
    expect(screen.queryByText("Entry")).not.toBeInTheDocument();
    expect(screen.queryByText("Stay")).not.toBeInTheDocument();
    expect(screen.getByText("Travelers")).toBeInTheDocument();
    const multipleLine = screen.getByText("30 Days - Multiple Entry");
    const singleLine = screen.getByText("30 Days - Single Entry");
    expect(multipleLine.parentElement?.textContent).toContain("30 Days - Multiple Entry\u00a0×\u00a01");
    expect(singleLine.parentElement?.textContent).toContain("30 Days - Single Entry\u00a0×\u00a01");
    expect(screen.getByText("AED 151.40")).toBeInTheDocument();
  });
});

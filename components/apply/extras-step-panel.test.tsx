/** @vitest-environment jsdom */

import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";
import { ExtrasStepPanel } from "./extras-step-panel";

const en = getEnglishCustomerMessages();

const installMatchMedia = (width: number) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const max = query.match(/max-width:\s*(\d+)/);
      const matches = max ? width <= Number(max[1]) : false;
      return {
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };
    },
  });
};

const previewFor = (selected: boolean, travellers: number): TClientQuotePreview => {
  const insuranceUnit = 7900;
  const visa = 81400 * travellers;
  const fast = 36725 * travellers;
  const insurance = selected ? insuranceUnit * travellers : 0;
  return {
    currency: "AED",
    todayUae: "2026-11-25",
    maxTravelDate: "2027-05-24",
    travelDateRequired: true,
    thresholdDays: 4,
    travelDate: "2026-11-25",
    daysUntilTravel: 0,
    recommendFastTrack: false,
    processingSpeed: "fast_track",
    processingSpeedSource: "customer",
    locked: false,
    travellerCount: travellers,
    visaLines: Array.from({ length: travellers }, (_, index) => ({
      applicationId: `app-${index}`,
      serviceId: "svc",
      amountMinor: "81400",
    })),
    extraLines: [
      ...Array.from({ length: travellers }, (_, index) => ({
        key: "fast_track" as const,
        applicationId: `app-${index}`,
        amountMinor: "36725",
      })),
      ...(selected
        ? Array.from({ length: travellers }, (_, index) => ({
            key: "travel_insurance" as const,
            applicationId: `app-${index}`,
            amountMinor: String(insuranceUnit),
          }))
        : []),
    ],
    availableExtras: [
      {
        key: "travel_insurance",
        unitAmountMinor: String(insuranceUnit),
        travellerCount: travellers,
        sumAmountMinor: String(insuranceUnit * travellers),
        selected,
        chargeBasis: "per_traveller",
        labelI18n: { en: "Travel insurance" },
        descriptionI18n: { en: "Medical cover for the trip." },
        promiseI18n: null,
        termsUrl: null,
      },
      {
        key: "fast_track",
        unitAmountMinor: "36725",
        travellerCount: travellers,
        sumAmountMinor: String(fast),
        selected: true,
        chargeBasis: "per_traveller",
        labelI18n: { en: "Fast Track" },
        descriptionI18n: {},
        promiseI18n: { en: "within 24 hours" },
        termsUrl: null,
      },
    ],
    visaAmountMinor: String(visa),
    extrasAmountMinor: String(fast + insurance),
    totalAmountMinor: String(visa + fast + insurance),
  };
};

const wrap = (ui: ReactElement) =>
  render(
    <div data-ui="client">
      <CustomerI18nProvider locale="en" messages={en} fallback={en}>
        {ui}
      </CustomerI18nProvider>
    </div>,
  );

const renderPanel = (travellers: number, selected = false, termsUrl: string | null = null) => {
  const onInsurance = vi.fn();
  const onSkip = vi.fn();
  const preview = previewFor(selected, travellers);
  const insurance = preview.availableExtras.find((extra) => extra.key === "travel_insurance");
  if (insurance) insurance.termsUrl = termsUrl;
  wrap(
    <ExtrasStepPanel
      preview={preview}
      visaNames={["30-day tourist visa"]}
      loading={false}
      updating={false}
      updateError={null}
      priceChanged={false}
      locked={false}
      announcement={null}
      backHref="/back"
      onInsurance={onInsurance}
      onContinue={vi.fn()}
      onSkip={onSkip}
      onRetry={vi.fn()}
      onCancelCheckout={vi.fn()}
    />,
  );
  return { onInsurance, onSkip };
};

afterEach(() => {
  cleanup();
});

describe("Extras step", () => {
  it("uses one party checkbox, a terms link outside the label, and one continue button", async () => {
    installMatchMedia(1280);
    const user = userEvent.setup();
    const { onInsurance, onSkip } = renderPanel(2);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).not.toBeChecked();
    expect(screen.getByText("Add travel insurance for all travellers").closest("label")).toContainElement(
      boxes[0]!,
    );
    expect(screen.queryByRole("link", { name: /read the policy terms/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("Add travel insurance for all travellers").parentElement?.textContent ?? "",
    ).toMatch(/AED\s*79\.00 per traveller ×\s*2\s*=\s*AED\s*158\.00/);
    expect(screen.getByText("Not added")).toBeInTheDocument();
    expect(screen.getByText("30-day tourist visa").closest("bdi")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Continue to payment" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Continue" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Continue without extras" })).toHaveLength(2);
    expect(screen.getByTestId("extras-inline-cta")).toHaveClass("hidden");
    expect(screen.getByTestId("extras-sticky-bar")).toHaveClass("min-[1025px]:hidden");
    await user.click(boxes[0]!);
    expect(onInsurance).toHaveBeenCalledWith(true);
    await user.click(screen.getAllByRole("button", { name: "Continue without extras" })[0]!);
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("shows the terms link only when a URL is set", () => {
    installMatchMedia(1280);
    renderPanel(1, false, "https://example.com/terms");
    const terms = screen.getByRole("link", { name: /read the policy terms/i });
    expect(terms).toHaveAttribute("href", "https://example.com/terms");
    expect(terms.closest("label")).toBeNull();
  });

  it("hides the policy terms link when the URL is empty or a placeholder", () => {
    installMatchMedia(1280);
    for (const termsUrl of ["", "   ", "/terms-placeholder", "https://example.com/terms-placeholder"]) {
      renderPanel(1, false, termsUrl);
      expect(screen.queryByRole("link", { name: /read the policy terms/i })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /add travel insurance/i })).toBeInTheDocument();
      expect(screen.getByText("Medical cover for the trip.")).toBeInTheDocument();
      cleanup();
    }
  });

  it("prices one traveller without a times-n line", () => {
    installMatchMedia(1280);
    renderPanel(1);
    expect(screen.getByText("Add travel insurance")).toBeInTheDocument();
    expect(screen.getByText(/for 1 traveller/)).toBeInTheDocument();
    expect(screen.queryByText(/per traveller ×/)).not.toBeInTheDocument();
  });
});

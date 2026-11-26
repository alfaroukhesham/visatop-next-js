/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => {
    const copy: Record<string, string> = {
      "payment.orderTitle": "Your order",
      "extras.recap.insurance": "Travel insurance",
      "extras.recap.added": "Added",
      "extras.recap.notAdded": "Not added",
      "extras.changeExtras": "Change extras",
      "extras.noExtras": "No extras added",
      "extras.arrivalLabel": "Arrival in the UAE",
      "extras.notSet": "Not set",
      "speed.readonly.standard": "Processing: Standard (3 working days)",
      "speed.readonly.fast": "Processing: Fast Track (within 24 hours)",
      "extras.recap.visa": "Visa",
      "extras.recap.fastTrack": "Fast Track processing",
      "extras.recap.total": "Total",
      "extras.locked": "Locked",
    };
    return copy[key] ?? key;
  },
  useCustomerLocale: () => "en",
}));

import { PayOrderSummary } from "@/components/apply/pay-order-summary";

const preview = (): TClientQuotePreview => ({
  currency: "NGN",
  todayUae: "2026-11-26",
  maxTravelDate: "2027-05-26",
  travelDateRequired: false,
  thresholdDays: 4,
  travelDate: "2026-12-05",
  daysUntilTravel: 9,
  recommendFastTrack: false,
  processingSpeed: "standard",
  processingSpeedSource: "customer",
  locked: false,
  travellerCount: 1,
  visaLines: [{ applicationId: "app-1", serviceId: "svc-1", amountMinor: "33245000" }],
  extraLines: [{ key: "travel_insurance", applicationId: "app-1", amountMinor: "2968900" }],
  availableExtras: [
    {
      key: "travel_insurance",
      unitAmountMinor: "2968900",
      travellerCount: 1,
      sumAmountMinor: "2968900",
      selected: true,
      chargeBasis: "per_traveller",
      labelI18n: { en: "Travel insurance" },
      descriptionI18n: {},
      promiseI18n: null,
      termsUrl: null,
    },
  ],
  visaAmountMinor: "33245000",
  extrasAmountMinor: "2968900",
  totalAmountMinor: "36213900",
});

describe("PayOrderSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps insurance, processing, and arrival on one label/value grid", () => {
    render(
      <PayOrderSummary applicationId="app-1" visaNames={["14 Days - Single Entry"]} previewOverride={preview()} />,
    );
    expect(screen.getByTestId("pay-order").className).toMatch(/lg:hidden/);
    const card = document.querySelector("[data-testid='pay-order'] .grid");
    expect(card).toBeTruthy();
    expect(card?.className).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\]/);
    expect(screen.getByText("Total")).toBeTruthy();
    const change = screen.getByText("Change extras");
    expect(change.parentElement?.className).toMatch(/flex/);
    expect(change.parentElement?.className).not.toMatch(/flex-col/);
    expect(change.parentElement?.textContent).toMatch(/NGN/);
    const speed = screen.getByTestId("processing-speed-line");
    expect(speed.parentElement).toBe(card);
    expect(speed.textContent).toBe("Processing:");
    expect(speed.nextElementSibling?.textContent).toBe("Standard (3 working days)");
    expect(screen.getByText("Arrival in the UAE:").parentElement).toBe(card);
  });
});

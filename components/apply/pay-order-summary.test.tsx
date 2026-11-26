/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
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
      "payment.tripDetailsTitle": "Trip details",
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

  it("hides only the duplicate lines at lg and keeps processing, arrival, and change extras", () => {
    render(
      <PayOrderSummary applicationId="app-1" visaNames={["14 Days - Single Entry"]} previewOverride={preview()} />,
    );
    const section = screen.getByTestId("pay-order");
    expect(section.className).not.toMatch(/lg:hidden/);
    const lines = screen.getByTestId("pay-order-lines");
    expect(lines.className).toMatch(/lg:hidden/);
    const card = document.querySelector("[data-testid='pay-order'] .grid");
    expect(card).toBeTruthy();
    expect(card?.className).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\]/);
    expect(card?.className).toMatch(/lg:max-w-md/);
    expect(card?.className).toMatch(/lg:grid-cols-\[auto_1fr\]/);
    expect(screen.getByText("Your order").className).toMatch(/lg:hidden/);
    expect(screen.getByText("Trip details").className).toMatch(/hidden/);
    expect(screen.getByText("Trip details").className).toMatch(/lg:inline/);
    const total = screen.getByText("Total");
    const totalRow = screen.getByTestId("pay-order-total");
    expect(lines.contains(total)).toBe(false);
    expect(totalRow.contains(total)).toBe(true);
    expect(totalRow.className).toMatch(/lg:hidden/);
    expect(totalRow.parentElement?.lastElementChild).toBe(totalRow);
    expect(total.className).toMatch(/font-bold/);
    expect(total.className).not.toMatch(/font-semibold|font-heading/);
    const totalAmount = total.nextElementSibling;
    expect(totalAmount?.className).toMatch(/font-bold/);
    expect(totalAmount?.className).not.toMatch(/font-heading/);
    const change = screen.getByRole("link", { name: "Change extras" });
    expect(change.className).toMatch(/inline-flex/);
    expect(change.className).toMatch(/min-h-11/);
    expect(lines.contains(change)).toBe(false);
    expect(change.parentElement?.textContent).not.toMatch(/NGN/);
    const extras = screen.getByTestId("pay-order-extras");
    expect(extras.contains(change)).toBe(true);
    expect(extras.compareDocumentPosition(totalRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(extras.className).toMatch(/lg:contents/);
    expect(extras.textContent).toMatch(/Added/);
    expect(extras.textContent).not.toMatch(/NGN/);
    const insurance = within(lines).getByText(/Travel insurance/);
    expect(insurance.closest("div")?.textContent).toMatch(/NGN/);
    expect(insurance.closest("div")?.textContent).not.toMatch(/Change extras/);
    const speed = screen.getByTestId("processing-speed-line");
    expect(lines.contains(speed)).toBe(false);
    expect(speed.parentElement).toBe(card);
    expect(speed.textContent).toBe("Processing:");
    expect(speed.nextElementSibling?.textContent).toBe("Standard (3 working days)");
    const arrival = screen.getByText("Arrival in the UAE:");
    expect(lines.contains(arrival)).toBe(false);
    expect(arrival.parentElement).toBe(card);
  });
});

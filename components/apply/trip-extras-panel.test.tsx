/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string, vars?: Record<string, string | number>) => {
    if (!vars) return key;
    return Object.entries(vars).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      key,
    );
  },
  useCustomerLocale: () => "en",
}));

import { TripExtrasPanel } from "@/components/apply/trip-extras-panel";

const fastTrack = {
  key: "fast_track" as const,
  unitAmountMinor: "36725",
  travellerCount: 1,
  sumAmountMinor: "36725",
  selected: true,
  chargeBasis: "per_traveller" as const,
  labelI18n: {},
  descriptionI18n: {},
  promiseI18n: null,
  termsUrl: null,
};

const insurance = {
  key: "travel_insurance" as const,
  unitAmountMinor: "7900",
  travellerCount: 1,
  sumAmountMinor: "7900",
  selected: false,
  chargeBasis: "per_traveller" as const,
  labelI18n: {},
  descriptionI18n: { en: "Medical cover for the trip" },
  promiseI18n: null,
  termsUrl: "https://example.com/policy",
};

const preview = (patch: Partial<TClientQuotePreview> = {}): TClientQuotePreview => ({
  currency: "AED",
  todayUae: "2026-11-24",
  maxTravelDate: "2027-05-23",
  travelDateRequired: true,
  thresholdDays: 4,
  travelDate: "2026-11-26",
  daysUntilTravel: 2,
  recommendFastTrack: true,
  processingSpeed: "fast_track",
  processingSpeedSource: "system",
  locked: false,
  travellerCount: 1,
  visaLines: [],
  extraLines: [],
  availableExtras: [fastTrack],
  visaAmountMinor: "35000",
  extrasAmountMinor: "36725",
  totalAmountMinor: "71725",
  ...patch,
});

const renderPanel = (value: TClientQuotePreview, locked = false) =>
  render(
    <TripExtrasPanel
      preview={value}
      locked={locked}
      paying={false}
      switchedBack={false}
      announceNote={false}
      updateError={null}
      onSpeed={() => undefined}
      onInsurance={() => undefined}
      onInsuranceAll={() => undefined}
      onSaveDate={() => false}
      onRetry={() => undefined}
      onCancelCheckout={() => undefined}
      onDateBlocksPay={() => undefined}
    />,
  );

describe("TripExtrasPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows fast track and insurance only when the quote lists them", () => {
    const { unmount } = renderPanel(preview({ availableExtras: [fastTrack, insurance] }));
    expect(screen.getByRole("radio", { name: /extras.speed.fast.title/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /extras.insurance.add/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /extras.insurance.terms/ })).toHaveAttribute(
      "href",
      "https://example.com/policy",
    );
    unmount();

    renderPanel(preview({ availableExtras: [insurance], recommendFastTrack: false, processingSpeed: "standard" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /extras.insurance.add/ })).not.toBeChecked();
  });

  it("keeps Standard selected and badges Fast Track when the trip is soon", () => {
    renderPanel(preview());
    expect(screen.getByRole("radio", { name: /extras.speed.standard.title/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /extras.speed.fast.title/ })).toBeEnabled();
    expect(screen.getByText("extras.speed.badge")).toBeInTheDocument();
    expect(screen.getByText("extras.notes.soon")).toBeInTheDocument();
  });

  it("does not block pay when the required flag is on and there is no date", () => {
    const onDateBlocksPay = vi.fn();
    render(
      <TripExtrasPanel
        preview={preview({
          travelDate: null,
          daysUntilTravel: null,
          travelDateRequired: true,
          recommendFastTrack: false,
        })}
        locked={false}
        paying={false}
        switchedBack={false}
        announceNote={false}
        updateError={null}
        onSpeed={() => undefined}
        onInsurance={() => undefined}
        onInsuranceAll={() => undefined}
        onSaveDate={() => false}
        onRetry={() => undefined}
        onCancelCheckout={() => undefined}
        onDateBlocksPay={onDateBlocksPay}
      />,
    );
    expect(onDateBlocksPay).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("start.travelDate.errorEmpty")).not.toBeInTheDocument();
  });

  it("locks the extras and shows the cancel note for a frozen checkout", () => {
    renderPanel(preview(), true);
    expect(screen.getByRole("radio", { name: /extras.speed.fast.title/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /extras.speed.standard.title/ })).toBeDisabled();
    expect(screen.getByText("extras.locked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "payment.cancelAndReset" })).toBeInTheDocument();
  });
});

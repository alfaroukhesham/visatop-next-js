/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => key,
  useCustomerLocale: () => "en",
}));

vi.mock("@/lib/portal/fetch-envelope", () => ({
  fetchApiEnvelope: vi.fn(),
}));

import { CheckoutQuoteProvider, useCheckoutQuoteOptional } from "@/components/apply/checkout-quote-provider";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

const fetchMock = vi.mocked(fetchApiEnvelope);

const preview = (patch: Partial<TClientQuotePreview> = {}): TClientQuotePreview => ({
  currency: "AED",
  todayUae: "2026-11-24",
  maxTravelDate: "2027-05-23",
  travelDateRequired: true,
  thresholdDays: 4,
  travelDate: "2026-11-26",
  daysUntilTravel: 2,
  recommendFastTrack: true,
  processingSpeed: "standard",
  processingSpeedSource: "customer",
  locked: false,
  travellerCount: 1,
  visaLines: [{ applicationId: "app-1", serviceId: "svc", amountMinor: "10000" }],
  extraLines: [],
  availableExtras: [
    {
      key: "fast_track",
      unitAmountMinor: "5000",
      travellerCount: 1,
      sumAmountMinor: "5000",
      selected: false,
      chargeBasis: "per_traveller",
      labelI18n: {},
      descriptionI18n: {},
      promiseI18n: null,
      termsUrl: null,
    },
  ],
  visaAmountMinor: "10000",
  extrasAmountMinor: "0",
  totalAmountMinor: "10000",
  ...patch,
});

const Probe = () => {
  const quote = useCheckoutQuoteOptional();
  return (
    <>
      <span data-testid="speed">{quote?.preview?.processingSpeed ?? ""}</span>
      <span data-testid="locked">{String(Boolean(quote?.locked))}</span>
      <span data-testid="error">{quote?.updateError ?? ""}</span>
      <button type="button" onClick={() => void quote?.patchTrip({ processingSpeed: "fast_track" })}>
        ft
      </button>
      <button type="button" onClick={() => void quote?.patchTrip({ processingSpeed: "standard" })}>
        std
      </button>
      <button type="button" onClick={() => quote?.registerCancelCheckout(async () => true)}>
        register
      </button>
      <button type="button" onClick={() => quote?.cancelCheckout()}>
        cancel
      </button>
    </>
  );
};

describe("checkout quote provider", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("unlocks a loaded lock after cancel succeeds and the preview is refetched", async () => {
    let loads = 0;
    fetchMock.mockImplementation(async (url: string) => {
      loads += 1;
      return {
        ok: true,
        status: 200,
        requestId: String(loads),
        data: preview({ locked: !String(url).includes("quote-preview") || loads === 1 }),
      };
    });

    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <Probe />
      </CheckoutQuoteProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "register" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("false"));
    expect(loads).toBeGreaterThanOrEqual(2);
  });

  it("restores the last saved speed when Fast Track then Standard fails", async () => {
    let patches = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("quote-preview")) {
        return { ok: true, status: 200, requestId: "load", data: preview() };
      }
      patches += 1;
      if (patches === 1) {
        return await new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      return {
        ok: false,
        status: 400,
        requestId: "fail",
        error: {
          code: "VALIDATION_ERROR",
          message: "Fast Track is not available for this currency.",
          details: { reason: "fast_track_unavailable" },
        },
      };
    });

    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <Probe />
      </CheckoutQuoteProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("speed").textContent).toBe("standard"));
    fireEvent.click(screen.getByRole("button", { name: "ft" }));
    fireEvent.click(screen.getByRole("button", { name: "std" }));
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("extras.error.fastTrackUnavailable"),
    );
    expect(screen.getByTestId("speed").textContent).toBe("standard");
  });
});

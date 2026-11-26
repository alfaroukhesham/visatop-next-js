/** @vitest-environment jsdom */

import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

vi.mock("@/components/client/customer-i18n-provider", () => {
  const t = (key: string) => key;
  return {
    useCustomerT: () => t,
    useCustomerLocale: () => "en",
  };
});

vi.mock("@/lib/portal/fetch-envelope", () => ({
  fetchApiEnvelope: vi.fn(),
}));

import { CheckoutQuoteProvider, useCheckoutQuoteOptional } from "@/components/apply/checkout-quote-provider";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { useRefreshQuoteWhenCheckoutEnds } from "@/components/apply/use-refresh-quote-when-checkout-ends";

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

const TermsProbe = () => {
  const quote = useCheckoutQuoteOptional();
  return (
    <>
      <span data-testid="terms-key">{String(quote?.termsResetKey ?? "")}</span>
      <span data-testid="locked">{String(Boolean(quote?.locked))}</span>
      <span data-testid="total">{quote?.preview?.totalAmountMinor ?? ""}</span>
      <button type="button" onClick={() => quote?.refreshQuote()}>
        refresh
      </button>
      <button type="button" onClick={() => void quote?.patchTrip({ processingSpeed: "fast_track" })}>
        ft
      </button>
    </>
  );
};

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
      <button type="button" onClick={() => quote?.refreshQuote()}>
        refresh
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

const Session = ({ mode }: { mode: "poll" | "cancel" }) => {
  const quote = useCheckoutQuoteOptional();
  const [status, setStatus] = useState("checkout_created");
  useRefreshQuoteWhenCheckoutEnds(status, quote?.refreshQuote);
  return (
    <>
      <span data-testid="locked">{String(Boolean(quote?.locked))}</span>
      <button type="button" onClick={() => setStatus("unpaid")}>
        session-end
      </button>
      <button
        type="button"
        onClick={() =>
          quote?.registerCancelCheckout(async () => {
            setStatus("unpaid");
            return true;
          })
        }
      >
        register
      </button>
      <button type="button" onClick={() => quote?.cancelCheckout()}>
        cancel
      </button>
      <span data-testid="mode">{mode}</span>
    </>
  );
};

const lockedPreviewLoads = () => {
  let loads = 0;
  fetchMock.mockImplementation(async () => {
    loads += 1;
    return {
      ok: true as const,
      status: 200,
      requestId: String(loads),
      data: preview({ locked: loads === 1 }),
    };
  });
  return () => loads;
};

describe("checkout quote provider", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
  });

  it("unlocks once when the countdown or poll sees the checkout session end", async () => {
    const loads = lockedPreviewLoads();
    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <Session mode="poll" />
      </CheckoutQuoteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("true"));
    expect(loads()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "session-end" }));
    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("false"));
    expect(loads()).toBe(2);
  });

  it("does not fetch a second quote when the cancel button ends the same session", async () => {
    const loads = lockedPreviewLoads();
    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <Session mode="cancel" />
      </CheckoutQuoteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "register" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("false"));
    expect(loads()).toBe(2);
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

  it("keeps a newer saved speed when an older quote refresh returns later", async () => {
    let previewCalls = 0;
    let releaseSlow: (value: { ok: true; status: number; requestId: string; data: TClientQuotePreview }) => void =
      () => {};
    const slow = new Promise<{ ok: true; status: number; requestId: string; data: TClientQuotePreview }>(
      (resolve) => {
        releaseSlow = resolve;
      },
    );
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("quote-preview")) {
        previewCalls += 1;
        if (previewCalls === 1) {
          return { ok: true, status: 200, requestId: "load", data: preview() };
        }
        return slow;
      }
      return {
        ok: true,
        status: 200,
        requestId: "patch",
        data: preview({
          processingSpeed: "fast_track",
          processingSpeedSource: "customer",
          totalAmountMinor: "15000",
        }),
      };
    });

    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <Probe />
      </CheckoutQuoteProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("speed").textContent).toBe("standard"));
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "ft" }));
    await waitFor(() => expect(screen.getByTestId("speed").textContent).toBe("fast_track"));
    releaseSlow({
      ok: true,
      status: 200,
      requestId: "stale",
      data: preview({ processingSpeed: "standard", totalAmountMinor: "10000" }),
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("speed").textContent).toBe("fast_track");
  });

  it("does not reset Terms on refreshQuote, including a locked quote with a different total", async () => {
    let loads = 0;
    fetchMock.mockImplementation(async () => {
      loads += 1;
      return {
        ok: true as const,
        status: 200,
        requestId: String(loads),
        data: preview({
          locked: loads > 1,
          totalAmountMinor: loads > 1 ? "18000" : "10000",
        }),
      };
    });
    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <TermsProbe />
      </CheckoutQuoteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("10000"));
    expect(screen.getByTestId("terms-key").textContent).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("18000"));
    expect(screen.getByTestId("locked").textContent).toBe("true");
    expect(screen.getByTestId("terms-key").textContent).toBe("0");
  });

  it("resets Terms when a saved quote changes a visible unit price or the total", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("quote-preview")) {
        return { ok: true as const, status: 200, requestId: "load", data: preview() };
      }
      return {
        ok: true as const,
        status: 200,
        requestId: "patch",
        data: preview({ processingSpeed: "fast_track", totalAmountMinor: "15000" }),
      };
    });
    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <TermsProbe />
      </CheckoutQuoteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("10000"));
    fireEvent.click(screen.getByRole("button", { name: "ft" }));
    await waitFor(() => expect(screen.getByTestId("terms-key").textContent).toBe("1"));
    expect(screen.getByTestId("total").textContent).toBe("15000");
  });

  it("does not reset Terms when a saved quote only changes locked", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("quote-preview")) {
        return { ok: true as const, status: 200, requestId: "load", data: preview() };
      }
      return {
        ok: true as const,
        status: 200,
        requestId: "patch",
        data: preview({ locked: true }),
      };
    });
    render(
      <CheckoutQuoteProvider applicationId="app-1">
        <TermsProbe />
      </CheckoutQuoteProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("10000"));
    fireEvent.click(screen.getByRole("button", { name: "ft" }));
    await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("true"));
    expect(screen.getByTestId("terms-key").textContent).toBe("0");
    expect(screen.getByTestId("total").textContent).toBe("10000");
  });
});

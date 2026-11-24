/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string, vars?: Record<string, string>) => {
    if (key === "wizard.orderTotal") return `Order total ${vars?.total ?? ""}`;
    return key;
  },
  useCustomerLocale: () => "en",
}));

vi.mock("@/lib/portal/fetch-envelope", () => ({
  fetchApiEnvelope: vi.fn(),
}));

import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { ApplyOrderTotal } from "./apply-order-total";

describe("ApplyOrderTotal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("quotes the selected local currency instead of forcing USD or AED", async () => {
    vi.mocked(fetchApiEnvelope).mockResolvedValue({
      ok: true,
      status: 200,
      requestId: "t1",
      data: {
        services: [{ id: "svc-1", displayPriceMinor: "18500000", currency: "NGN" }],
      },
    });

    render(<ApplyOrderTotal nationalityCode="NG" currency="NGN" serviceIds={["svc-1"]} />);

    await waitFor(() =>
      expect(screen.getByText(/Order total NGN[\s\u00a0]?185,000\.00/)).toBeTruthy(),
    );
    expect(fetchApiEnvelope).toHaveBeenCalledWith(expect.stringContaining("currency=NGN"));
    expect(fetchApiEnvelope).not.toHaveBeenCalledWith(expect.stringContaining("currency=USD"));
  });

  it("uses the server quote total, including extras, for the in-page order total", async () => {
    vi.mocked(fetchApiEnvelope).mockImplementation(async (url: string) => {
      if (url.includes("quote-preview")) {
        return {
          ok: true,
          status: 200,
          requestId: "t2",
          data: {
            currency: "NGN",
            totalAmountMinor: "20000000",
            extraLines: [{ key: "travel_insurance", applicationId: "app-1", amountMinor: "1500000" }],
            availableExtras: [{ key: "travel_insurance" }],
          },
        };
      }
      return {
        ok: true,
        status: 200,
        requestId: "t1",
        data: {
          services: [{ id: "svc-1", displayPriceMinor: "18500000", currency: "NGN" }],
        },
      };
    });

    render(
      <ApplyOrderTotal
        applicationId="app-1"
        nationalityCode="NG"
        currency="NGN"
        serviceIds={["svc-1"]}
      />,
    );

    await waitFor(() => expect(screen.getByText(/Order total NGN[\s\u00a0]?200,000\.00/)).toBeTruthy());
    expect(screen.queryByText(/185,000\.00/)).toBeNull();
  });
});

/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string, vars?: Record<string, string>) => {
    if (key === "wizard.orderTotal") return `Order total ${vars?.total ?? ""}`;
    return key;
  },
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
});

/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/portal/fetch-envelope", () => ({
  fetchApiEnvelope: vi.fn(),
}));

import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { LocalCurrenciesPanel } from "./local-currencies-panel";

const nationalities = [
  { code: "NG", name: "Nigeria", dialCode: "+234", enabled: true },
  { code: "ZA", name: "South Africa", dialCode: "+27", enabled: true },
];

const ngn = {
  code: "NGN",
  enabled: true,
  nationalityCodes: ["NG"],
  nationalities: [{ code: "NG", name: "Nigeria" }],
};

const zar = {
  code: "ZAR",
  enabled: true,
  nationalityCodes: ["ZA"],
  nationalities: [{ code: "ZA", name: "South Africa" }],
};

const unlinked = {
  code: "XXX",
  enabled: true,
  nationalityCodes: [] as string[],
  nationalities: [] as Array<{ code: string; name: string }>,
};

describe("LocalCurrenciesPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchApiEnvelope).mockImplementation(async (url) => {
      const href = typeof url === "string" ? url : String(url);
      if (href.includes("/ZAR/") && href.includes("nationality=NG")) {
        return {
          ok: false,
          status: 400,
          requestId: "req",
          error: {
            code: "VALIDATION_ERROR",
            message: "Choose a nationality linked to this local currency.",
          },
        };
      }
      return {
        ok: true,
        status: 200,
        requestId: "req",
        data: { rows: [] },
      };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads prices for the linked nationality when selecting an existing currency", async () => {
    render(
      <LocalCurrenciesPanel localCurrencies={[ngn, zar]} nationalities={nationalities} canWrite={false} />,
    );

    await waitFor(() =>
      expect(fetchApiEnvelope).toHaveBeenCalledWith(expect.stringContaining("nationality=NG")),
    );

    const zarButton = screen.getAllByRole("button").find((el) => el.textContent?.includes("ZAR"));
    expect(zarButton).toBeTruthy();
    fireEvent.click(zarButton!);

    await waitFor(() =>
      expect(fetchApiEnvelope).toHaveBeenCalledWith(expect.stringContaining("nationality=ZA")),
    );
    expect(screen.queryByText("Choose a nationality linked to this local currency.")).not.toBeInTheDocument();
  });

  it("shows the banner when the currency has no linked nationalities", async () => {
    render(
      <LocalCurrenciesPanel localCurrencies={[unlinked]} nationalities={nationalities} canWrite={false} />,
    );

    expect(
      await screen.findByText("Choose a nationality linked to this local currency."),
    ).toBeInTheDocument();
    expect(fetchApiEnvelope).not.toHaveBeenCalled();
  });
});
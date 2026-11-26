/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicApplication } from "@/lib/applications/public-application";
import type { TPublicPartyMember } from "@/lib/applications/load-party-members";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

const preview: TClientQuotePreview = {
  currency: "AED",
  todayUae: "2026-11-26",
  maxTravelDate: "2027-05-26",
  travelDateRequired: false,
  thresholdDays: 4,
  travelDate: "2026-12-05",
  daysUntilTravel: 9,
  recommendFastTrack: false,
  processingSpeed: "standard",
  processingSpeedSource: "system",
  locked: false,
  travellerCount: 2,
  visaLines: [
    { applicationId: "app-1", serviceId: "svc-multi", amountMinor: "81400" },
    { applicationId: "app-2", serviceId: "svc-single", amountMinor: "70000" },
  ],
  extraLines: [],
  availableExtras: [],
  visaAmountMinor: "151400",
  extrasAmountMinor: "0",
  totalAmountMinor: "151400",
};

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string, vars?: Record<string, string | number>) => {
    const copy: Record<string, string> = {
      "payment.orderTitle": "Your order",
      "payment.quantityOne": "× 1",
      "payment.total": "Total",
      "payment.travellerLine": "Traveller {number} — {service}",
      "payment.totalAtCheckout": "Total at checkout",
      "payment.badges.allFeesIncluded": "All fees included",
      "payment.badges.noHiddenCharges": "No hidden charges",
      "chooser.durationDays": "{count} days",
      "chooser.entryLabels.multiple": "Multiple entry",
      "chooser.entryLabels.single": "Single entry",
    };
    const text = copy[key] ?? key;
    if (!vars) return text;
    return Object.entries(vars).reduce((next, [name, value]) => next.replaceAll(`{${name}}`, String(value)), text);
  },
  useCustomerLocale: () => "en",
}));

vi.mock("@/components/apply/checkout-quote-provider", () => ({
  useCheckoutQuoteOptional: () => ({
    preview,
    loading: false,
    updating: false,
    loadError: null,
    announcement: null,
  }),
}));

vi.mock("@/lib/stores/client-auth-store", () => ({
  useClientAuthStore: (selector: (state: { session: null }) => unknown) => selector({ session: null }),
}));

vi.mock("@/lib/analytics/checkout-recap-total", () => ({ rememberCheckoutRecapTotal: () => undefined }));
vi.mock("@/lib/analytics/gtag-client", () => ({ trackEventOnce: () => undefined }));
vi.mock("@/lib/analytics/meta-pixel-advanced-matching", () => ({ setMetaAdvancedMatchingPhone: () => undefined }));

vi.mock("@/lib/portal/fetch-envelope", () => ({
  fetchApiEnvelope: vi.fn(async (url: string) => {
    const href = String(url);
    if (href.includes("/catalog/services")) {
      return {
        ok: true,
        data: {
          services: [
            {
              id: "svc-multi",
              name: "30 Days - Multiple Entry",
              durationDays: 30,
              entries: "multiple",
              displayPriceMinor: "81400",
              currency: "AED",
            },
            {
              id: "svc-single",
              name: "30 Days - Single Entry",
              durationDays: 30,
              entries: "single",
              displayPriceMinor: "70000",
              currency: "AED",
            },
          ],
        },
      };
    }
    if (href.includes("/catalog/apply-config")) {
      return { ok: true, data: { badges: { allFeesIncluded: "All fees included", noHiddenCharges: "No hidden charges" } } };
    }
    if (href.includes("/applications/")) {
      return { ok: true, data: { application: { applicant: { fullName: null, dateOfBirth: null, passportNumber: null, phone: null } } } };
    }
    return { ok: false, error: { message: "missing" } };
  }),
}));

import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";

const application = {
  id: "app-1",
  nationalityCode: "IN",
  serviceId: "svc-multi",
  catalogCurrency: "AED",
  checkoutOffer: null,
  guestEmail: "guest@example.com",
  isGuest: true,
  applicant: {
    fullName: null,
    dateOfBirth: null,
    passportNumber: null,
    phone: null,
    placeOfBirth: null,
    nationality: null,
    passportExpiryDate: null,
    profession: null,
    address: null,
  },
} as PublicApplication;

const member = (
  applicationId: string,
  serviceId: string,
  serviceName: string,
  travelerIndex: number,
): TPublicPartyMember => ({
  applicationId,
  travelerRole: travelerIndex === 0 ? "primary" : "additional",
  travelerKind: "adult",
  travelerIndex,
  serviceId,
  serviceName,
  slots: [],
});

describe("CheckoutOrderRecap mixed visas", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows one line per distinct visa instead of the primary visa for the whole party", async () => {
    render(
      <CheckoutOrderRecap
        application={application}
        members={[
          member("app-1", "svc-multi", "30 Days - Multiple Entry", 0),
          member("app-2", "svc-single", "30 Days - Single Entry", 1),
        ]}
        showTitle={false}
        showProcessingSpeed={false}
      />,
    );
    const lines = await waitFor(() => {
      const nodes = screen.getAllByTestId("mixed-visa-line");
      expect(nodes).toHaveLength(2);
      return nodes;
    });
    expect(lines[0]?.textContent).toContain("30 Days - Multiple Entry\u00a0×\u00a01");
    expect(lines[1]?.textContent).toContain("30 Days - Single Entry\u00a0×\u00a01");
    expect(screen.queryByText(/Traveller 1/)).not.toBeInTheDocument();
    expect(screen.getByText("Total").parentElement?.textContent).toMatch(/1,514\.00/);
  });
});

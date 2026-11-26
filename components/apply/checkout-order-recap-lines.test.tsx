/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicApplication } from "@/lib/applications/public-application";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

const preview: TClientQuotePreview = {
  currency: "NGN",
  todayUae: "2026-11-26",
  maxTravelDate: "2027-05-26",
  travelDateRequired: false,
  thresholdDays: 4,
  travelDate: "2026-12-05",
  daysUntilTravel: 9,
  recommendFastTrack: false,
  processingSpeed: "fast_track",
  processingSpeedSource: "customer",
  locked: false,
  travellerCount: 1,
  visaLines: [{ applicationId: "app-1", serviceId: "svc-1", amountMinor: "33245000" }],
  extraLines: [
    { key: "fast_track", applicationId: "app-1", amountMinor: "13801500" },
    { key: "travel_insurance", applicationId: "app-1", amountMinor: "2968900" },
  ],
  availableExtras: [
    {
      key: "fast_track",
      unitAmountMinor: "13801500",
      travellerCount: 1,
      sumAmountMinor: "13801500",
      selected: true,
      chargeBasis: "per_traveller",
      labelI18n: { en: "Fast Track" },
      descriptionI18n: {},
      promiseI18n: { en: "within 24 hours" },
      termsUrl: null,
    },
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
  extrasAmountMinor: "16770400",
  totalAmountMinor: "50015400",
};

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string, vars?: Record<string, string | number>) => {
    const copy: Record<string, string> = {
      "payment.orderTitle": "Your order",
      "payment.productColumn": "Product",
      "payment.subtotalColumn": "Subtotal",
      "payment.quantityOne": "× 1",
      "payment.total": "Total",
      "payment.nameLabel": "Name",
      "payment.emailLabel": "Email",
      "payment.dateOfBirthLabel": "Date of birth",
      "payment.passportLabel": "Passport",
      "payment.notAddedYet": "Not added yet",
      "payment.totalAtCheckout": "Total at checkout",
      "extras.recap.fastTrack": "Fast Track processing",
      "extras.recap.insurance": "Travel insurance",
      "extras.recap.updating": "Updating total",
      "speed.readonly.fast": "Processing: Fast Track (within 24 hours)",
      "chooser.durationDays": "{count} days",
      "chooser.entryLabels.single": "Single entry",
      "payment.badges.allFeesIncluded": "All fees included",
      "payment.badges.noHiddenCharges": "No hidden charges",
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
              id: "svc-1",
              name: "14 Days - Single Entry",
              durationDays: 14,
              entries: "single",
              displayPriceMinor: "33245000",
              currency: "NGN",
            },
          ],
        },
      };
    }
    if (href.includes("/catalog/apply-config")) {
      return {
        ok: true,
        data: { badges: { allFeesIncluded: "All fees included", noHiddenCharges: "No hidden charges" } },
      };
    }
    if (href.includes("/applications/")) {
      return {
        ok: true,
        data: {
          application: {
            applicant: {
              fullName: "SUPPA MARIA PINA",
              dateOfBirth: "1986-08-18",
              passportNumber: "CA31347AA",
              phone: null,
            },
          },
        },
      };
    }
    return { ok: false, error: { message: "missing" } };
  }),
}));

import { CheckoutOrderRecap } from "@/components/apply/checkout-order-recap";

const application = {
  id: "app-1",
  nationalityCode: "NG",
  serviceId: "svc-1",
  catalogCurrency: "NGN",
  checkoutOffer: { provider: "fincra", currency: "NGN" },
  guestEmail: "x@x.com",
  isGuest: true,
  applicant: {
    fullName: "SUPPA MARIA PINA",
    dateOfBirth: "1986-08-18",
    passportNumber: "CA31347AA",
    phone: null,
    placeOfBirth: null,
    nationality: null,
    passportExpiryDate: null,
    profession: null,
    address: null,
  },
} as PublicApplication;

describe("CheckoutOrderRecap lines", () => {
  afterEach(() => {
    cleanup();
  });

  it("puts quantity inline, keeps only the total bold, and stays inside the card", async () => {
    render(<CheckoutOrderRecap application={application} showProcessingSpeed />);
    const card = await waitFor(() => {
      const node = document.querySelector("[data-order-recap-card]");
      expect(node?.textContent).toContain("Fast Track processing");
      return node as HTMLElement;
    });
    expect(screen.queryByText("Product")).toBeNull();
    expect(screen.queryByText("Subtotal")).toBeNull();
    const fast = screen.getByText(/Fast Track processing/);
    expect(fast.textContent).toMatch(/× 1/);
    expect(fast.className).not.toMatch(/font-bold/);
    expect(fast.closest("[data-order-recap-card]")).toBe(card);
    const total = screen.getByText("Total");
    expect(total.className).toMatch(/font-bold/);
    expect(total.closest("[data-order-recap-card]")).toBe(card);
    expect(card.textContent).toContain("500,154.00");
    const lines = card.querySelectorAll("[data-recap-line]");
    for (const line of lines) {
      expect(line.className).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\]/);
      const amount = line.querySelector("p.text-end, p[class*='text-end']");
      expect(amount?.className ?? "").not.toMatch(/font-bold/);
      expect(amount?.className ?? "").toMatch(/tabular-nums/);
      expect(amount?.className ?? "").toMatch(/text-end/);
    }
  });
});

describe("apply funnel feedback markup", () => {
  it("keeps the visa-list summary for screen readers only and drops the left Fast Track equation", () => {
    const chooser = readFileSync(join(process.cwd(), "components/apply/guided-visa-chooser.tsx"), "utf8");
    expect(chooser).toMatch(/matchingVisasBanner/);
    expect(chooser).toMatch(/className=\{`sr-only \$\{APPLY_PROGRAMMATIC_HEADING_CLASS\}`\}/);
    const start = readFileSync(join(process.cwd(), "components/apply/start-application-form.tsx"), "utf8");
    expect(start).not.toMatch(/MessageWithAmounts/);
    expect(start).toMatch(/priceLines=/);
  });
});

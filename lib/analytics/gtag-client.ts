"use client";

import {
  getCanonicalPageLocation,
  getCanonicalPagePath,
} from "@/lib/analytics/canonical-url";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { APPLY_FUNNEL_EVENTS, buildGa4PurchaseParams } from "@/lib/analytics/apply-funnel";
import {
  buildGadsCheckoutConversionParams,
  type TGadsCheckoutConversionInput,
} from "@/lib/analytics/gads-checkout-conversion";

export type GtagEventParams = Record<string, string | number | boolean | undefined | null>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function ensureGtag(): typeof window.gtag | undefined {
  if (typeof window === "undefined") return undefined;
  if (typeof window.gtag === "function") return window.gtag;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  return window.gtag;
}

/** Queue a gtag command; safe before the remote script finishes loading. */
export function gtagCommand(...args: unknown[]): void {
  const gtag = ensureGtag();
  if (!gtag) return;
  gtag(...args);
}

export function trackEvent(eventName: string, params?: GtagEventParams): void {
  if (typeof window === "undefined") return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  const page_location = getCanonicalPageLocation();
  const page_path = getCanonicalPagePath();
  const cleaned: Record<string, string | number | boolean> = {
    page_location,
    page_path,
  };
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      cleaned[k] = v;
    }
  }
  gtagCommand("event", eventName, cleaned);
}

export function trackPageView(pathname: string, search: string): void {
  if (isAnalyticsExcludedPath(pathname)) return;
  trackEvent("page_view", {
    page_location: getCanonicalPageLocation(pathname, search),
    page_path: getCanonicalPagePath(pathname, search),
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

/** Google Ads Checkout Completed — fires only the Ads conversion event snippet. */
export const trackGadsCheckoutConversion = (input: TGadsCheckoutConversionInput): void => {
  if (typeof window === "undefined") return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  const params = buildGadsCheckoutConversionParams(input);
  if (!params) return;
  gtagCommand("event", "conversion", params);
};

const purchaseDedupeKey = (applicationId: string): string => `vt_ga4_purchase:${applicationId}`;

/**
 * Funnel + standard GA4 purchase. Import `purchase` (or `apply_payment_completed`) in Google Ads.
 * Dedupes per application for this browser tab so overlay + thank-you do not double-count.
 */
export const trackApplyPaymentCompleted = (input: {
  applicationId: string;
  paymentProvider?: string;
  value?: number;
  currency?: string;
}): void => {
  const purchase = buildGa4PurchaseParams({
    transactionId: input.applicationId,
    value: input.value,
    currency: input.currency,
  });
  if (!purchase) return;
  try {
    const key = purchaseDedupeKey(input.applicationId);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode — still send */
  }
  trackEvent(APPLY_FUNNEL_EVENTS.paymentCompleted, {
    ...purchase,
    application_id: input.applicationId,
    payment_provider: input.paymentProvider,
  });
  trackEvent(APPLY_FUNNEL_EVENTS.purchase, purchase);
};

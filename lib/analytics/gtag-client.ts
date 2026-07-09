"use client";

import {
  getCanonicalPageLocation,
  getCanonicalPagePath,
} from "@/lib/analytics/canonical-url";

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
  trackEvent("page_view", {
    page_location: getCanonicalPageLocation(pathname, search),
    page_path: getCanonicalPagePath(pathname, search),
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

"use client";

import { Suspense, useEffect } from "react";
import { AnalyticsRouteTracker } from "@/components/analytics/analytics-route-tracker";
import { trackEvent } from "@/lib/analytics/gtag-client";

/**
 * Bridges existing `visatop:analytics` CustomEvents (guest-link funnel) into gtag.
 */
function VisatopAnalyticsBridge() {
  useEffect(() => {
    const onAnalytics = (ev: Event) => {
      const detail = (ev as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || typeof detail.event !== "string") return;
      const { event, ...rest } = detail;
      const params: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          params[k] = v;
        }
      }
      trackEvent(event, params);
    };
    window.addEventListener("visatop:analytics", onAnalytics);
    return () => window.removeEventListener("visatop:analytics", onAnalytics);
  }, []);

  return null;
}

/** Client analytics listeners for the root layout (Suspense for useSearchParams). */
export function AnalyticsProviders() {
  return (
    <>
      <VisatopAnalyticsBridge />
      <Suspense fallback={null}>
        <AnalyticsRouteTracker />
      </Suspense>
    </>
  );
}

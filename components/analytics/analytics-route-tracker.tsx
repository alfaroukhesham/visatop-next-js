"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  APPLY_FUNNEL_EVENTS,
  applyStepFromPathname,
  applyStepLabel,
} from "@/lib/analytics/apply-funnel";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { trackEvent, trackPageView } from "@/lib/analytics/gtag-client";

/**
 * Fires GA4 `page_view` on App Router navigations and `apply_step_view` for funnel routes.
 * Skips admin (and any other excluded) paths.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const search = searchParams?.toString();
    const searchWithQ = search ? `?${search}` : "";
    // usePathname() is basePath-stripped; rebuild public path for canonical URLs.
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/visa-processing").replace(
      /\/$/,
      "",
    );
    const publicPath =
      typeof window !== "undefined"
        ? window.location.pathname
        : `${basePath}${pathname === "/" ? "/" : pathname}`;

    if (isAnalyticsExcludedPath(publicPath) || isAnalyticsExcludedPath(pathname)) {
      return;
    }

    const key = `${publicPath}${searchWithQ}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    trackPageView(publicPath, searchWithQ);

    const step = applyStepFromPathname(publicPath);
    if (step) {
      trackEvent(APPLY_FUNNEL_EVENTS.stepView, {
        step,
        step_name: applyStepLabel(step),
      });
    }
  }, [pathname, searchParams]);

  return null;
}

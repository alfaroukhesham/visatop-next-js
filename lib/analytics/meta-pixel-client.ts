"use client";

import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";

type TFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: TFbq;
};

declare global {
  interface Window {
    fbq?: TFbq;
    _fbq?: TFbq;
  }
}

/** Queue a Meta Pixel command; safe before fbevents.js finishes loading. */
export const fbqCommand = (...args: unknown[]): void => {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  window.fbq(...args);
};

/** SPA PageView — first load is already sent by the base snippet. */
export const trackMetaPageView = (): void => {
  if (typeof window === "undefined") return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  fbqCommand("track", "PageView");
};

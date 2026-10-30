"use client";

import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { areMarketingTagsEnabledInBrowser } from "@/lib/analytics/marketing-tags-enabled";
import { WEBISTE_VISA_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

type TFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: TFbq;
};

export type TMetaAdvancedMatchingUser = {
  em?: string;
  ph?: string;
  external_id?: string;
};

declare global {
  interface Window {
    fbq?: TFbq;
    _fbq?: TFbq;
  }
}

let pendingAdvancedMatching: TMetaAdvancedMatchingUser | null = null;
let flushedAdvancedMatchingKey: string | null = null;

export const resetMetaAdvancedMatching = (): void => {
  pendingAdvancedMatching = null;
  flushedAdvancedMatchingKey = null;
};

const matchingKey = (user: TMetaAdvancedMatchingUser): string => JSON.stringify(user);

export const flushWebisteVisaAdvancedMatching = (): void => {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  if (!pendingAdvancedMatching) return;
  if (!areMarketingTagsEnabledInBrowser()) return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  const key = matchingKey(pendingAdvancedMatching);
  if (key === flushedAdvancedMatchingKey) return;
  flushedAdvancedMatchingKey = key;
  window.fbq("init", WEBISTE_VISA_PIXEL_ID, pendingAdvancedMatching);
};

/** Queue a Meta Pixel command; safe before fbevents.js finishes loading. */
export const fbqCommand = (...args: unknown[]): void => {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  flushWebisteVisaAdvancedMatching();
  window.fbq(...args);
};

/** Re-init WebisteVisa with plain advanced-matching fields (Meta hashes in the pixel). */
export const queueWebisteVisaAdvancedMatching = (user: TMetaAdvancedMatchingUser): void => {
  pendingAdvancedMatching = user;
  flushedAdvancedMatchingKey = null;
  flushWebisteVisaAdvancedMatching();
};

/** SPA PageView — first load is already sent by the base snippet. */
export const trackMetaPageView = (): void => {
  if (typeof window === "undefined") return;
  if (!areMarketingTagsEnabledInBrowser()) return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  fbqCommand("track", "PageView");
};

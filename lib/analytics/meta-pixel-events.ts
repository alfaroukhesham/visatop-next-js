"use client";

import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { areMarketingTagsEnabledInBrowser } from "@/lib/analytics/marketing-tags-enabled";
import { fbqCommand } from "@/lib/analytics/meta-pixel-client";
import { WEBISTE_VISA_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

export type TMetaPixelEventParams = Record<string, string | number | boolean | undefined | null>;

export type TMetaPixelStandardEvent =
  | "ViewContent"
  | "AddToCart"
  | "SubmitApplication"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase";

export type TMetaPixelCustomEvent = "StartApplication";

export type TMetaPixelParams = {
  content_ids?: string[];
  content_category?: string;
  content_name?: string;
  content_type?: "product";
  value?: number;
  currency?: string;
};

export type TMetaPixelFunnelHit =
  | {
      kind: "standard";
      event: TMetaPixelStandardEvent;
      params: TMetaPixelParams;
      options?: { eventID: string };
    }
  | { kind: "custom"; event: TMetaPixelCustomEvent; params: TMetaPixelParams };

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

const asCurrency = (value: unknown): string | undefined => {
  const raw = asNonEmptyString(value)?.toUpperCase();
  if (!raw || !/^[A-Z]{3}$/.test(raw)) return undefined;
  return raw;
};

const contentIdsFromParams = (params: TMetaPixelEventParams): string[] | undefined => {
  const id =
    asNonEmptyString(params.service_id) ??
    asNonEmptyString(params.application_id) ??
    asNonEmptyString(params.transaction_id);
  return id ? [id] : undefined;
};

export const buildMetaPixelParams = (params: TMetaPixelEventParams = {}): TMetaPixelParams => {
  const built: TMetaPixelParams = { content_type: "product" };
  const contentIds = contentIdsFromParams(params);
  if (contentIds) built.content_ids = contentIds;
  const category = asNonEmptyString(params.nationality)?.toUpperCase();
  if (category) built.content_category = category;
  const name = asNonEmptyString(params.visa_name);
  if (name) built.content_name = name;
  const value = asFiniteNumber(params.value);
  if (value !== undefined) built.value = value;
  const currency = asCurrency(params.currency);
  if (currency) built.currency = currency;
  return built;
};

const STANDARD_BY_FUNNEL: Record<string, TMetaPixelStandardEvent> = {
  [APPLY_FUNNEL_EVENTS.visaListViewed]: "ViewContent",
  [APPLY_FUNNEL_EVENTS.visaSelected]: "AddToCart",
  [APPLY_FUNNEL_EVENTS.applicantVerified]: "SubmitApplication",
  [APPLY_FUNNEL_EVENTS.checkoutViewed]: "InitiateCheckout",
  [APPLY_FUNNEL_EVENTS.paymentStarted]: "AddPaymentInfo",
  [APPLY_FUNNEL_EVENTS.purchase]: "Purchase",
};

export const buildMetaPixelFunnelHit = (
  eventName: string,
  params: TMetaPixelEventParams = {},
): TMetaPixelFunnelHit | null => {
  if (eventName === APPLY_FUNNEL_EVENTS.paymentSucceeded) return null;
  const pixelParams = buildMetaPixelParams(params);
  if (eventName === APPLY_FUNNEL_EVENTS.applicationStarted) {
    return { kind: "custom", event: "StartApplication", params: pixelParams };
  }
  const standard = STANDARD_BY_FUNNEL[eventName];
  if (!standard) return null;
  if (standard === "Purchase") {
    const eventID =
      asNonEmptyString(params.transaction_id) ?? asNonEmptyString(params.application_id);
    if (!eventID) return null;
    return {
      kind: "standard",
      event: "Purchase",
      params: pixelParams,
      options: { eventID },
    };
  }
  return { kind: "standard", event: standard, params: pixelParams };
};

/** Funnel → WebisteVisa only. GA4 / Ads stay on `trackEvent`. */
export const trackMetaPixelFunnelEvent = (
  eventName: string,
  params?: TMetaPixelEventParams,
): void => {
  if (typeof window === "undefined") return;
  if (!areMarketingTagsEnabledInBrowser()) return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  const hit = buildMetaPixelFunnelHit(eventName, params);
  if (!hit) return;
  if (hit.kind === "custom") {
    fbqCommand("trackSingleCustom", WEBISTE_VISA_PIXEL_ID, hit.event, hit.params);
    return;
  }
  if (hit.options) {
    fbqCommand("trackSingle", WEBISTE_VISA_PIXEL_ID, hit.event, hit.params, hit.options);
    return;
  }
  fbqCommand("trackSingle", WEBISTE_VISA_PIXEL_ID, hit.event, hit.params);
};

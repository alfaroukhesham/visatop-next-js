/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import {
  buildMetaPixelFunnelHit,
  buildMetaPixelParams,
  trackMetaPixelFunnelEvent,
} from "@/lib/analytics/meta-pixel-events";
import { resetMetaAdvancedMatching } from "@/lib/analytics/meta-pixel-client";
import { META_PIXEL_ID, WEBISTE_VISA_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

const setLocation = (hostname: string, pathname: string): void => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hostname,
      pathname,
      origin: `https://${hostname}`,
      protocol: "https:",
      search: "",
    },
  });
};

beforeEach(() => {
  resetMetaAdvancedMatching();
  window.fbq = vi.fn();
  setLocation("visatop.com", "/visa-processing/apply/start");
});

afterEach(() => {
  resetMetaAdvancedMatching();
  vi.restoreAllMocks();
});

describe("buildMetaPixelParams", () => {
  it("maps service_id, nationality, value, currency, and visa_name", () => {
    expect(
      buildMetaPixelParams({
        service_id: "svc_30",
        nationality: "in",
        value: 169,
        currency: "aed",
        visa_name: "30 Days Tourist Visa",
      }),
    ).toEqual({
      content_type: "product",
      content_ids: ["svc_30"],
      content_category: "IN",
      content_name: "30 Days Tourist Visa",
      value: 169,
      currency: "AED",
    });
  });

  it("falls back to application_id then transaction_id for content_ids", () => {
    expect(buildMetaPixelParams({ application_id: "app_1" }).content_ids).toEqual(["app_1"]);
    expect(buildMetaPixelParams({ transaction_id: "app_2" }).content_ids).toEqual(["app_2"]);
    expect(
      buildMetaPixelParams({ service_id: "svc_1", application_id: "app_1", transaction_id: "app_2" })
        .content_ids,
    ).toEqual(["svc_1"]);
  });
});

describe("buildMetaPixelFunnelHit", () => {
  it("maps the apply funnel onto WebisteVisa standard and custom events", () => {
    expect(buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.visaListViewed, { nationality: "IN" })).toEqual({
      kind: "standard",
      event: "ViewContent",
      params: { content_type: "product", content_category: "IN" },
    });
    expect(buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.applicationStarted, { nationality: "PK" })).toEqual({
      kind: "custom",
      event: "StartApplication",
      params: { content_type: "product", content_category: "PK" },
    });
    expect(
      buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.visaSelected, {
        service_id: "svc_1",
        nationality: "IN",
        value: 99,
        currency: "USD",
        visa_name: "Tourist visa",
      }),
    ).toMatchObject({ kind: "standard", event: "AddToCart" });
    expect(buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.applicantVerified, { application_id: "app_1" })).toEqual({
      kind: "standard",
      event: "SubmitApplication",
      params: { content_type: "product", content_ids: ["app_1"] },
    });
    expect(
      buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.checkoutViewed, {
        application_id: "app_1",
        value: 169,
        currency: "AED",
      }),
    ).toMatchObject({ kind: "standard", event: "InitiateCheckout" });
    expect(
      buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.paymentStarted, {
        application_id: "app_1",
        value: 1850,
        currency: "NGN",
      }),
    ).toMatchObject({ kind: "standard", event: "AddPaymentInfo" });
  });

  it("does not forward payment_succeeded", () => {
    expect(
      buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.paymentSucceeded, {
        transaction_id: "app_1",
        value: 169,
        currency: "AED",
      }),
    ).toBeNull();
  });

  it("maps purchase with eventID equal to the application id", () => {
    expect(
      buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.purchase, {
        transaction_id: "app_abc",
        value: 169,
        currency: "AED",
      }),
    ).toEqual({
      kind: "standard",
      event: "Purchase",
      params: {
        content_type: "product",
        content_ids: ["app_abc"],
        value: 169,
        currency: "AED",
      },
      options: { eventID: "app_abc" },
    });
  });

  it("ignores unmapped events", () => {
    expect(buildMetaPixelFunnelHit(APPLY_FUNNEL_EVENTS.stepView)).toBeNull();
    expect(buildMetaPixelFunnelHit("page_view")).toBeNull();
  });
});

describe("trackMetaPixelFunnelEvent", () => {
  it("sends standard events with trackSingle to WebisteVisa only", () => {
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.visaSelected, {
      service_id: "svc_1",
      nationality: "IN",
      value: 99,
      currency: "USD",
      visa_name: "Tourist visa",
    });
    expect(window.fbq).toHaveBeenCalledTimes(1);
    expect(window.fbq).toHaveBeenCalledWith(
      "trackSingle",
      WEBISTE_VISA_PIXEL_ID,
      "AddToCart",
      expect.objectContaining({
        content_ids: ["svc_1"],
        content_category: "IN",
        content_name: "Tourist visa",
        value: 99,
        currency: "USD",
        content_type: "product",
      }),
    );
    expect(vi.mocked(window.fbq!).mock.calls[0]).not.toContain(META_PIXEL_ID);
  });

  it("sends StartApplication with trackSingleCustom", () => {
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.applicationStarted, { nationality: "IN" });
    expect(window.fbq).toHaveBeenCalledWith(
      "trackSingleCustom",
      WEBISTE_VISA_PIXEL_ID,
      "StartApplication",
      expect.objectContaining({ content_category: "IN" }),
    );
  });

  it("sends Purchase with eventID and does not send payment_succeeded", () => {
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.paymentSucceeded, {
      transaction_id: "app_1",
      value: 169,
      currency: "AED",
    });
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.purchase, {
      transaction_id: "app_1",
      value: 169,
      currency: "AED",
    });
    expect(window.fbq).toHaveBeenCalledTimes(1);
    expect(window.fbq).toHaveBeenCalledWith(
      "trackSingle",
      WEBISTE_VISA_PIXEL_ID,
      "Purchase",
      expect.objectContaining({ value: 169, currency: "AED", content_ids: ["app_1"] }),
      { eventID: "app_1" },
    );
  });

  it("is a no-op on admin paths and non-production hosts", () => {
    setLocation("visatop.com", "/admin/applications");
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.visaListViewed, { nationality: "IN" });
    setLocation("app-staging.visatop.com", "/visa-processing/apply/start");
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.visaListViewed, { nationality: "IN" });
    setLocation("localhost", "/visa-processing/apply/start");
    trackMetaPixelFunnelEvent(APPLY_FUNNEL_EVENTS.visaListViewed, { nationality: "IN" });
    expect(window.fbq).not.toHaveBeenCalled();
  });
});

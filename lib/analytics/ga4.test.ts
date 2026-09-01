import { describe, expect, it } from "vitest";
import {
  applyStepFromPathname,
  applyStepLabel,
  buildGa4PurchaseParams,
} from "@/lib/analytics/apply-funnel";
import { SITE_KIT_CONSENT_REGIONS } from "@/lib/analytics/consent-regions";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { buildGoogleTagBootstrapScript } from "@/lib/analytics/gtag-bootstrap";

describe("isAnalyticsExcludedPath", () => {
  it("excludes admin routes with or without basePath", () => {
    expect(isAnalyticsExcludedPath("/admin")).toBe(true);
    expect(isAnalyticsExcludedPath("/admin/")).toBe(true);
    expect(isAnalyticsExcludedPath("/admin/applications")).toBe(true);
    expect(isAnalyticsExcludedPath("/admin/sign-in")).toBe(true);
    expect(isAnalyticsExcludedPath("/visa-processing/admin")).toBe(true);
    expect(isAnalyticsExcludedPath("/visa-processing/admin/catalog")).toBe(true);
  });

  it("does not exclude client apply routes", () => {
    expect(isAnalyticsExcludedPath("/")).toBe(false);
    expect(isAnalyticsExcludedPath("/visa-processing/")).toBe(false);
    expect(isAnalyticsExcludedPath("/apply/start")).toBe(false);
    expect(isAnalyticsExcludedPath("/visa-processing/apply/start")).toBe(false);
    expect(isAnalyticsExcludedPath("/portal")).toBe(false);
  });
});

describe("applyStepFromPathname", () => {
  it("maps home and start", () => {
    expect(applyStepFromPathname("/visa-processing/")).toBe(1);
    expect(applyStepFromPathname("/visa-processing")).toBe(1);
    expect(applyStepFromPathname("/")).toBe(1);
    expect(applyStepFromPathname("/visa-processing/apply/start")).toBe(2);
    expect(applyStepFromPathname("/apply/start")).toBe(2);
  });

  it("maps application draft / payment / submitted", () => {
    expect(applyStepFromPathname("/visa-processing/apply/applications/abc")).toBe(3);
    expect(applyStepFromPathname("/visa-processing/apply/applications/abc/payment")).toBe(4);
    expect(applyStepFromPathname("/visa-processing/apply/applications/abc/submitted")).toBe(5);
  });

  it("returns null for non-funnel routes", () => {
    expect(applyStepFromPathname("/visa-processing/sign-in")).toBeNull();
    expect(applyStepFromPathname("/visa-processing/portal")).toBeNull();
  });

  it("labels steps", () => {
    expect(applyStepLabel(1)).toBe("nationality");
    expect(applyStepLabel(4)).toBe("payment");
  });
});

describe("buildGa4PurchaseParams", () => {
  it("builds a purchase payload from the charged amount", () => {
    expect(
      buildGa4PurchaseParams({
        transactionId: "app_123",
        value: 149,
        currency: "usd",
      }),
    ).toEqual({
      transaction_id: "app_123",
      value: 149,
      currency: "USD",
    });
  });

  it("returns null without a transaction id or charged amount", () => {
    expect(buildGa4PurchaseParams({ transactionId: "  ", value: 10, currency: "USD" })).toBeNull();
    expect(buildGa4PurchaseParams({ transactionId: "app_123", currency: "USD" })).toBeNull();
    expect(buildGa4PurchaseParams({ transactionId: "app_123", value: 10 })).toBeNull();
  });
});

describe("buildGoogleTagBootstrapScript", () => {
  it("includes Site Kit consent defaults, linker, and send_page_view false", () => {
    const script = buildGoogleTagBootstrapScript({
      googleTagId: "GT-MK4HNLVK",
      gaMeasurementId: "G-Z2581VYBE3",
      gadsConversionId: "AW-17767633830",
    });
    expect(script).toContain("gtag('consent', 'default'");
    expect(script).toContain("analytics_storage: 'denied'");
    expect(script).toContain("wait_for_update: 500");
    expect(script).toContain("gtag('set', 'linker', { domains: ['visatop.com'] })");
    expect(script).toContain("GT-MK4HNLVK");
    expect(script).toContain("G-Z2581VYBE3");
    expect(script).toContain("AW-17767633830");
    expect(script).toContain("send_page_view: false");
    for (const region of SITE_KIT_CONSENT_REGIONS) {
      expect(script).toContain(`"${region}"`);
    }
  });

  it("omits Ads config when conversion id is empty", () => {
    const script = buildGoogleTagBootstrapScript({
      googleTagId: "GT-MK4HNLVK",
      gaMeasurementId: "G-Z2581VYBE3",
      gadsConversionId: "",
    });
    expect(script).not.toContain("AW-");
  });
});

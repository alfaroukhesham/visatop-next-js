import { describe, expect, it } from "vitest";
import {
  applyStepFromPathname,
  applyStepLabel,
} from "@/lib/analytics/apply-funnel";
import { SITE_KIT_CONSENT_REGIONS } from "@/lib/analytics/consent-regions";
import { buildGoogleTagBootstrapScript } from "@/lib/analytics/gtag-bootstrap";

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

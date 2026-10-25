import { describe, expect, it } from "vitest";
import {
  analyticsCountryForFunnelEvent,
  analyticsCountryFromHeaders,
  sanitizeAnalyticsCountryCode,
} from "./geo-country";

describe("sanitizeAnalyticsCountryCode", () => {
  it("keeps ISO2 and drops Cloudflare placeholders", () => {
    expect(sanitizeAnalyticsCountryCode("ng")).toBe("NG");
    expect(sanitizeAnalyticsCountryCode("XX")).toBeNull();
    expect(sanitizeAnalyticsCountryCode("T1")).toBeNull();
    expect(sanitizeAnalyticsCountryCode("USA")).toBeNull();
    expect(sanitizeAnalyticsCountryCode("")).toBeNull();
  });
});

describe("analyticsCountryFromHeaders", () => {
  it("reads Cloudflare then other trusted geo headers", () => {
    expect(analyticsCountryFromHeaders(new Headers({ "cf-ipcountry": "IN" }))).toBe("IN");
    expect(
      analyticsCountryFromHeaders(
        new Headers({ "cf-ipcountry": "XX", "x-vercel-ip-country": "AE" }),
      ),
    ).toBe("AE");
    expect(analyticsCountryFromHeaders(new Headers({ "x-forwarded-for": "1.1.1.1" }))).toBeNull();
  });
});

describe("analyticsCountryForFunnelEvent", () => {
  it("prefers geo, then nationality", () => {
    expect(analyticsCountryForFunnelEvent({ geoCountry: "DE", nationalityCode: "IN" })).toBe("DE");
    expect(analyticsCountryForFunnelEvent({ geoCountry: "XX", nationalityCode: "IN" })).toBe("IN");
    expect(analyticsCountryForFunnelEvent({ geoCountry: null, nationalityCode: null })).toBeNull();
  });
});

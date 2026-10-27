import { describe, expect, it } from "vitest";
import {
  CLARITY_PRECONNECT_ORIGINS,
  MARKETING_DNS_PREFETCH_ORIGINS,
  MARKETING_PRECONNECT_ORIGINS,
} from "@/lib/analytics/resource-hint-origins";

describe("resource hint origins", () => {
  it("preconnects Clarity before the lazy snippet runs", () => {
    expect(CLARITY_PRECONNECT_ORIGINS).toEqual([
      "https://www.clarity.ms",
      "https://scripts.clarity.ms",
    ]);
  });

  it("preconnects production marketing origins", () => {
    expect(MARKETING_PRECONNECT_ORIGINS).toContain("https://www.googletagmanager.com");
    expect(MARKETING_PRECONNECT_ORIGINS).toContain("https://connect.facebook.net");
    expect(MARKETING_PRECONNECT_ORIGINS).toContain("https://analytics.google.com");
  });

  it("dns-prefetches DoubleClick follow-on hosts instead of preconnecting them all", () => {
    expect(MARKETING_DNS_PREFETCH_ORIGINS).toContain("https://googleads.g.doubleclick.net");
    expect(MARKETING_DNS_PREFETCH_ORIGINS).toContain("https://www.google.com");
  });
});

import { describe, expect, it } from "vitest";
import {
  analyticsDeviceType,
  analyticsDeviceTypeFromUserAgent,
  sanitizeAnalyticsDeviceType,
} from "@/lib/analytics/device-type";

describe("analyticsDeviceType", () => {
  it("classifies common user agents", () => {
    expect(analyticsDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      "mobile",
    );
    expect(analyticsDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(analyticsDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});

describe("analyticsDeviceTypeFromUserAgent", () => {
  it("returns null when the request has no UA", () => {
    expect(analyticsDeviceTypeFromUserAgent(null)).toBeNull();
    expect(analyticsDeviceTypeFromUserAgent("  ")).toBeNull();
    expect(analyticsDeviceTypeFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      "mobile",
    );
  });
});

describe("sanitizeAnalyticsDeviceType", () => {
  it("allowlists stored values", () => {
    expect(sanitizeAnalyticsDeviceType("tablet")).toBe("tablet");
    expect(sanitizeAnalyticsDeviceType("bot")).toBeNull();
  });
});

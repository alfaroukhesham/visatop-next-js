import { describe, expect, it } from "vitest";
import { analyticsDeviceType } from "@/lib/analytics/device-type";

describe("analyticsDeviceType", () => {
  it("classifies common user agents", () => {
    expect(analyticsDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(
      "mobile",
    );
    expect(analyticsDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(analyticsDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});

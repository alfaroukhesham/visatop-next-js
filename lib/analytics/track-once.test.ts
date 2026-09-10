import { afterEach, describe, expect, it } from "vitest";
import { claimAnalyticsOnce, resetAnalyticsOnceClaims } from "@/lib/analytics/track-once";

afterEach(() => {
  resetAnalyticsOnceClaims();
});

describe("claimAnalyticsOnce", () => {
  it("allows the first claim and blocks repeats for the same key", () => {
    expect(claimAnalyticsOnce("application_started")).toBe(true);
    expect(claimAnalyticsOnce("application_started")).toBe(false);
    expect(claimAnalyticsOnce("application_started")).toBe(false);
  });

  it("does not block a different key", () => {
    expect(claimAnalyticsOnce("eligibility_completed:IN")).toBe(true);
    expect(claimAnalyticsOnce("eligibility_completed:PK")).toBe(true);
  });
});

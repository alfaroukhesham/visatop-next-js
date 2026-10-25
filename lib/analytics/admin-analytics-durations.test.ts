import { describe, expect, it } from "vitest";
import { formatDurationSeconds, toDurationPercentiles } from "./admin-analytics-durations";

describe("toDurationPercentiles", () => {
  it("maps SQL percentile rows", () => {
    expect(toDurationPercentiles({ p50: 120.4, p95: 3600, n: "8" })).toEqual({
      p50Seconds: 120.4,
      p95Seconds: 3600,
      sampleSize: 8,
    });
    expect(toDurationPercentiles({ p50: 10, p95: 20, n: 0 })).toEqual({
      p50Seconds: null,
      p95Seconds: null,
      sampleSize: 0,
    });
  });
});

describe("formatDurationSeconds", () => {
  it("renders compact units", () => {
    expect(formatDurationSeconds(12)).toBe("12s");
    expect(formatDurationSeconds(180)).toBe("3m");
    expect(formatDurationSeconds(7200)).toBe("2.0h");
    expect(formatDurationSeconds(null)).toBe("—");
  });
});

import { describe, expect, it } from "vitest";
import {
  compareServiceNameCandidates,
  type ServiceNameCandidate,
} from "./build-service-name-to-id-map";

function candidate(
  id: string,
  priceCount: number,
  lastPriceUpdate: Date | null,
  createdAt: Date,
): ServiceNameCandidate {
  return {
    id,
    name: "Test Service",
    priceCount,
    lastPriceUpdate,
    createdAt,
  };
}

describe("compareServiceNameCandidates", () => {
  it("prefers higher price count", () => {
    const a = candidate("a", 390, new Date("2026-06-23"), new Date("2026-05-06T18:35:00Z"));
    const b = candidate("b", 0, null, new Date("2026-05-06T18:37:00Z"));
    expect(compareServiceNameCandidates(a, b)).toBeLessThan(0);
  });

  it("prefers most recently updated when price counts tie", () => {
    const older = candidate("old", 390, new Date("2026-06-19"), new Date("2026-05-06T18:35:00Z"));
    const newer = candidate("new", 390, new Date("2026-06-23"), new Date("2026-05-06T18:37:00Z"));
    expect(compareServiceNameCandidates(newer, older)).toBeLessThan(0);
  });

  it("prefers oldest createdAt when price count and update time tie", () => {
    const first = candidate("first", 390, new Date("2026-06-23"), new Date("2026-05-06T18:35:00Z"));
    const second = candidate("second", 390, new Date("2026-06-23"), new Date("2026-05-06T18:37:00Z"));
    expect(compareServiceNameCandidates(first, second)).toBeLessThan(0);
  });
});

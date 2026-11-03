import { describe, expect, it } from "vitest";
import { consecutiveWebhookMissStreak } from "./payments-health";

describe("consecutiveWebhookMissStreak", () => {
  it("counts newest-first misses and stops at the first hit", () => {
    expect(consecutiveWebhookMissStreak([true, true, true, false])).toBe(3);
    expect(consecutiveWebhookMissStreak([true, false, true])).toBe(1);
    expect(consecutiveWebhookMissStreak([false, true, true])).toBe(0);
    expect(consecutiveWebhookMissStreak([])).toBe(0);
  });
});

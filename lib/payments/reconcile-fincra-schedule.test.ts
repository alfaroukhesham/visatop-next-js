import { describe, expect, it } from "vitest";
import { dueFincraReconcileSlots } from "./reconcile-fincra-payments";

describe("dueFincraReconcileSlots", () => {
  const base = new Date("2026-06-03T06:40:00.000Z");

  it("returns no slots before 5 minutes", () => {
    expect(dueFincraReconcileSlots(base, base.getTime() + 4 * 60 * 1000)).toEqual([]);
  });

  it("returns 5m at five minutes", () => {
    expect(dueFincraReconcileSlots(base, base.getTime() + 5 * 60 * 1000)).toEqual(["5m"]);
  });

  it("returns 5m and 15m at fifteen minutes", () => {
    expect(dueFincraReconcileSlots(base, base.getTime() + 15 * 60 * 1000)).toEqual(["5m", "15m"]);
  });

  it("returns all slots after 24 hours", () => {
    expect(dueFincraReconcileSlots(base, base.getTime() + 24 * 60 * 60 * 1000)).toEqual([
      "5m",
      "15m",
      "60m",
      "24h",
    ]);
  });
});

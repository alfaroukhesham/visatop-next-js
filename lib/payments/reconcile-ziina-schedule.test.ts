import { describe, expect, it } from "vitest";
import { dueZiinaReconcileSlots } from "./reconcile-ziina-payments";

describe("dueZiinaReconcileSlots", () => {
  const base = new Date("2026-06-03T06:40:00.000Z");

  it("returns no slots before 5 minutes", () => {
    expect(dueZiinaReconcileSlots(base, base.getTime() + 4 * 60 * 1000)).toEqual([]);
  });

  it("returns 5m at five minutes", () => {
    expect(dueZiinaReconcileSlots(base, base.getTime() + 5 * 60 * 1000)).toEqual(["5m"]);
  });

  it("returns all slots at fifteen minutes", () => {
    expect(dueZiinaReconcileSlots(base, base.getTime() + 15 * 60 * 1000)).toEqual([
      "5m",
      "10m",
      "15m",
    ]);
  });
});

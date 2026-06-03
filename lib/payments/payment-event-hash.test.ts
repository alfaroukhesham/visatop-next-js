import { describe, expect, it } from "vitest";
import {
  computeZiinaReconcilePayloadHash,
  computeZiinaReconcileProbePayloadHash,
} from "./payment-event-hash";

describe("ziina reconcile hashes", () => {
  it("probe hashes are stable per payment and slot", () => {
    const a = computeZiinaReconcileProbePayloadHash("pay_1", "5m");
    const b = computeZiinaReconcileProbePayloadHash("pay_1", "5m");
    const c = computeZiinaReconcileProbePayloadHash("pay_1", "10m");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("apply hashes differ by slot and status", () => {
    const a = computeZiinaReconcilePayloadHash("pay_1", "5m", "completed");
    const b = computeZiinaReconcilePayloadHash("pay_1", "10m", "completed");
    expect(a).not.toBe(b);
  });
});

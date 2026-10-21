import { describe, expect, it } from "vitest";
import {
  computeFincraReconcilePayloadHash,
  computeFincraReconcileProbePayloadHash,
  computePaymentEventPayloadHash,
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

  it("Fincra probe hashes are stable per payment and slot", () => {
    const a = computeFincraReconcileProbePayloadHash("pay_1", "5m");
    const b = computeFincraReconcileProbePayloadHash("pay_1", "5m");
    expect(a).toBe(b);
    expect(a).not.toBe(computeFincraReconcileProbePayloadHash("pay_1", "15m"));
  });

  it("Fincra apply hashes differ by slot", () => {
    expect(computeFincraReconcilePayloadHash("pay_1", "5m", "success")).not.toBe(
      computeFincraReconcilePayloadHash("pay_1", "15m", "success"),
    );
  });

  it("prefixes provider in webhook payload hashes", () => {
    const body = '{"event":"charge.successful"}';
    expect(computePaymentEventPayloadHash("fincra", body)).not.toBe(
      computePaymentEventPayloadHash("ziina", body),
    );
  });

  it("apply hashes differ by slot and status", () => {
    const a = computeZiinaReconcilePayloadHash("pay_1", "5m", "completed");
    const b = computeZiinaReconcilePayloadHash("pay_1", "10m", "completed");
    expect(a).not.toBe(b);
  });
});

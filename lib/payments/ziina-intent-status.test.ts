import { describe, expect, it } from "vitest";
import { mapZiinaIntentSnapshotToNormalized } from "./ziina-intent-status";

describe("mapZiinaIntentSnapshotToNormalized", () => {
  it("maps completed to payment_completed", () => {
    const r = mapZiinaIntentSnapshotToNormalized(
      {
        id: "intent_1",
        status: "completed",
        amountMinor: 110630,
        currencyCode: "AED",
        operationId: "intent_1",
      },
      "payment_intent.status.updated",
    );
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.event.kind).toBe("payment_completed");
      expect(r.event.providerPaymentId).toBe("intent_1");
      expect(r.event.amountMinor).toBe(110630);
      expect(r.event.currency).toBe("AED");
    }
  });

  it("ignores pending status", () => {
    const r = mapZiinaIntentSnapshotToNormalized(
      {
        id: "intent_1",
        status: "pending",
        amountMinor: 1,
        currencyCode: "USD",
      },
      "ziina.reconcile.5m",
    );
    expect(r.kind).toBe("ignored");
    if (r.kind === "ignored") {
      expect(r.reason).toContain("non_terminal_status");
    }
  });

  it("maps failed with provider error onto payment_failed metadata", () => {
    const r = mapZiinaIntentSnapshotToNormalized(
      {
        id: "intent_1",
        status: "failed",
        amountMinor: 1,
        currencyCode: "AED",
        operationId: "op_1",
        errorCode: "card_declined",
        errorMessage: "Insufficient funds",
      },
      "payment_intent.status.updated",
    );
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.event.kind).toBe("payment_failed");
      expect(r.event.metadata).toMatchObject({
        operationId: "op_1",
        failureCode: "card_declined",
        failureMessage: "Insufficient funds",
      });
    }
  });

  it("logs unknown status as ignored", () => {
    const r = mapZiinaIntentSnapshotToNormalized(
      {
        id: "intent_1",
        status: "weird_status",
        amountMinor: 1,
        currencyCode: "USD",
      },
      "payment_intent.status.updated",
    );
    expect(r.kind).toBe("ignored");
    if (r.kind === "ignored") {
      expect(r.reason).toBe("unknown_status:weird_status");
    }
  });
});

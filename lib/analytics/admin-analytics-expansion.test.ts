import { describe, expect, it } from "vitest";
import {
  AUDITED_CANCEL_RESET_ACTIONS,
  STUCK_CHECKOUT_THRESHOLD_MS,
  ageHours,
  buildPaymentsByProvider,
  conversionPct,
  isAuditedCancelResetAction,
  isExpiredPaymentEvent,
  manualEditRatePct,
  median,
  ocrTokenUsageFromJson,
  percentile,
  stuckCheckoutCutoff,
  summarizeWebhookHealth,
} from "@/lib/analytics/admin-analytics-expansion";

describe("conversionPct", () => {
  it("is paid/attempts as a percent", () => {
    expect(conversionPct(2, 8)).toBe(25);
  });

  it("is 0 when there are no attempts", () => {
    expect(conversionPct(1, 0)).toBe(0);
  });
});

describe("isExpiredPaymentEvent", () => {
  it("treats Fincra charge.expired as expired even when status casing differs", () => {
    expect(isExpiredPaymentEvent({ type: "charge.expired", status: "EXPIRED" })).toBe(true);
    expect(isExpiredPaymentEvent({ type: "charge.successful", status: "expired" })).toBe(true);
  });

  it("does not treat paid or failed events as expired", () => {
    expect(isExpiredPaymentEvent({ type: "charge.failed", status: "failed" })).toBe(false);
    expect(isExpiredPaymentEvent({ type: "transaction.paid", status: "paid" })).toBe(false);
  });
});

describe("buildPaymentsByProvider", () => {
  it("groups attempts, paid, failed, mismatch and expired by provider and currency", () => {
    const rows = buildPaymentsByProvider({
      statusCounts: [
        { provider: "fincra", currency: "NGN", status: "checkout_created", count: 4 },
        { provider: "fincra", currency: "NGN", status: "paid", count: 2 },
        { provider: "fincra", currency: "NGN", status: "failed", count: 1 },
        { provider: "fincra", currency: "NGN", status: "mismatch", count: 1 },
        { provider: "paddle", currency: "USD", status: "paid", count: 3 },
      ],
      expiredCounts: [{ provider: "fincra", currency: "NGN", count: 2 }],
      timeToPay: [
        {
          provider: "fincra",
          currency: "NGN",
          avgSeconds: 90,
          p50Seconds: 60,
          p95Seconds: 180,
        },
      ],
    });

    const fincra = rows.find((r) => r.provider === "fincra" && r.currency === "NGN");
    expect(fincra).toEqual({
      provider: "fincra",
      currency: "NGN",
      attempts: 8,
      paid: 2,
      failed: 1,
      expired: 2,
      mismatch: 1,
      conversionPct: 25,
      timeToPaySeconds: { avg: 90, p50: 60, p95: 180 },
    });

    const paddle = rows.find((r) => r.provider === "paddle");
    expect(paddle?.attempts).toBe(3);
    expect(paddle?.paid).toBe(3);
    expect(paddle?.expired).toBe(0);
    expect(paddle?.conversionPct).toBe(100);
    expect(paddle?.timeToPaySeconds).toEqual({ avg: null, p50: null, p95: null });
  });

  it("does not mix currencies for the same provider", () => {
    const rows = buildPaymentsByProvider({
      statusCounts: [
        { provider: "ziina", currency: "AED", status: "paid", count: 1 },
        { provider: "ziina", currency: "USD", status: "paid", count: 2 },
      ],
      expiredCounts: [],
      timeToPay: [],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.currency).sort()).toEqual(["AED", "USD"]);
  });
});

describe("summarizeWebhookHealth", () => {
  it("counts matched, unmatched, and bad signatures without exposing payloads", () => {
    const summary = summarizeWebhookHealth(
      [
        {
          provider: "fincra",
          type: "charge.successful",
          status: "success",
          matched: true,
          signatureValid: true,
          count: 5,
        },
        {
          provider: "fincra",
          type: "charge.expired",
          status: "expired",
          matched: false,
          signatureValid: true,
          count: 2,
        },
        {
          provider: "paddle",
          type: "transaction.paid",
          status: "paid",
          matched: true,
          signatureValid: false,
          count: 1,
        },
      ],
      [
        {
          provider: "fincra",
          type: "charge.successful",
          status: "success",
          matched: true,
          signatureValid: true,
          count: 4,
        },
      ],
    );

    expect(summary.matched.current).toBe(6);
    expect(summary.matched.previous).toBe(4);
    expect(summary.unmatched.current).toBe(2);
    expect(summary.unmatched.previous).toBe(0);
    expect(summary.badSignatures.current).toBe(1);
    expect(summary.byType).toEqual([
      { provider: "fincra", type: "charge.expired", status: "expired", count: 2 },
      { provider: "fincra", type: "charge.successful", status: "success", count: 5 },
      { provider: "paddle", type: "transaction.paid", status: "paid", count: 1 },
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/email|passport|payload/i);
  });
});

describe("ocrTokenUsageFromJson", () => {
  it("reads Gemini usageMetadata camelCase fields", () => {
    expect(
      ocrTokenUsageFromJson({
        promptTokenCount: 100,
        candidatesTokenCount: 40,
        totalTokenCount: 140,
      }),
    ).toEqual({ promptTokens: 100, outputTokens: 40, totalTokens: 140 });
  });

  it("falls back to snake_case aliases and sums when total is missing", () => {
    expect(
      ocrTokenUsageFromJson({
        prompt_token_count: 10,
        candidates_token_count: 5,
      }),
    ).toEqual({ promptTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it("returns zeros for missing or non-object usage", () => {
    expect(ocrTokenUsageFromJson(null)).toEqual({
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });
});

describe("manualEditRatePct", () => {
  it("is null when no provenance rows exist", () => {
    expect(manualEditRatePct({ withProvenance: 0, withManualField: 0 })).toBeNull();
  });

  it("is the share of applications with at least one manual field", () => {
    expect(manualEditRatePct({ withProvenance: 10, withManualField: 4 })).toBe(40);
  });
});

describe("stuckCheckoutCutoff", () => {
  it("is 15 minutes before the range end, matching the Fincra stale window", () => {
    expect(STUCK_CHECKOUT_THRESHOLD_MS).toBe(15 * 60 * 1000);
    const asOf = new Date("2026-10-25T12:00:00.000Z");
    expect(stuckCheckoutCutoff(asOf).toISOString()).toBe("2026-10-25T11:45:00.000Z");
  });
});

describe("isAuditedCancelResetAction", () => {
  it("counts Fincra checkout abandons written to audit_log", () => {
    expect(AUDITED_CANCEL_RESET_ACTIONS).toEqual(["payment_fincra_checkout_abandoned"]);
    expect(isAuditedCancelResetAction("payment_fincra_checkout_abandoned")).toBe(true);
    expect(isAuditedCancelResetAction("application.refund.initiate")).toBe(false);
  });
});

describe("percentile and median", () => {
  it("returns null for an empty series", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(median([])).toBeNull();
  });

  it("uses linear interpolation on a sorted numeric series", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0.95)).toBe(38.5);
    expect(median([3, 1, 2])).toBe(2);
  });
});

describe("ageHours", () => {
  it("is elapsed hours from updatedAt to asOf", () => {
    expect(
      ageHours(new Date("2026-10-25T00:00:00.000Z"), new Date("2026-10-25T06:00:00.000Z")),
    ).toBe(6);
  });
});

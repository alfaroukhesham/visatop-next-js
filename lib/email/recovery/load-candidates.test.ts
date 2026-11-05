import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";
import type { DbTransaction } from "@/lib/db";
import {
  checkoutRecoveryCandidatesQuery,
  matchesCheckoutRecoverySqlCandidate,
} from "./load-candidates";

const db = drizzle({ connection: { host: "127.0.0.1", database: "unused" } });

afterAll(async () => {
  await db.$client.end();
});

const now = new Date("2026-11-05T12:00:00.000Z");
const params = {
  now,
  delayMs: 60 * 60_000,
  maxAgeMs: 24 * 60 * 60_000,
  limit: 100,
};

describe("checkoutRecoveryCandidatesQuery", () => {
  it("requires a still-open checkout in the delay window, excludes already-sent, and orders by checkout time", () => {
    const { sql: statement, params: queryParams } = checkoutRecoveryCandidatesQuery(
      db as unknown as DbTransaction,
      params,
    ).toSQL();
    const sql = statement.toLowerCase();
    const bound = queryParams.map((value) => String(value));

    expect(sql).toContain('"application"."payment_status"');
    expect(bound).toContain("checkout_created");
    expect(bound).toContain("recovery_checkout");
    expect(sql).toContain("exists");
    expect(sql).toContain("transactional_email_sent");
    expect(sql).toContain("not exists");
    expect(sql).toContain("order by");
    expect(sql).toContain("p2.created_at");
    expect(sql).not.toMatch(/order by[\s\S]*updated_at/);
    expect(sql).toContain('"payment"."created_at" <=');
    expect(sql).toContain('"payment"."created_at" >=');
  });
});

describe("matchesCheckoutRecoverySqlCandidate", () => {
  const windows = { now, delayMs: params.delayMs, maxAgeMs: params.maxAgeMs };

  it("does not let a batch of draft-only apps crowd out an older open checkout", () => {
    const drafts = Array.from({ length: 100 }, (_, i) => ({
      id: `draft-${i}`,
      paymentStatus: "unpaid",
      latestPaymentStatus: null as string | null,
      checkoutCreatedAt: null as Date | null,
      alreadySent: false,
      ...windows,
    }));
    const checkout = {
      id: "checkout-old",
      paymentStatus: "checkout_created",
      latestPaymentStatus: "checkout_created",
      checkoutCreatedAt: new Date(now.getTime() - 90 * 60_000),
      alreadySent: false,
      ...windows,
    };
    const picked = [...drafts, checkout].filter(matchesCheckoutRecoverySqlCandidate);
    expect(picked).toHaveLength(1);
    expect(picked[0]).toMatchObject({ paymentStatus: "checkout_created" });
  });

  it("excludes already-sent checkout rows", () => {
    expect(
      matchesCheckoutRecoverySqlCandidate({
        paymentStatus: "checkout_created",
        latestPaymentStatus: "checkout_created",
        checkoutCreatedAt: new Date(now.getTime() - 90 * 60_000),
        alreadySent: true,
        ...windows,
      }),
    ).toBe(false);
  });

  it("excludes reconciled-expired checkouts", () => {
    expect(
      matchesCheckoutRecoverySqlCandidate({
        paymentStatus: "unpaid",
        latestPaymentStatus: "failed",
        checkoutCreatedAt: new Date(now.getTime() - 90 * 60_000),
        alreadySent: false,
        ...windows,
      }),
    ).toBe(false);
  });
});

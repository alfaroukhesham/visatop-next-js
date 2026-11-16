import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { application } from "./applications";
import { payment, paymentFincraAttempt } from "./payments";

const SQL_PATH = "drizzle/0040_fincra_attempt_lifecycle.sql";

describe("0040 Fincra attempt lifecycle migration", () => {
  it("adds nullable attention and settled-reference columns", () => {
    const appCols = getTableColumns(application);
    expect(appCols.adminAttentionReason.columnType).toBe("PgText");
    expect(appCols.adminAttentionReason.notNull).toBe(false);
    expect(appCols.adminAttentionDetails.columnType).toBe("PgJsonb");
    expect(appCols.adminAttentionDetails.notNull).toBe(false);

    const payCols = getTableColumns(payment);
    expect(payCols.settledMerchantReference.columnType).toBe("PgText");
    expect(payCols.settledMerchantReference.notNull).toBe(false);

    const attemptCols = getTableColumns(paymentFincraAttempt);
    expect(attemptCols.merchantReference.notNull).toBe(true);
    expect(attemptCols.paymentId.notNull).toBe(true);
  });

  it("is additive-only and journals after meta CAPI purchase", () => {
    const sql = readFileSync(SQL_PATH, "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "payment_fincra_attempt"/);
    expect(sql).toMatch(/ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "settled_merchant_reference" text/);
    expect(sql).toMatch(/ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "admin_attention_reason" text/);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const previous = journal.entries.find((e) => e.tag === "0039_meta_capi_purchase");
    const next = journal.entries.find((e) => e.tag === "0040_fincra_attempt_lifecycle");
    expect(previous).toBeTruthy();
    expect(next).toBeTruthy();
    expect(next!.when).toBeGreaterThan(previous!.when);
  });
});

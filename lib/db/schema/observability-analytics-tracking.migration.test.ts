import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { analyticsFunnelEvent } from "./analytics-funnel-event";
import { application } from "./applications";
import { payment } from "./payments";

const SQL_PATH = "drizzle/0038_observability_analytics_tracking.sql";

describe("0038 observability analytics tracking migration", () => {
  it("adds nullable timestamp and failure columns (old rows still work)", () => {
    const appCols = getTableColumns(application);
    expect(appCols.paidAt.columnType).toBe("PgTimestamp");
    expect(appCols.paidAt.notNull).toBe(false);
    expect(appCols.fulfilledAt.columnType).toBe("PgTimestamp");
    expect(appCols.fulfilledAt.notNull).toBe(false);

    const payCols = getTableColumns(payment);
    expect(payCols.failureCode.columnType).toBe("PgText");
    expect(payCols.failureCode.notNull).toBe(false);
    expect(payCols.failureMessage.columnType).toBe("PgText");
    expect(payCols.failureMessage.notNull).toBe(false);

    const funnelCols = getTableColumns(analyticsFunnelEvent);
    expect(funnelCols.countryCode.columnType).toBe("PgText");
    expect(funnelCols.countryCode.notNull).toBe(false);
    expect(funnelCols.deviceType.columnType).toBe("PgText");
    expect(funnelCols.deviceType.notNull).toBe(false);
  });

  it("is additive-only and journals after the Fincra payment_event audit migration", () => {
    const sql = readFileSync(SQL_PATH, "utf8");
    expect(sql).toMatch(/ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "paid_at" timestamp/);
    expect(sql).toMatch(/ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "fulfilled_at" timestamp/);
    expect(sql).toMatch(/ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "failure_code" text/);
    expect(sql).toMatch(/ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "failure_message" text/);
    expect(sql).toMatch(/ALTER TABLE "analytics_funnel_event" ADD COLUMN IF NOT EXISTS "country_code" text/);
    expect(sql).toMatch(/ALTER TABLE "analytics_funnel_event" ADD COLUMN IF NOT EXISTS "device_type" text/);
    expect(sql).toMatch(/payment_marked_paid/);
    expect(sql).toMatch(/charge\.failed/);
    expect(sql).toMatch(/charge\.expired/);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/ADD COLUMN[^;]*NOT NULL/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const previous = journal.entries.find((e) => e.tag === "0037_payment_event_fincra_audit");
    const next = journal.entries.find((e) => e.tag === "0038_observability_analytics_tracking");
    expect(previous).toBeTruthy();
    expect(next).toBeTruthy();
    expect(next!.when).toBeGreaterThan(previous!.when);
  });
});

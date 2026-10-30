import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { application } from "./applications";

const SQL_PATH = "drizzle/0039_meta_capi_purchase.sql";

describe("0039 meta CAPI purchase migration", () => {
  it("adds nullable attribution and sent-at columns (old rows still work)", () => {
    const cols = getTableColumns(application);
    expect(cols.metaFbp.columnType).toBe("PgText");
    expect(cols.metaFbp.notNull).toBe(false);
    expect(cols.metaFbc.columnType).toBe("PgText");
    expect(cols.metaFbc.notNull).toBe(false);
    expect(cols.metaClientIp.columnType).toBe("PgText");
    expect(cols.metaClientIp.notNull).toBe(false);
    expect(cols.metaClientUserAgent.columnType).toBe("PgText");
    expect(cols.metaClientUserAgent.notNull).toBe(false);
    expect(cols.metaEventSourceUrl.columnType).toBe("PgText");
    expect(cols.metaEventSourceUrl.notNull).toBe(false);
    expect(cols.capiPurchaseSentAt.columnType).toBe("PgTimestamp");
    expect(cols.capiPurchaseSentAt.notNull).toBe(false);
  });

  it("is additive-only and journals after the observability analytics tracking migration", () => {
    const sql = readFileSync(SQL_PATH, "utf8");
    expect(sql).toMatch(/ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_fbp" text/);
    expect(sql).toMatch(/ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_fbc" text/);
    expect(sql).toMatch(/ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_client_ip" text/);
    expect(sql).toMatch(
      /ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_client_user_agent" text/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_event_source_url" text/,
    );
    expect(sql).toMatch(
      /ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "capi_purchase_sent_at" timestamp/,
    );
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/ADD COLUMN[^;]*NOT NULL/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const previous = journal.entries.find((e) => e.tag === "0038_observability_analytics_tracking");
    const next = journal.entries.find((e) => e.tag === "0039_meta_capi_purchase");
    expect(previous).toBeTruthy();
    expect(next).toBeTruthy();
    expect(next!.when).toBeGreaterThan(previous!.when);
  });
});

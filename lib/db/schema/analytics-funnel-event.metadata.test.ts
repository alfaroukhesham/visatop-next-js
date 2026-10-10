import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { analyticsFunnelEvent } from "./analytics-funnel-event";

describe("analytics_funnel_event metadata column", () => {
  it("is optional jsonb on the table (old inserts without it still work)", () => {
    const cols = getTableColumns(analyticsFunnelEvent);
    expect(cols.metadata.columnType).toBe("PgJsonb");
    expect(cols.metadata.notNull).toBe(false);
  });

  it("ships an additive nullable migration for blue-green overlap", () => {
    const sql = readFileSync("drizzle/0033_analytics_funnel_event_metadata.sql", "utf8");
    expect(sql).toMatch(/ALTER TABLE "analytics_funnel_event" ADD COLUMN "metadata" jsonb\s*;/);
    expect(sql).not.toMatch(/NOT NULL/);
    expect(sql).not.toMatch(/DROP /i);

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const wizard = journal.entries.find((e) => e.tag === "0032_apply_wizard_cursor");
    const metadata = journal.entries.find((e) => e.tag === "0033_analytics_funnel_event_metadata");
    expect(wizard).toBeTruthy();
    expect(metadata).toBeTruthy();
    expect(metadata!.when).toBeGreaterThan(wizard!.when);
  });
});

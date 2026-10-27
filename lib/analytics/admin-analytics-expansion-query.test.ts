import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";
import { expiredPaymentEventCountQuery } from "@/lib/analytics/admin-analytics-expansion-query";
import type { DbTransaction } from "@/lib/db";

const db = drizzle({ connection: { host: "127.0.0.1", database: "unused" } });

afterAll(async () => {
  await db.$client.end();
});

describe("expiredPaymentEventCountQuery", () => {
  it("groups the counted payment_event columns so Postgres accepts the aggregate", () => {
    const { sql: statement } = expiredPaymentEventCountQuery(db as unknown as DbTransaction, {
      from: new Date("2026-10-20T00:00:00.000Z"),
      to: new Date("2026-10-27T00:00:00.000Z"),
    }).toSQL();
    const grouped = statement.toLowerCase();
    const groupBy = grouped.slice(grouped.indexOf("group by"));

    expect(grouped).toContain("count(");
    expect(groupBy).toContain("coalesce");
    expect(groupBy).toContain('"payment_event"."type"');
    expect(groupBy).toContain('"payment_event"."status"');
    expect(groupBy).toContain('"payment_event"."provider"');
    expect(groupBy).toContain('"payment"."provider"');
    expect(groupBy).toContain('"payment"."currency"');
  });
});

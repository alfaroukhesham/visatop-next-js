import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { applicationParty } from "./application-party";
import { applicationExtraSelection, checkoutExtra, checkoutExtraPrice } from "./checkout-extra";

const SQL_PATH = "drizzle/0041_checkout_extras.sql";

describe("0041 checkout extras migration", () => {
  it("adds extras, per-currency prices, party fields, and selections", () => {
    const extra = getTableColumns(checkoutExtra);
    expect(extra.key.notNull).toBe(true);
    expect(extra.enabled.notNull).toBe(true);
    expect(extra.baseCurrency.notNull).toBe(true);
    expect(extra.baseAmountMinor.notNull).toBe(true);
    expect(extra.labelI18n.columnType).toBe("PgJsonb");
    expect(extra.promiseI18n.notNull).toBe(false);
    expect(extra.termsUrl.notNull).toBe(false);

    const price = getTableColumns(checkoutExtraPrice);
    expect(price.extraId.notNull).toBe(true);
    expect(price.currency.notNull).toBe(true);
    expect(price.amountMinor.notNull).toBe(true);

    const party = getTableColumns(applicationParty);
    expect(party.travelDate.columnType).toBe("PgDateString");
    expect(party.travelDate.notNull).toBe(false);
    expect(party.processingSpeed.columnType).toBe("PgText");
    expect(party.processingSpeed.notNull).toBe(false);
    expect(party.processingSpeedSource.columnType).toBe("PgText");
    expect(party.processingSpeedSource.notNull).toBe(false);

    const selection = getTableColumns(applicationExtraSelection);
    expect(selection.applicationId.notNull).toBe(true);
    expect(selection.extraId.notNull).toBe(true);
    expect(selection.selected.notNull).toBe(true);
  });

  it("seeds both extras disabled with only the starting currency price", () => {
    const sql = readFileSync(SQL_PATH, "utf8");
    expect(sql).toMatch(/CREATE TABLE "checkout_extra"/);
    expect(sql).toMatch(/CREATE TABLE "checkout_extra_price"/);
    expect(sql).toMatch(/CREATE TABLE "application_extra_selection"/);
    expect(sql).toMatch(/ALTER TABLE "application_party" ADD COLUMN "travel_date" date/);
    expect(sql).toMatch(/ALTER TABLE "application_party" ADD COLUMN "processing_speed" text/);
    expect(sql).toMatch(/ALTER TABLE "application_party" ADD COLUMN "processing_speed_source" text/);
    expect(sql).toContain("'system', 'customer'");
    expect(sql).not.toMatch(/fast_track_mode/);
    expect(sql).not.toMatch(/default_selected/);
    expect(sql).not.toMatch(/checkout_extra_service/);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);

    expect(sql).toContain("'fast_track_threshold_days', '4'");
    expect(sql).toContain("'travel_date_required', 'true'");
    expect(sql).toContain("'travel_date_max_days_ahead', '180'");
    expect(sql).toContain("checkout_extra_admin_select");
    expect(sql).toContain("checkout_extra_price_system_select");
    expect(sql).toContain("application_extra_selection_admin_select");
    expect(sql).toContain("application_extra_selection_client_select");
    expect(sql).toContain("platform_setting_admin_update_checkout_extras");

    const priceInsert = sql.slice(sql.indexOf('INSERT INTO "checkout_extra_price"'));
    const priceStatement = priceInsert.slice(0, priceInsert.indexOf("-->"));
    expect(priceStatement).toContain("'travel_insurance', 'AED', 7900");
    expect(priceStatement).toContain("'fast_track', 'USD', 10000");
    expect(priceStatement).not.toContain("NGN");
    expect(priceStatement).not.toContain("ZAR");

    const extraInsert = sql.slice(sql.indexOf('INSERT INTO "checkout_extra"'));
    const extraStatement = extraInsert.slice(0, extraInsert.indexOf("-->"));
    expect(extraStatement.match(/false/g)).toHaveLength(2);
    expect(extraStatement).toContain("within 24 hours");

    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const previous = journal.entries.find((entry) => entry.tag === "0040_fincra_attempt_lifecycle");
    const next = journal.entries.find((entry) => entry.tag === "0041_checkout_extras");
    expect(previous).toBeTruthy();
    expect(next).toBeTruthy();
    expect(next!.when).toBeGreaterThan(previous!.when);
    expect(journal.entries.filter((entry) => entry.tag === "0040_fincra_attempt_lifecycle")).toHaveLength(1);
  });
});

describe("0042 travel date optional migration", () => {
  it("turns the seeded required flag off and allows the step setting", () => {
    const sql = readFileSync("drizzle/0042_travel_date_optional.sql", "utf8");
    expect(sql).toContain("'travel_date_required' AND \"value\" = 'true'");
    expect(sql).toContain("'travel_date_step_enabled'");
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const previous = journal.entries.find((entry) => entry.tag === "0041_checkout_extras");
    const next = journal.entries.find((entry) => entry.tag === "0042_travel_date_optional");
    expect(next?.idx).toBe(42);
    expect(next && previous && next.when).toBeGreaterThan(previous!.when);
  });
});

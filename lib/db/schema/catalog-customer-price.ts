import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  bigint,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { nationality, visaService } from "./visa";

/**
 * Final customer list price per nationality × service × currency.
 * Source-of-truth for catalog display and checkout locking.
 * Unique constraint: (nationality_code, service_id, currency).
 *
 * source values:
 *   'admin_import'            – explicitly set by admin XLSX upload
 *   'admin_ui'                – set via UI (future)
 *   'fx_derived_aed_from_usd' – AED materialised from USD row via env FX rate
 *   'fx_derived_usd_from_aed' – USD materialised from AED row via inverse env FX rate
 */
export const catalogCustomerPrice = pgTable(
  "catalog_customer_price",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    /** ISO 4217: 'USD' | 'AED' */
    currency: text("currency").notNull(),
    /** Final customer total in minor units (cents / fils). */
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    /**
     * Audit trail: how this row was created.
     * 'admin_import' | 'admin_ui' | 'fx_derived_aed_from_usd' | 'fx_derived_usd_from_aed'
     */
    source: text("source").notNull().default("admin_import"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("catalog_customer_price_nat_svc_cur_uidx").on(
      t.nationalityCode,
      t.serviceId,
      t.currency,
    ),
    index("catalog_customer_price_nationalityCode_idx").on(t.nationalityCode),
    index("catalog_customer_price_serviceId_idx").on(t.serviceId),
  ],
);

/**
 * Pending (currency-unassigned) import rows.
 * Created when a cell has a numeric amount but no parseable currency signal.
 * NOT customer-visible until admin assigns currency via the pending-currency wizard.
 */
export const catalogCustomerPricePending = pgTable(
  "catalog_customer_price_pending",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    /** Raw amount in minor units, currency TBD. */
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    /** Batch/import job reference for grouping pending rows from the same upload. */
    batchId: text("batch_id").notNull(),
    /** Original row/column reference for admin UX (e.g. "row 5, col D"). */
    rowRef: text("row_ref"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("catalog_customer_price_pending_batchId_idx").on(t.batchId),
    index("catalog_customer_price_pending_nat_svc_idx").on(
      t.nationalityCode,
      t.serviceId,
    ),
  ],
);

export const catalogCustomerPriceRelations = relations(
  catalogCustomerPrice,
  ({ one }) => ({
    nationality: one(nationality, {
      fields: [catalogCustomerPrice.nationalityCode],
      references: [nationality.code],
    }),
    service: one(visaService, {
      fields: [catalogCustomerPrice.serviceId],
      references: [visaService.id],
    }),
  }),
);

export const catalogCustomerPricePendingRelations = relations(
  catalogCustomerPricePending,
  ({ one }) => ({
    nationality: one(nationality, {
      fields: [catalogCustomerPricePending.nationalityCode],
      references: [nationality.code],
    }),
    service: one(visaService, {
      fields: [catalogCustomerPricePending.serviceId],
      references: [visaService.id],
    }),
  }),
);

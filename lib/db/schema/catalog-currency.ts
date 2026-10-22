import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nationality } from "./visa";

/**
 * Catalog currencies. GLOBAL rows are shown to every applicant.
 * LOCAL rows are shown only to linked nationalities.
 */
export const catalogCurrency = pgTable(
  "catalog_currency",
  {
    code: text("code").primaryKey(),
    kind: text("kind").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("catalog_currency_code_uidx").on(t.code)],
);

export const catalogCurrencyNationality = pgTable(
  "catalog_currency_nationality",
  {
    currencyCode: text("currency_code")
      .notNull()
      .references(() => catalogCurrency.code, { onDelete: "cascade" }),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({
      name: "catalog_currency_nationality_pk",
      columns: [t.currencyCode, t.nationalityCode],
    }),
    index("catalog_currency_nationality_nat_idx").on(t.nationalityCode),
  ],
);

export const catalogCurrencyRelations = relations(catalogCurrency, ({ many }) => ({
  nationalityLinks: many(catalogCurrencyNationality),
}));

export const catalogCurrencyNationalityRelations = relations(
  catalogCurrencyNationality,
  ({ one }) => ({
    currency: one(catalogCurrency, {
      fields: [catalogCurrencyNationality.currencyCode],
      references: [catalogCurrency.code],
    }),
    nationality: one(nationality, {
      fields: [catalogCurrencyNationality.nationalityCode],
      references: [nationality.code],
    }),
  }),
);

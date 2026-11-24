import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  bigint,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { application } from "./applications";

export const CHECKOUT_EXTRA_KEYS = ["travel_insurance", "fast_track"] as const;
export type TCheckoutExtraKey = (typeof CHECKOUT_EXTRA_KEYS)[number];

export const CHECKOUT_CHARGE_BASIS = ["per_traveller", "per_order"] as const;
export type TCheckoutChargeBasis = (typeof CHECKOUT_CHARGE_BASIS)[number];

export const PROCESSING_SPEEDS = ["standard", "fast_track"] as const;
export type TProcessingSpeed = (typeof PROCESSING_SPEEDS)[number];

/** Who last set application_party.processing_speed. */
export const PROCESSING_SPEED_SOURCES = ["system", "customer"] as const;
export type TProcessingSpeedSource = (typeof PROCESSING_SPEED_SOURCES)[number];

/**
 * Optional checkout extras. Disabled rows stay hidden from customers.
 * Prices live in checkout_extra_price; checkout must not invent a missing currency.
 */
export const checkoutExtra = pgTable(
  "checkout_extra",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    key: text("key").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    /** Seeded per_traveller. Not editable in admin; every extra is charged per traveller. */
    chargeBasis: text("charge_basis").default("per_traveller").notNull(),
    baseCurrency: text("base_currency").notNull(),
    baseAmountMinor: bigint("base_amount_minor", { mode: "number" }).notNull(),
    labelI18n: jsonb("label_i18n").$type<Record<string, string>>().notNull().default({}),
    descriptionI18n: jsonb("description_i18n")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    promiseI18n: jsonb("promise_i18n").$type<Record<string, string> | null>(),
    termsUrl: text("terms_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("checkout_extra_key_uidx").on(t.key)],
);

/** Admin-entered final amount for one currency. Missing row means the extra is hidden. */
export const checkoutExtraPrice = pgTable(
  "checkout_extra_price",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    extraId: text("extra_id")
      .notNull()
      .references(() => checkoutExtra.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("checkout_extra_price_extra_currency_uidx").on(t.extraId, t.currency),
    index("checkout_extra_price_extraId_idx").on(t.extraId),
  ],
);

/** Per-traveller opt-in. Written by a later checkout release; unused by totals today. */
export const applicationExtraSelection = pgTable(
  "application_extra_selection",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    extraId: text("extra_id")
      .notNull()
      .references(() => checkoutExtra.id, { onDelete: "cascade" }),
    selected: boolean("selected").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("application_extra_selection_app_extra_uidx").on(t.applicationId, t.extraId),
    index("application_extra_selection_applicationId_idx").on(t.applicationId),
  ],
);

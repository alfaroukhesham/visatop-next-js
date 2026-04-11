import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

export const nationality = pgTable(
  "nationality",
  {
    code: text("code").primaryKey(), // e.g. ISO 3166-1 alpha-2
    name: text("name").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("nationality_code_uidx").on(t.code)],
);

export const visaService = pgTable(
  "visa_service",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    durationDays: integer("duration_days"),
    entries: text("entries"), // single|multi (free-form for MVP)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("visa_service_enabled_idx").on(t.enabled),
    index("visa_service_createdAt_idx").on(t.createdAt),
  ],
);

export const visaServiceEligibility = pgTable(
  "visa_service_eligibility",
  {
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("visa_service_eligibility_uidx").on(
      t.serviceId,
      t.nationalityCode,
    ),
    index("visa_service_eligibility_serviceId_idx").on(t.serviceId),
    index("visa_service_eligibility_nationalityCode_idx").on(t.nationalityCode),
  ],
);

export const addon = pgTable(
  "addon",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** Display add-on line total in minor units (e.g. cents). */
    amount: bigint("amount", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    currency: text("currency").default("USD").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("addon_key_uidx").on(t.key)],
);

export const visaServiceAddon = pgTable(
  "visa_service_addon",
  {
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    addonId: text("addon_id")
      .notNull()
      .references(() => addon.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("visa_service_addon_uidx").on(t.serviceId, t.addonId),
    index("visa_service_addon_serviceId_idx").on(t.serviceId),
    index("visa_service_addon_addonId_idx").on(t.addonId),
  ],
);

export const visaServiceRelations = relations(visaService, ({ many }) => ({
  eligibility: many(visaServiceEligibility),
  addons: many(visaServiceAddon),
}));

export const nationalityRelations = relations(nationality, ({ many }) => ({
  eligibility: many(visaServiceEligibility),
}));


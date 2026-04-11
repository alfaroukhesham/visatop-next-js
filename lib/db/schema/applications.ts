import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  numeric,
  bigint,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { nationality, visaService } from "./visa";

export const application = pgTable(
  "application",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    isGuest: boolean("is_guest").default(true).notNull(),
    guestEmail: text("guest_email"),

    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code),
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id),

    applicationStatus: text("application_status").notNull(),
    paymentStatus: text("payment_status").notNull(),
    fulfillmentStatus: text("fulfillment_status").notNull(),

    referenceNumber: text("reference_number"),
    draftExpiresAt: timestamp("draft_expires_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("application_userId_idx").on(t.userId),
    index("application_serviceId_idx").on(t.serviceId),
    index("application_nationalityCode_idx").on(t.nationalityCode),
    index("application_status_idx").on(t.applicationStatus),
    index("application_paymentStatus_idx").on(t.paymentStatus),
    index("application_fulfillmentStatus_idx").on(t.fulfillmentStatus),
    index("application_draftExpiresAt_idx").on(t.draftExpiresAt),
  ],
);

export const marginPolicy = pgTable(
  "margin_policy",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    scope: text("scope").notNull(), // global|service
    serviceId: text("service_id").references(() => visaService.id, {
      onDelete: "cascade",
    }),
    mode: text("mode").notNull(), // percent|fixed
    value: numeric("value", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").default("USD").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("margin_policy_scope_idx").on(t.scope),
    index("margin_policy_serviceId_idx").on(t.serviceId),
  ],
);

export const priceQuote = pgTable(
  "price_quote",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    currency: text("currency").default("USD").notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(), // minor units
    breakdownJson: text("breakdown_json").notNull(),
    lockedAt: timestamp("locked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("price_quote_applicationId_idx").on(t.applicationId),
    index("price_quote_lockedAt_idx").on(t.lockedAt),
  ],
);

export const applicationRelations = relations(application, ({ one, many }) => ({
  user: one(user, { fields: [application.userId], references: [user.id] }),
  nationality: one(nationality, {
    fields: [application.nationalityCode],
    references: [nationality.code],
  }),
  service: one(visaService, {
    fields: [application.serviceId],
    references: [visaService.id],
  }),
  quotes: many(priceQuote),
}));

export const priceQuoteRelations = relations(priceQuote, ({ one }) => ({
  application: one(application, {
    fields: [priceQuote.applicationId],
    references: [application.id],
  }),
}));


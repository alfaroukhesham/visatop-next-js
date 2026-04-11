import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, index, bigint } from "drizzle-orm/pg-core";
import { application } from "./applications";

export const payment = pgTable(
  "payment",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // paddle
    providerCheckoutId: text("provider_checkout_id"),
    providerTransactionId: text("provider_transaction_id"),
    status: text("status").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // minor units
    currency: text("currency").default("USD").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("payment_applicationId_idx").on(t.applicationId),
    index("payment_provider_tx_idx").on(t.provider, t.providerTransactionId),
  ],
);

export const paymentEvent = pgTable(
  "payment_event",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id"),
    type: text("type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (t) => [
    index("payment_event_paymentId_idx").on(t.paymentId),
    index("payment_event_providerEvent_idx").on(t.providerEventId),
    index("payment_event_payloadHash_idx").on(t.payloadHash),
  ],
);

export const paymentRelations = relations(payment, ({ one, many }) => ({
  application: one(application, {
    fields: [payment.applicationId],
    references: [application.id],
  }),
  events: many(paymentEvent),
}));

export const paymentEventRelations = relations(paymentEvent, ({ one }) => ({
  payment: one(payment, { fields: [paymentEvent.paymentId], references: [payment.id] }),
}));


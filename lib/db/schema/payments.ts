import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, index, bigint, uniqueIndex, boolean } from "drizzle-orm/pg-core";
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
    /** Client idempotency key for Ziina create intent / refund (UUID). */
    providerOperationId: text("provider_operation_id"),
    providerTransactionId: text("provider_transaction_id"),
    status: text("status").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(), // minor units
    currency: text("currency").default("USD").notNull(),
    /** Provider-reported amount received, minor units (Fincra kobo). */
    amountReceivedMinor: bigint("amount_received_minor", { mode: "bigint" }),
    /** Provider fee, minor units. */
    feeMinor: bigint("fee_minor", { mode: "bigint" }),
    /** Fincra variance: underpayment | overpayment | exact. */
    varianceType: text("variance_type"),
    /**
     * FX snapshot for a future rate-based NGN price.
     * Launch uses stored catalog NGN (`fx_source = fixed_list`); these stay null until FX ships.
     */
    fxRateUsed: text("fx_rate_used"),
    fxBaseCurrency: text("fx_base_currency"),
    fxBaseAmountMinor: bigint("fx_base_amount_minor", { mode: "bigint" }),
    /** `fixed_list` | `snapshot` | `fincra_quote` */
    fxSource: text("fx_source"),
    /** Provider failure/expiry code (Ziina status, Fincra charge.failed/expired). Observability only. */
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("payment_applicationId_idx").on(t.applicationId),
    index("payment_provider_tx_idx").on(t.provider, t.providerTransactionId),
    index("payment_provider_operation_idx").on(t.providerOperationId),
  ],
);

export const paymentEvent = pgTable(
  "payment_event",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Null when a verified webhook did not match any payment row (e.g. staging refs on the shared live account). */
    paymentId: text("payment_id").references(() => payment.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id"),
    type: text("type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    provider: text("provider"),
    merchantReference: text("merchant_reference"),
    status: text("status"),
    signatureValid: boolean("signature_valid").default(true).notNull(),
    matched: boolean("matched").default(true).notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (t) => [
    index("payment_event_paymentId_idx").on(t.paymentId),
    index("payment_event_providerEvent_idx").on(t.providerEventId),
    uniqueIndex("payment_event_payload_hash_unique").on(t.payloadHash),
    index("payment_event_merchant_reference_idx").on(t.merchantReference),
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


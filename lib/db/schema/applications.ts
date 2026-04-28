import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  date,
  integer,
  jsonb,
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

    /** Catalog / checkout price book: USD or AED (must match `affiliate_reference_price` + margin rows). */
    catalogCurrency: text("catalog_currency").default("USD").notNull(),

    applicationStatus: text("application_status").notNull(),
    paymentStatus: text("payment_status").notNull(),
    fulfillmentStatus: text("fulfillment_status").notNull(),

    referenceNumber: text("reference_number"),
    draftExpiresAt: timestamp("draft_expires_at"),
    /** SHA-256 hex of guest resume token; null for signed-in drafts. */
    resumeTokenHash: text("resume_token_hash"),

    // Applicant profile (populated by OCR + manual edits; see spec §6.4 provenance).
    fullName: text("full_name"),
    dateOfBirth: date("date_of_birth"),
    placeOfBirth: text("place_of_birth"),
    /**
     * Applicant's nationality text as read by OCR or manually entered (free-form,
     * e.g. "Italian"). Distinct from `nationalityCode` (FK to nationality catalog).
     */
    applicantNationality: text("applicant_nationality"),
    passportNumber: text("passport_number"),
    passportExpiryDate: date("passport_expiry_date"),
    profession: text("profession"),
    address: text("address"),
    phone: text("phone"),
    /**
     * Per-field provenance: `{ fieldName: { source: 'ocr' | 'manual' } }`.
     * Absent fields default to `{ source: 'ocr' }` the first time OCR writes.
     * Once set to `manual`, OCR must not overwrite (spec §6.4).
     */
    applicantProfileProvenanceJson: jsonb("applicant_profile_provenance_json"),

    // Passport extraction summary (spec §9.4; lease fields drive §10.2.1 concurrency).
    passportExtractionStatus: text("passport_extraction_status")
      .notNull()
      .default("not_started"),
    passportExtractionUpdatedAt: timestamp("passport_extraction_updated_at"),
    passportExtractionStartedAt: timestamp("passport_extraction_started_at"),
    passportExtractionLeaseExpiresAt: timestamp("passport_extraction_lease_expires_at"),
    passportExtractionRunId: integer("passport_extraction_run_id")
      .notNull()
      .default(0),
    passportExtractionDocumentId: text("passport_extraction_document_id"),
    passportExtractionSha256: text("passport_extraction_sha256"),

    /**
     * Checkout document-freeze gate (spec §1). Nullable text:
     * - null or 'none': required docs may be replaced/deleted
     * - 'pending': user cannot mutate `passport_copy` / `personal_photo`
     */
    checkoutState: text("checkout_state"),

    adminAttentionRequired: boolean("admin_attention_required").default(false).notNull(),

    /** Free-form ops label (e.g. embassy step); set from admin UI only. */
    adminOpsStep: text("admin_ops_step"),

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
    index("application_resumeTokenHash_idx").on(t.resumeTokenHash),
    index("application_passportExtractionStatus_idx").on(t.passportExtractionStatus),
    index("application_passportExtractionLeaseExpiresAt_idx").on(
      t.passportExtractionLeaseExpiresAt,
    ),
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


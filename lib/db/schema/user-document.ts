import { relations, sql } from "drizzle-orm";
import { bigint, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { applicationDocument, bytea, DOCUMENT_TYPE } from "./application-document";
import { application } from "./applications";

export type UserDocumentType =
  | (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE]
  // Keep vault flexible even if app docs add more types later:
  | "supporting";

export const SUPPORTING_CATEGORY = {
  AIR_TICKET: "air_ticket",
  HOTEL_RESERVATION: "hotel_reservation",
  PASSPORT_ADDITIONAL_PAGE: "passport_additional_page",
  OTHER: "other",
} as const;
export type SupportingCategory = (typeof SUPPORTING_CATEGORY)[keyof typeof SUPPORTING_CATEGORY];

export const userDocument = pgTable(
  "user_document",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    documentType: text("document_type").notNull(), // matches UserDocumentType
    // Optional for `supporting` only
    supportingCategory: text("supporting_category"),

    contentType: text("content_type"),
    byteLength: bigint("byte_length", { mode: "number" }),
    originalFilename: text("original_filename"),
    sha256: text("sha256").notNull(),

    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("user_document_userId_idx").on(t.userId),
    index("user_document_type_idx").on(t.documentType),
    index("user_document_createdAt_idx").on(t.createdAt),
    uniqueIndex("user_document_user_sha_type_uidx").on(t.userId, t.sha256, t.documentType),
  ],
);

export const userDocumentBlob = pgTable("user_document_blob", {
  documentId: text("document_id")
    .primaryKey()
    .references(() => userDocument.id, { onDelete: "cascade" }),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const applicationDocumentSource = pgTable(
  "application_document_source",
  {
    applicationDocumentId: text("application_document_id")
      .primaryKey()
      .references(() => applicationDocument.id, { onDelete: "cascade" }),
    userDocumentId: text("user_document_id")
      .notNull()
      .references(() => userDocument.id, { onDelete: "cascade" }),
    copiedAt: timestamp("copied_at").defaultNow().notNull(),
  },
  (t) => [index("application_document_source_userDocumentId_idx").on(t.userDocumentId)],
);

export const userDocumentSourceApplication = pgTable(
  "user_document_source_application",
  {
    userDocumentId: text("user_document_id")
      .primaryKey()
      .references(() => userDocument.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    applicationDocumentId: text("application_document_id")
      .notNull()
      .references(() => applicationDocument.id, { onDelete: "cascade" }),
    ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
  },
  (t) => [
    index("user_document_source_application_applicationId_idx").on(t.applicationId),
    index("user_document_source_application_applicationDocumentId_idx").on(t.applicationDocumentId),
  ],
);

export const userDocumentRelations = relations(userDocument, ({ one }) => ({
  user: one(user, { fields: [userDocument.userId], references: [user.id] }),
  blob: one(userDocumentBlob, {
    fields: [userDocument.id],
    references: [userDocumentBlob.documentId],
  }),
}));


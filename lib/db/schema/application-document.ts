import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { application } from "./applications";

/** Postgres `bytea` column typed as Buffer in Node / Uint8Array at the edge. */
export const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const applicationDocument = pgTable(
  "application_document",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    /**
     * Legacy column from Phase 2. Nullable after 0007: bytes now live in
     * `application_document_blob`. Old rows may still carry a key.
     */
    storageKey: text("storage_key"),
    /** Superseded by `contentType`; kept for back-compat with Phase 2 rows. */
    mimeType: text("mime_type"),
    /** Superseded by `byteLength`. */
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    /** Old extraction tracker from Phase 2; new pipeline uses `application_document_extraction`. */
    extractionStatus: text("extraction_status").default("pending"),

    // New (spec §9.1).
    documentType: text("document_type"), // passport_copy | personal_photo | supporting
    status: text("status"), // uploaded_temp | retained | rejected | deleted
    contentType: text("content_type"),
    byteLength: bigint("byte_length", { mode: "number" }),
    originalFilename: text("original_filename"),
    sha256: text("sha256"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("application_document_applicationId_idx").on(t.applicationId),
    index("application_document_documentType_idx").on(t.documentType),
    index("application_document_status_idx").on(t.status),
    uniqueIndex("application_document_app_type_sha_uidx").on(
      t.applicationId,
      t.documentType,
      t.sha256,
    ),
  ],
);

/** 1:1 blob storage — bytes live here so selects on metadata stay cheap. */
export const applicationDocumentBlob = pgTable("application_document_blob", {
  documentId: text("document_id")
    .primaryKey()
    .references(() => applicationDocument.id, { onDelete: "cascade" }),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Nullable once retained; mirrors `application.draftExpiresAt` while unpaid. */
  tempExpiresAt: timestamp("temp_expires_at"),
  retainedAt: timestamp("retained_at"),
});

/** Per-attempt extraction row (spec §9.3). */
export const applicationDocumentExtraction = pgTable(
  "application_document_extraction",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentId: text("document_id")
      .notNull()
      .references(() => applicationDocument.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    status: text("status").notNull(), // started | succeeded | failed
    provider: text("provider").notNull(),
    model: text("model"),
    promptVersion: integer("prompt_version"),
    latencyMs: integer("latency_ms"),
    usage: jsonb("usage"),
    resultJson: jsonb("result_json"),
    validationJson: jsonb("validation_json"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [
    index("application_document_extraction_documentId_idx").on(t.documentId),
    index("application_document_extraction_attempt_idx").on(t.documentId, t.attempt),
  ],
);

export const applicationDocumentRelations = relations(applicationDocument, ({ one, many }) => ({
  application: one(application, {
    fields: [applicationDocument.applicationId],
    references: [application.id],
  }),
  blob: one(applicationDocumentBlob, {
    fields: [applicationDocument.id],
    references: [applicationDocumentBlob.documentId],
  }),
  extractions: many(applicationDocumentExtraction),
}));

export const applicationDocumentBlobRelations = relations(
  applicationDocumentBlob,
  ({ one }) => ({
    document: one(applicationDocument, {
      fields: [applicationDocumentBlob.documentId],
      references: [applicationDocument.id],
    }),
  }),
);

export const applicationDocumentExtractionRelations = relations(
  applicationDocumentExtraction,
  ({ one }) => ({
    document: one(applicationDocument, {
      fields: [applicationDocumentExtraction.documentId],
      references: [applicationDocument.id],
    }),
  }),
);

/** Stable string unions used across app code. */
export const DOCUMENT_TYPE = {
  PASSPORT_COPY: "passport_copy",
  PERSONAL_PHOTO: "personal_photo",
  SUPPORTING: "supporting",
} as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE];

export const DOCUMENT_STATUS = {
  UPLOADED_TEMP: "uploaded_temp",
  RETAINED: "retained",
  REJECTED: "rejected",
  DELETED: "deleted",
} as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export const EXTRACTION_STATUS = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  NEEDS_MANUAL: "needs_manual",
  BLOCKED_INVALID_DOC: "blocked_invalid_doc",
  FAILED: "failed",
} as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUS)[keyof typeof EXTRACTION_STATUS];

export const EXTRACTION_ATTEMPT_STATUS = {
  STARTED: "started",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;
export type ExtractionAttemptStatus =
  (typeof EXTRACTION_ATTEMPT_STATUS)[keyof typeof EXTRACTION_ATTEMPT_STATUS];

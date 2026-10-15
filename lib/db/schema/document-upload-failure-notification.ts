import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { application } from "./applications";

/**
 * Idempotent document-upload failure alerts. One open row per
 * (application, document type, failure group). Resolving clears the partial
 * unique so a later failure of the same group can alert again.
 */
export const documentUploadFailureNotification = pgTable(
  "document_upload_failure_notification",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(gen_random_uuid())::text`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    failureGroup: text("failure_group").notNull(),
    errorCode: text("error_code").notNull(),
    httpStatus: integer("http_status").notNull(),
    applicantNotified: boolean("applicant_notified").notNull().default(false),
    locale: text("locale").notNull().default("en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    uniqueIndex("document_upload_failure_notification_open_uidx")
      .on(t.applicationId, t.documentType, t.failureGroup)
      .where(sql`${t.resolvedAt} is null`),
    index("document_upload_failure_notification_application_id_idx").on(t.applicationId),
    index("document_upload_failure_notification_document_type_idx").on(t.documentType),
  ],
);

export const documentUploadFailureNotificationRelations = relations(
  documentUploadFailureNotification,
  ({ one }) => ({
    application: one(application, {
      fields: [documentUploadFailureNotification.applicationId],
      references: [application.id],
    }),
  }),
);

import { relations, sql } from "drizzle-orm";
import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { application } from "./applications";

export const applicationDocument = pgTable(
  "application_document",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    extractionStatus: text("extraction_status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("application_document_applicationId_idx").on(t.applicationId)],
);

export const applicationDocumentRelations = relations(applicationDocument, ({ one }) => ({
  application: one(application, {
    fields: [applicationDocument.applicationId],
    references: [application.id],
  }),
}));

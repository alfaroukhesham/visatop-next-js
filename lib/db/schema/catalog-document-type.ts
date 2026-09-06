import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const catalogDocumentType = pgTable("catalog_document_type", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  acceptMime: text("accept_mime").notNull().default("image/jpeg,image/png,application/pdf"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

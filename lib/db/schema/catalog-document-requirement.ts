import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { nationality, visaService } from "./visa";

export const CATALOG_DOCUMENT_ROLE = {
  REQUIRED: "required",
  ADDITIONAL: "additional",
} as const;

export const catalogDocumentRequirement = pgTable(
  "catalog_document_requirement",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("catalog_document_requirement_uidx").on(
      t.nationalityCode,
      t.serviceId,
      t.documentType,
    ),
    index("catalog_document_requirement_nat_idx").on(t.nationalityCode),
    index("catalog_document_requirement_svc_idx").on(t.serviceId),
  ],
);

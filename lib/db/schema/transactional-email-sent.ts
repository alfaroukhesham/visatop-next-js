import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { application } from "./applications";

/** One row per (application, kind) — idempotent transactional sends (Mailgun). */
export const transactionalEmailSent = pgTable(
  "transactional_email_sent",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(gen_random_uuid())::text`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("transactional_email_sent_application_id_kind_uidx").on(t.applicationId, t.kind),
    index("transactional_email_sent_application_id_idx").on(t.applicationId),
  ],
);

export const transactionalEmailSentRelations = relations(transactionalEmailSent, ({ one }) => ({
  application: one(application, {
    fields: [transactionalEmailSent.applicationId],
    references: [application.id],
  }),
}));

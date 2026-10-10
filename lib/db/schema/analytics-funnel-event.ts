import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { application } from "./applications";

export const analyticsFunnelEvent = pgTable(
  "analytics_funnel_event",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventId: text("event_id").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    eventName: text("event_name").notNull(),
    sessionId: text("session_id").notNull(),
    applicationId: text("application_id").references(() => application.id, { onDelete: "set null" }),
    nationalityCode: text("nationality_code"),
    serviceId: text("service_id"),
    metadata: jsonb("metadata"),
    source: text("source").notNull(),
    failureReason: text("failure_reason"),
  },
  (t) => [
    uniqueIndex("analytics_funnel_event_eventId_uidx").on(t.eventId),
    index("analytics_funnel_event_occurredAt_idx").on(t.occurredAt),
    index("analytics_funnel_event_eventName_idx").on(t.eventName),
    index("analytics_funnel_event_applicationId_idx").on(t.applicationId),
    index("analytics_funnel_event_sessionId_idx").on(t.sessionId),
  ],
);

export const analyticsFunnelEventRelations = relations(analyticsFunnelEvent, ({ one }) => ({
  application: one(application, {
    fields: [analyticsFunnelEvent.applicationId],
    references: [application.id],
  }),
}));

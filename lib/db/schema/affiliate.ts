import { relations, sql } from "drizzle-orm";
import { pgTable, text, boolean, timestamp, index, bigint } from "drizzle-orm/pg-core";
import { visaService } from "./visa";
import { application } from "./applications";
import { adminUser } from "./admin-auth";

export const affiliateSite = pgTable(
  "affiliate_site",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    domain: text("domain").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("affiliate_site_domain_idx").on(t.domain)],
);

export const affiliateConnector = pgTable(
  "affiliate_connector",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    siteId: text("site_id")
      .notNull()
      .references(() => affiliateSite.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    killSwitch: boolean("kill_switch").default(false).notNull(),
    selectorVersion: text("selector_version").default("v1").notNull(),
    configJson: text("config_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("affiliate_connector_siteId_idx").on(t.siteId),
    index("affiliate_connector_enabled_idx").on(t.enabled),
  ],
);

export const affiliateReferencePrice = pgTable(
  "affiliate_reference_price",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    siteId: text("site_id")
      .notNull()
      .references(() => affiliateSite.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(), // minor units
    currency: text("currency").default("USD").notNull(),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
    sourceUrl: text("source_url"),
    rawJson: text("raw_json"),
  },
  (t) => [
    index("affiliate_reference_price_siteService_idx").on(t.siteId, t.serviceId),
    index("affiliate_reference_price_observedAt_idx").on(t.observedAt),
  ],
);

export const priceSyncJob = pgTable(
  "price_sync_job",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    status: text("status").notNull(), // queued|running|succeeded|failed
    requestedByAdminId: text("requested_by_admin_id").references(() => adminUser.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    logJson: text("log_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("price_sync_job_status_idx").on(t.status)],
);

export const automationJob = pgTable(
  "automation_job",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    connectorId: text("connector_id")
      .notNull()
      .references(() => affiliateConnector.id, { onDelete: "restrict" }),
    status: text("status").notNull(), // queued|running|succeeded_ready_for_ops_payment|failed_retryable|failed_needs_manual
    attempt: text("attempt").default("1").notNull(),
    lastError: text("last_error"),
    artifactJson: text("artifact_json"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("automation_job_applicationId_idx").on(t.applicationId),
    index("automation_job_connectorId_idx").on(t.connectorId),
    index("automation_job_status_idx").on(t.status),
  ],
);

export const affiliateSiteRelations = relations(affiliateSite, ({ many }) => ({
  connectors: many(affiliateConnector),
  referencePrices: many(affiliateReferencePrice),
}));

export const affiliateConnectorRelations = relations(
  affiliateConnector,
  ({ one, many }) => ({
    site: one(affiliateSite, {
      fields: [affiliateConnector.siteId],
      references: [affiliateSite.id],
    }),
    jobs: many(automationJob),
  }),
);


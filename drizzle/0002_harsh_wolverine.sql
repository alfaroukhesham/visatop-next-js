CREATE TABLE "affiliate_connector" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"selector_version" text DEFAULT 'v1' NOT NULL,
	"config_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_reference_price" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" text NOT NULL,
	"service_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"source_url" text,
	"raw_json" text
);
--> statement-breakpoint
CREATE TABLE "affiliate_site" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_job" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"status" text NOT NULL,
	"attempt" text DEFAULT '1' NOT NULL,
	"last_error" text,
	"artifact_json" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_sync_job" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"requested_by_admin_id" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"log_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"guest_email" text,
	"nationality_code" text NOT NULL,
	"service_id" text NOT NULL,
	"application_status" text NOT NULL,
	"payment_status" text NOT NULL,
	"fulfillment_status" text NOT NULL,
	"reference_number" text,
	"draft_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "margin_policy" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"service_id" text,
	"mode" text NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_quote" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"total_amount" bigint NOT NULL,
	"breakdown_json" text NOT NULL,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_permission" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role_permission" (
	"role_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_user_role" (
	"admin_user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_json" text,
	"after_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nationality" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_service" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"duration_days" integer,
	"entries" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_service_addon" (
	"service_id" text NOT NULL,
	"addon_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_service_eligibility" (
	"service_id" text NOT NULL,
	"nationality_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_checkout_id" text,
	"provider_transaction_id" text,
	"status" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_event" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" text NOT NULL,
	"provider_event_id" text,
	"type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_connector" ADD CONSTRAINT "affiliate_connector_site_id_affiliate_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."affiliate_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_reference_price" ADD CONSTRAINT "affiliate_reference_price_site_id_affiliate_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."affiliate_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_reference_price" ADD CONSTRAINT "affiliate_reference_price_service_id_visa_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."visa_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_job" ADD CONSTRAINT "automation_job_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_job" ADD CONSTRAINT "automation_job_connector_id_affiliate_connector_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."affiliate_connector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_sync_job" ADD CONSTRAINT "price_sync_job_requested_by_admin_id_admin_user_id_fk" FOREIGN KEY ("requested_by_admin_id") REFERENCES "public"."admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_nationality_code_nationality_code_fk" FOREIGN KEY ("nationality_code") REFERENCES "public"."nationality"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_service_id_visa_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."visa_service"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "margin_policy" ADD CONSTRAINT "margin_policy_service_id_visa_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."visa_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_quote" ADD CONSTRAINT "price_quote_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_permission" ADD CONSTRAINT "admin_role_permission_role_id_admin_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_permission" ADD CONSTRAINT "admin_role_permission_permission_key_admin_permission_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."admin_permission"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user_role" ADD CONSTRAINT "admin_user_role_admin_user_id_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user_role" ADD CONSTRAINT "admin_user_role_role_id_admin_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_service_addon" ADD CONSTRAINT "visa_service_addon_service_id_visa_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."visa_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_service_addon" ADD CONSTRAINT "visa_service_addon_addon_id_addon_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_service_eligibility" ADD CONSTRAINT "visa_service_eligibility_service_id_visa_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."visa_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_service_eligibility" ADD CONSTRAINT "visa_service_eligibility_nationality_code_nationality_code_fk" FOREIGN KEY ("nationality_code") REFERENCES "public"."nationality"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_connector_siteId_idx" ON "affiliate_connector" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "affiliate_connector_enabled_idx" ON "affiliate_connector" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "affiliate_reference_price_siteService_idx" ON "affiliate_reference_price" USING btree ("site_id","service_id");--> statement-breakpoint
CREATE INDEX "affiliate_reference_price_observedAt_idx" ON "affiliate_reference_price" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "affiliate_site_domain_idx" ON "affiliate_site" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "automation_job_applicationId_idx" ON "automation_job" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "automation_job_connectorId_idx" ON "automation_job" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "automation_job_status_idx" ON "automation_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "price_sync_job_status_idx" ON "price_sync_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "application_userId_idx" ON "application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_serviceId_idx" ON "application" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "application_nationalityCode_idx" ON "application" USING btree ("nationality_code");--> statement-breakpoint
CREATE INDEX "application_status_idx" ON "application" USING btree ("application_status");--> statement-breakpoint
CREATE INDEX "application_paymentStatus_idx" ON "application" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "application_fulfillmentStatus_idx" ON "application" USING btree ("fulfillment_status");--> statement-breakpoint
CREATE INDEX "application_draftExpiresAt_idx" ON "application" USING btree ("draft_expires_at");--> statement-breakpoint
CREATE INDEX "margin_policy_scope_idx" ON "margin_policy" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "margin_policy_serviceId_idx" ON "margin_policy" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "price_quote_applicationId_idx" ON "price_quote" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "price_quote_lockedAt_idx" ON "price_quote" USING btree ("locked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_permission_key_uidx" ON "admin_permission" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_role_name_uidx" ON "admin_role" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_role_permission_uidx" ON "admin_role_permission" USING btree ("role_id","permission_key");--> statement-breakpoint
CREATE INDEX "admin_role_permission_roleId_idx" ON "admin_role_permission" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "admin_role_permission_permissionKey_idx" ON "admin_role_permission" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_user_role_uidx" ON "admin_user_role" USING btree ("admin_user_id","role_id");--> statement-breakpoint
CREATE INDEX "admin_user_role_adminUserId_idx" ON "admin_user_role" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_user_role_roleId_idx" ON "admin_user_role" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "addon_key_uidx" ON "addon" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "nationality_code_uidx" ON "nationality" USING btree ("code");--> statement-breakpoint
CREATE INDEX "visa_service_enabled_idx" ON "visa_service" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "visa_service_createdAt_idx" ON "visa_service" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "visa_service_addon_uidx" ON "visa_service_addon" USING btree ("service_id","addon_id");--> statement-breakpoint
CREATE INDEX "visa_service_addon_serviceId_idx" ON "visa_service_addon" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "visa_service_addon_addonId_idx" ON "visa_service_addon" USING btree ("addon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visa_service_eligibility_uidx" ON "visa_service_eligibility" USING btree ("service_id","nationality_code");--> statement-breakpoint
CREATE INDEX "visa_service_eligibility_serviceId_idx" ON "visa_service_eligibility" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "visa_service_eligibility_nationalityCode_idx" ON "visa_service_eligibility" USING btree ("nationality_code");--> statement-breakpoint
CREATE INDEX "payment_applicationId_idx" ON "payment" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "payment_provider_tx_idx" ON "payment" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_event_paymentId_idx" ON "payment_event" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_event_providerEvent_idx" ON "payment_event" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_event_payloadHash_idx" ON "payment_event" USING btree ("payload_hash");
--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- RLS scaffold (Phase 0)
--
-- Pattern:
-- - App sets request-scoped variables (within the same transaction):
--     select set_config('app.actor_type', 'admin|client|system', true);
--     select set_config('app.actor_id', '<id>', true);
--     select set_config('app.actor_permissions', 'perm.a,perm.b', true);
-- - RLS policies read them with current_setting(..., true)
-- ---------------------------------------------------------------------------

-- Helper functions (stable, simple primitives)
CREATE OR REPLACE FUNCTION app_actor_type() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.actor_type', true)
$$;

CREATE OR REPLACE FUNCTION app_actor_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.actor_id', true)
$$;

CREATE OR REPLACE FUNCTION app_has_permission(p text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  -- Safe delimiter match to avoid substring false-positives.
  -- Store permissions as comma-delimited without whitespace, and match ",p,".
  SELECT COALESCE(
    position(
      ',' || p || ','
      in
      ',' || COALESCE(current_setting('app.actor_permissions', true), '') || ','
    ) > 0,
    false
  )
$$;

-- Seed minimal RBAC permissions + a default super_admin role.
-- Assigning roles to admin users is an app-level action (admin_user_role insert).
INSERT INTO "admin_permission" ("key", "description") VALUES
  ('audit.read', 'View audit logs'),
  ('payments.read', 'View payments and payment events'),
  ('payments.refund', 'Initiate refunds'),
  ('affiliate.read', 'View affiliate connectors and automation config'),
  ('affiliate.write', 'Modify affiliate connectors and automation config'),
  ('jobs.read', 'View background job status and history'),
  ('jobs.run', 'Run background jobs and automation'),
  ('applications.read', 'View applications'),
  ('applications.write', 'Update application statuses and ops actions'),
  ('pricing.read', 'View pricing configuration'),
  ('pricing.write', 'Modify pricing configuration')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "admin_role" ("id", "name", "description") VALUES
  ('00000000-0000-0000-0000-000000000001', 'super_admin', 'Full access (seeded)')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "admin_role_permission" ("role_id", "permission_key") VALUES
  ('00000000-0000-0000-0000-000000000001', 'audit.read'),
  ('00000000-0000-0000-0000-000000000001', 'payments.read'),
  ('00000000-0000-0000-0000-000000000001', 'payments.refund'),
  ('00000000-0000-0000-0000-000000000001', 'affiliate.read'),
  ('00000000-0000-0000-0000-000000000001', 'affiliate.write'),
  ('00000000-0000-0000-0000-000000000001', 'jobs.read'),
  ('00000000-0000-0000-0000-000000000001', 'jobs.run'),
  ('00000000-0000-0000-0000-000000000001', 'applications.read'),
  ('00000000-0000-0000-0000-000000000001', 'applications.write'),
  ('00000000-0000-0000-0000-000000000001', 'pricing.read'),
  ('00000000-0000-0000-0000-000000000001', 'pricing.write')
ON CONFLICT ("role_id","permission_key") DO NOTHING;

-- Enable RLS on sensitive tables (expand over time)
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "affiliate_connector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_quote" ENABLE ROW LEVEL SECURITY;

-- Admin policies (explicit per operation)
-- audit_log: read-only for now
CREATE POLICY audit_log_admin_select ON "audit_log"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('audit.read'));

-- payment: read-only for now (write via webhooks/system actor)
CREATE POLICY payment_admin_select ON "payment"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('payments.read'));

CREATE POLICY payment_event_admin_select ON "payment_event"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('payments.read'));

-- affiliate_connector: read vs write split
CREATE POLICY affiliate_connector_admin_select ON "affiliate_connector"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('affiliate.read'));

CREATE POLICY affiliate_connector_admin_insert ON "affiliate_connector"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('affiliate.write'));
CREATE POLICY affiliate_connector_admin_update ON "affiliate_connector"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('affiliate.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('affiliate.write'));
CREATE POLICY affiliate_connector_admin_delete ON "affiliate_connector"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('affiliate.write'));

-- automation_job: read vs run split
CREATE POLICY automation_job_admin_select ON "automation_job"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('jobs.read'));

CREATE POLICY automation_job_admin_insert ON "automation_job"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('jobs.run'));
CREATE POLICY automation_job_admin_update ON "automation_job"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('jobs.run'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('jobs.run'));
CREATE POLICY automation_job_admin_delete ON "automation_job"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('jobs.run'));

-- application: read vs write split
CREATE POLICY application_admin_select ON "application"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));

CREATE POLICY application_admin_insert ON "application"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));
CREATE POLICY application_admin_update ON "application"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));
CREATE POLICY application_admin_delete ON "application"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'));

-- price_quote: read vs write split
CREATE POLICY price_quote_admin_select ON "price_quote"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.read'));

CREATE POLICY price_quote_admin_insert ON "price_quote"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));
CREATE POLICY price_quote_admin_update ON "price_quote"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));
CREATE POLICY price_quote_admin_delete ON "price_quote"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));

-- Client access (scaffold): can read own application + quote (ownership by user_id)
CREATE POLICY application_client_select_own ON "application"
  FOR SELECT
  USING (app_actor_type() = 'client' AND "user_id" IS NOT NULL AND "user_id" = app_actor_id());

CREATE POLICY price_quote_client_select_own ON "price_quote"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a."id" = "price_quote"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );

-- System actor (background jobs/webhooks) scaffold
CREATE POLICY automation_job_system_all ON "automation_job"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');

CREATE POLICY affiliate_connector_system_select ON "affiliate_connector"
  FOR SELECT
  USING (app_actor_type() = 'system');

CREATE POLICY application_system_all ON "application"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');

CREATE POLICY price_quote_system_all ON "price_quote"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');

CREATE POLICY payment_system_all ON "payment"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');

CREATE POLICY payment_event_system_all ON "payment_event"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');
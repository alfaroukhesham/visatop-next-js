-- Migration 0020: catalog_customer_price + pending, RLS, legacy affiliate pricing removal
-- Task 0 decision: 0b — keep affiliate_site + affiliate_connector + automation_job;
--   drop affiliate_reference_price, margin_policy only.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. New tables
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "catalog_customer_price" (
  "id"               text PRIMARY KEY DEFAULT gen_random_uuid(),
  "nationality_code" text NOT NULL REFERENCES "nationality"("code") ON DELETE CASCADE,
  "service_id"       text NOT NULL REFERENCES "visa_service"("id") ON DELETE CASCADE,
  "currency"         text NOT NULL,                              -- 'USD' | 'AED'
  "amount_minor"     bigint NOT NULL,                            -- minor units
  "source"           text NOT NULL DEFAULT 'admin_import',       -- audit
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_customer_price_nat_svc_cur_uidx"
    UNIQUE ("nationality_code", "service_id", "currency")
);--> statement-breakpoint

CREATE INDEX "catalog_customer_price_nationalityCode_idx"
  ON "catalog_customer_price" ("nationality_code");--> statement-breakpoint

CREATE INDEX "catalog_customer_price_serviceId_idx"
  ON "catalog_customer_price" ("service_id");--> statement-breakpoint

CREATE TABLE "catalog_customer_price_pending" (
  "id"               text PRIMARY KEY DEFAULT gen_random_uuid(),
  "nationality_code" text NOT NULL REFERENCES "nationality"("code") ON DELETE CASCADE,
  "service_id"       text NOT NULL REFERENCES "visa_service"("id") ON DELETE CASCADE,
  "amount_minor"     bigint NOT NULL,
  "batch_id"         text NOT NULL,
  "row_ref"          text,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "catalog_customer_price_pending_batchId_idx"
  ON "catalog_customer_price_pending" ("batch_id");--> statement-breakpoint

CREATE INDEX "catalog_customer_price_pending_nat_svc_idx"
  ON "catalog_customer_price_pending" ("nationality_code", "service_id");--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. RLS on new tables (mirrors catalog table patterns from 0003_catalog_addon_rls.sql)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "catalog_customer_price" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "catalog_customer_price_pending" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- catalog_customer_price: admin CRUD
CREATE POLICY catalog_customer_price_admin_select ON "catalog_customer_price"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY catalog_customer_price_admin_insert ON "catalog_customer_price"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_customer_price_admin_update ON "catalog_customer_price"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_customer_price_admin_delete ON "catalog_customer_price"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

-- system can SELECT for catalog/checkout queries (same spirit as eligibility_system_select)
CREATE POLICY catalog_customer_price_system_select ON "catalog_customer_price"
  FOR SELECT
  USING (
    app_actor_type() = 'system'
    AND EXISTS (
      SELECT 1 FROM "visa_service" v
      WHERE v."id" = "catalog_customer_price"."service_id" AND v."enabled" = true
    )
    AND EXISTS (
      SELECT 1 FROM "nationality" n
      WHERE n."code" = "catalog_customer_price"."nationality_code" AND n."enabled" = true
    )
  );--> statement-breakpoint

-- catalog_customer_price_pending: admin only (never public)
CREATE POLICY catalog_customer_price_pending_admin_select ON "catalog_customer_price_pending"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY catalog_customer_price_pending_admin_insert ON "catalog_customer_price_pending"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_customer_price_pending_admin_update ON "catalog_customer_price_pending"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_customer_price_pending_admin_delete ON "catalog_customer_price_pending"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Drop legacy pricing tables (Task 0b: keep affiliate_site + affiliate_connector)
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop RLS policies first (Postgres requires explicit policy drop before table drop)
DROP POLICY IF EXISTS affiliate_reference_price_admin_select ON "affiliate_reference_price";--> statement-breakpoint
DROP POLICY IF EXISTS affiliate_reference_price_admin_insert ON "affiliate_reference_price";--> statement-breakpoint
DROP POLICY IF EXISTS affiliate_reference_price_admin_update ON "affiliate_reference_price";--> statement-breakpoint
DROP POLICY IF EXISTS affiliate_reference_price_admin_delete ON "affiliate_reference_price";--> statement-breakpoint
DROP POLICY IF EXISTS affiliate_reference_price_system_select ON "affiliate_reference_price";--> statement-breakpoint

DROP POLICY IF EXISTS margin_policy_admin_select ON "margin_policy";--> statement-breakpoint
DROP POLICY IF EXISTS margin_policy_admin_insert ON "margin_policy";--> statement-breakpoint
DROP POLICY IF EXISTS margin_policy_admin_update ON "margin_policy";--> statement-breakpoint
DROP POLICY IF EXISTS margin_policy_admin_delete ON "margin_policy";--> statement-breakpoint
DROP POLICY IF EXISTS margin_policy_system_select ON "margin_policy";--> statement-breakpoint

-- Drop tables
DROP TABLE IF EXISTS "affiliate_reference_price";--> statement-breakpoint
DROP TABLE IF EXISTS "margin_policy";--> statement-breakpoint

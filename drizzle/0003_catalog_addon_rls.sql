ALTER TABLE "addon" ADD COLUMN "amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "addon" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
-- RBAC: catalog + audit write (audit_log inserts)
INSERT INTO "admin_permission" ("key", "description") VALUES
  ('catalog.read', 'View visa catalog (nationalities, services, eligibility, add-ons)'),
  ('catalog.write', 'Modify visa catalog'),
  ('audit.write', 'Write audit log entries')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "admin_role_permission" ("role_id", "permission_key") VALUES
  ('00000000-0000-0000-0000-000000000001', 'catalog.read'),
  ('00000000-0000-0000-0000-000000000001', 'catalog.write'),
  ('00000000-0000-0000-0000-000000000001', 'audit.write')
ON CONFLICT ("role_id","permission_key") DO NOTHING;--> statement-breakpoint
-- RLS: catalog tables (admin + system read for public catalog)
ALTER TABLE "nationality" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "visa_service" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "visa_service_eligibility" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addon" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "visa_service_addon" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "margin_policy" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "affiliate_site" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "affiliate_reference_price" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY nationality_admin_select ON "nationality"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint
CREATE POLICY nationality_admin_insert ON "nationality"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY nationality_admin_update ON "nationality"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY nationality_admin_delete ON "nationality"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY nationality_system_select ON "nationality"
  FOR SELECT
  USING (app_actor_type() = 'system' AND "enabled" = true);--> statement-breakpoint
CREATE POLICY visa_service_admin_select ON "visa_service"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint
CREATE POLICY visa_service_admin_insert ON "visa_service"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_admin_update ON "visa_service"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_admin_delete ON "visa_service"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_system_select ON "visa_service"
  FOR SELECT
  USING (app_actor_type() = 'system' AND "enabled" = true);--> statement-breakpoint
CREATE POLICY visa_service_eligibility_admin_select ON "visa_service_eligibility"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint
CREATE POLICY visa_service_eligibility_admin_insert ON "visa_service_eligibility"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_eligibility_admin_update ON "visa_service_eligibility"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_eligibility_admin_delete ON "visa_service_eligibility"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_eligibility_system_select ON "visa_service_eligibility"
  FOR SELECT
  USING (
    app_actor_type() = 'system'
    AND EXISTS (
      SELECT 1 FROM "visa_service" v
      WHERE v."id" = "visa_service_eligibility"."service_id" AND v."enabled" = true
    )
    AND EXISTS (
      SELECT 1 FROM "nationality" n
      WHERE n."code" = "visa_service_eligibility"."nationality_code" AND n."enabled" = true
    )
  );--> statement-breakpoint
CREATE POLICY addon_admin_select ON "addon"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint
CREATE POLICY addon_admin_insert ON "addon"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY addon_admin_update ON "addon"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY addon_admin_delete ON "addon"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY addon_system_select ON "addon"
  FOR SELECT
  USING (app_actor_type() = 'system' AND "enabled" = true);--> statement-breakpoint
CREATE POLICY visa_service_addon_admin_select ON "visa_service_addon"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint
CREATE POLICY visa_service_addon_admin_insert ON "visa_service_addon"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_addon_admin_update ON "visa_service_addon"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_addon_admin_delete ON "visa_service_addon"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint
CREATE POLICY visa_service_addon_system_select ON "visa_service_addon"
  FOR SELECT
  USING (
    app_actor_type() = 'system'
    AND EXISTS (
      SELECT 1 FROM "visa_service" v
      WHERE v."id" = "visa_service_addon"."service_id" AND v."enabled" = true
    )
    AND EXISTS (
      SELECT 1 FROM "addon" a
      WHERE a."id" = "visa_service_addon"."addon_id" AND a."enabled" = true
    )
  );--> statement-breakpoint
CREATE POLICY margin_policy_admin_select ON "margin_policy"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.read'));--> statement-breakpoint
CREATE POLICY margin_policy_admin_insert ON "margin_policy"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY margin_policy_admin_update ON "margin_policy"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY margin_policy_admin_delete ON "margin_policy"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY margin_policy_system_select ON "margin_policy"
  FOR SELECT
  USING (app_actor_type() = 'system' AND "enabled" = true);--> statement-breakpoint
CREATE POLICY affiliate_site_admin_select ON "affiliate_site"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.read'));--> statement-breakpoint
CREATE POLICY affiliate_site_admin_insert ON "affiliate_site"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY affiliate_site_admin_update ON "affiliate_site"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY affiliate_site_admin_delete ON "affiliate_site"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY affiliate_site_system_select ON "affiliate_site"
  FOR SELECT
  USING (app_actor_type() = 'system' AND "enabled" = true);--> statement-breakpoint
CREATE POLICY affiliate_reference_price_admin_select ON "affiliate_reference_price"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.read'));--> statement-breakpoint
CREATE POLICY affiliate_reference_price_admin_insert ON "affiliate_reference_price"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY affiliate_reference_price_admin_update ON "affiliate_reference_price"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY affiliate_reference_price_admin_delete ON "affiliate_reference_price"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('pricing.write'));--> statement-breakpoint
CREATE POLICY affiliate_reference_price_system_select ON "affiliate_reference_price"
  FOR SELECT
  USING (app_actor_type() = 'system');--> statement-breakpoint
CREATE POLICY audit_log_admin_insert ON "audit_log"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('audit.write'));
-- Local currencies: GLOBAL (everyone) vs LOCAL (linked nationalities).
-- Expand-contract: new tables only; existing USD/AED code keeps working.

CREATE TABLE "catalog_currency" (
  "code" text PRIMARY KEY,
  "kind" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "catalog_currency_kind_check" CHECK ("kind" IN ('global', 'local'))
);--> statement-breakpoint

CREATE UNIQUE INDEX "catalog_currency_code_uidx" ON "catalog_currency" ("code");--> statement-breakpoint

CREATE TABLE "catalog_currency_nationality" (
  "currency_code" text NOT NULL REFERENCES "catalog_currency"("code") ON DELETE CASCADE,
  "nationality_code" text NOT NULL REFERENCES "nationality"("code") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "catalog_currency_nationality_pk" PRIMARY KEY ("currency_code", "nationality_code")
);--> statement-breakpoint

CREATE INDEX "catalog_currency_nationality_nat_idx"
  ON "catalog_currency_nationality" ("nationality_code");--> statement-breakpoint

ALTER TABLE "catalog_currency" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "catalog_currency_nationality" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY catalog_currency_admin_select ON "catalog_currency"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY catalog_currency_admin_insert ON "catalog_currency"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_currency_admin_update ON "catalog_currency"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_currency_admin_delete ON "catalog_currency"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_currency_system_select ON "catalog_currency"
  FOR SELECT
  USING (app_actor_type() = 'system' AND "enabled" = true);--> statement-breakpoint

CREATE POLICY catalog_currency_nationality_admin_select ON "catalog_currency_nationality"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY catalog_currency_nationality_admin_insert ON "catalog_currency_nationality"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_currency_nationality_admin_update ON "catalog_currency_nationality"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_currency_nationality_admin_delete ON "catalog_currency_nationality"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_currency_nationality_system_select ON "catalog_currency_nationality"
  FOR SELECT
  USING (
    app_actor_type() = 'system'
    AND EXISTS (
      SELECT 1 FROM "catalog_currency" c
      WHERE c."code" = "catalog_currency_nationality"."currency_code"
        AND c."enabled" = true
        AND c."kind" = 'local'
    )
    AND EXISTS (
      SELECT 1 FROM "nationality" n
      WHERE n."code" = "catalog_currency_nationality"."nationality_code"
        AND n."enabled" = true
    )
  );--> statement-breakpoint

INSERT INTO "catalog_currency" ("code", "kind", "enabled")
VALUES
  ('USD', 'global', true),
  ('AED', 'global', true),
  ('NGN', 'local', true)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

INSERT INTO "catalog_currency_nationality" ("currency_code", "nationality_code")
SELECT 'NGN', 'NG'
WHERE EXISTS (SELECT 1 FROM "nationality" WHERE "code" = 'NG')
ON CONFLICT DO NOTHING;

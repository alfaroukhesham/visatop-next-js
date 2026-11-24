-- Checkout extras (travel insurance + fast track). Expand-only.
-- Applies to every service. No per-service exclusion table.
-- Seeded disabled. Checkout still ignores these rows until a later release.

CREATE TABLE "checkout_extra" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "charge_basis" text DEFAULT 'per_traveller' NOT NULL,
  "base_currency" text NOT NULL,
  "base_amount_minor" bigint NOT NULL,
  "label_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "promise_i18n" jsonb,
  "terms_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_extra_key_uidx" UNIQUE ("key"),
  CONSTRAINT "checkout_extra_key_check" CHECK ("key" IN ('travel_insurance', 'fast_track')),
  CONSTRAINT "checkout_extra_charge_basis_check" CHECK ("charge_basis" IN ('per_traveller', 'per_order')),
  CONSTRAINT "checkout_extra_base_currency_check" CHECK ("base_currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "checkout_extra_base_amount_check" CHECK ("base_amount_minor" > 0)
);--> statement-breakpoint

CREATE TABLE "checkout_extra_price" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "extra_id" text NOT NULL,
  "currency" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_extra_price_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "checkout_extra"("id") ON DELETE CASCADE,
  CONSTRAINT "checkout_extra_price_extra_currency_uidx" UNIQUE ("extra_id", "currency"),
  CONSTRAINT "checkout_extra_price_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "checkout_extra_price_amount_check" CHECK ("amount_minor" > 0)
);--> statement-breakpoint

CREATE INDEX "checkout_extra_price_extraId_idx" ON "checkout_extra_price" ("extra_id");--> statement-breakpoint

ALTER TABLE "application_party" ADD COLUMN "travel_date" date;--> statement-breakpoint
ALTER TABLE "application_party" ADD COLUMN "processing_speed" text;--> statement-breakpoint
ALTER TABLE "application_party" ADD COLUMN "processing_speed_source" text;--> statement-breakpoint
ALTER TABLE "application_party" ADD CONSTRAINT "application_party_processing_speed_check" CHECK (
  "processing_speed" IS NULL OR "processing_speed" IN ('standard', 'fast_track')
);--> statement-breakpoint
ALTER TABLE "application_party" ADD CONSTRAINT "application_party_processing_speed_source_check" CHECK (
  "processing_speed_source" IS NULL OR "processing_speed_source" IN ('system', 'customer')
);--> statement-breakpoint
ALTER TABLE "application_party" ADD CONSTRAINT "application_party_processing_speed_source_pair_check" CHECK (
  ("processing_speed" IS NULL AND "processing_speed_source" IS NULL)
  OR ("processing_speed" IS NOT NULL AND "processing_speed_source" IS NOT NULL)
);--> statement-breakpoint

CREATE TABLE "application_extra_selection" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" text NOT NULL,
  "extra_id" text NOT NULL,
  "selected" boolean NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "application_extra_selection_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE,
  CONSTRAINT "application_extra_selection_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "checkout_extra"("id") ON DELETE CASCADE,
  CONSTRAINT "application_extra_selection_app_extra_uidx" UNIQUE ("application_id", "extra_id")
);--> statement-breakpoint

CREATE INDEX "application_extra_selection_applicationId_idx" ON "application_extra_selection" ("application_id");--> statement-breakpoint

ALTER TABLE "checkout_extra" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkout_extra_price" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_extra_selection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY checkout_extra_admin_select ON "checkout_extra"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY checkout_extra_admin_insert ON "checkout_extra"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY checkout_extra_admin_update ON "checkout_extra"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY checkout_extra_admin_delete ON "checkout_extra"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY checkout_extra_system_select ON "checkout_extra"
  FOR SELECT
  USING (app_actor_type() = 'system');--> statement-breakpoint

CREATE POLICY checkout_extra_price_admin_select ON "checkout_extra_price"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY checkout_extra_price_admin_insert ON "checkout_extra_price"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY checkout_extra_price_admin_update ON "checkout_extra_price"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY checkout_extra_price_admin_delete ON "checkout_extra_price"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY checkout_extra_price_system_select ON "checkout_extra_price"
  FOR SELECT
  USING (app_actor_type() = 'system');--> statement-breakpoint

CREATE POLICY application_extra_selection_system_all ON "application_extra_selection"
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint

CREATE POLICY application_extra_selection_admin_select ON "application_extra_selection"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));--> statement-breakpoint

CREATE POLICY application_extra_selection_admin_insert ON "application_extra_selection"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint

CREATE POLICY application_extra_selection_admin_update ON "application_extra_selection"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint

CREATE POLICY application_extra_selection_admin_delete ON "application_extra_selection"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint

CREATE POLICY application_extra_selection_client_select ON "application_extra_selection"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a."id" = "application_extra_selection"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );--> statement-breakpoint

CREATE POLICY application_extra_selection_client_insert ON "application_extra_selection"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a."id" = "application_extra_selection"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."is_guest" = false
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  );--> statement-breakpoint

CREATE POLICY application_extra_selection_client_update ON "application_extra_selection"
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a."id" = "application_extra_selection"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a."id" = "application_extra_selection"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  );--> statement-breakpoint

INSERT INTO "checkout_extra" (
  "id",
  "key",
  "enabled",
  "charge_basis",
  "base_currency",
  "base_amount_minor",
  "label_i18n",
  "description_i18n",
  "promise_i18n",
  "terms_url",
  "sort_order"
) VALUES
  (
    'travel_insurance',
    'travel_insurance',
    false,
    'per_traveller',
    'AED',
    7900,
    '{"en":"Travel insurance"}'::jsonb,
    '{}'::jsonb,
    NULL,
    NULL,
    0
  ),
  (
    'fast_track',
    'fast_track',
    false,
    'per_traveller',
    'USD',
    10000,
    '{"en":"Fast Track"}'::jsonb,
    '{}'::jsonb,
    '{"en":"within 24 hours"}'::jsonb,
    NULL,
    1
  )
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

INSERT INTO "checkout_extra_price" ("id", "extra_id", "currency", "amount_minor")
VALUES
  ('travel_insurance_aed', 'travel_insurance', 'AED', 7900),
  ('fast_track_usd', 'fast_track', 'USD', 10000)
ON CONFLICT ("extra_id", "currency") DO NOTHING;--> statement-breakpoint

INSERT INTO "platform_setting" ("key", "value")
VALUES
  ('fast_track_threshold_days', '4'),
  ('travel_date_required', 'true'),
  ('travel_date_max_days_ahead', '180')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

CREATE POLICY "platform_setting_select_checkout_extras" ON "platform_setting"
  FOR SELECT
  USING (
    "key" IN (
      'fast_track_threshold_days',
      'travel_date_required',
      'travel_date_max_days_ahead'
    )
  );--> statement-breakpoint

CREATE POLICY "platform_setting_admin_insert_checkout_extras" ON "platform_setting"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'admin'
    AND app_has_permission('settings.write')
    AND "key" IN (
      'fast_track_threshold_days',
      'travel_date_required',
      'travel_date_max_days_ahead'
    )
  );--> statement-breakpoint

CREATE POLICY "platform_setting_admin_update_checkout_extras" ON "platform_setting"
  FOR UPDATE
  USING (
    app_actor_type() = 'admin'
    AND app_has_permission('settings.write')
    AND "key" IN (
      'fast_track_threshold_days',
      'travel_date_required',
      'travel_date_max_days_ahead'
    )
  )
  WITH CHECK (
    "key" IN (
      'fast_track_threshold_days',
      'travel_date_required',
      'travel_date_max_days_ahead'
    )
  );

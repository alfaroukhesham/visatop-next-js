-- The travel-date step is skippable. 0041 seeded travel_date_required as true.
-- Flip that stored true to false. Checkout still accepts a missing date if an admin turns it back on.
-- travel_date_step_enabled has no seed: a missing row means the step is shown (code default true).
UPDATE "platform_setting"
SET "value" = 'false', "updated_at" = now()
WHERE "key" = 'travel_date_required' AND "value" = 'true';--> statement-breakpoint

DROP POLICY IF EXISTS "platform_setting_select_checkout_extras" ON "platform_setting";--> statement-breakpoint
DROP POLICY IF EXISTS "platform_setting_admin_insert_checkout_extras" ON "platform_setting";--> statement-breakpoint
DROP POLICY IF EXISTS "platform_setting_admin_update_checkout_extras" ON "platform_setting";--> statement-breakpoint

CREATE POLICY "platform_setting_select_checkout_extras" ON "platform_setting"
  FOR SELECT
  USING (
    "key" IN (
      'fast_track_threshold_days',
      'travel_date_required',
      'travel_date_step_enabled',
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
      'travel_date_step_enabled',
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
      'travel_date_step_enabled',
      'travel_date_max_days_ahead'
    )
  )
  WITH CHECK (
    "key" IN (
      'fast_track_threshold_days',
      'travel_date_required',
      'travel_date_step_enabled',
      'travel_date_max_days_ahead'
    )
  );

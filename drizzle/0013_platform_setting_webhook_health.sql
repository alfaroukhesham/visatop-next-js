-- Persist webhook delivery health for admin visibility.
-- These keys are read-only via admin UI; values are updated by verified webhook receivers.

INSERT INTO "platform_setting" ("key", "value")
VALUES
  ('last_webhook_received_at_ziina', ''),
  ('last_webhook_received_at_paddle', '')
ON CONFLICT ("key") DO NOTHING;

--> statement-breakpoint
-- Allow admins with settings.read to read these keys.
CREATE POLICY "platform_setting_select_webhook_health" ON "platform_setting"
  FOR SELECT
  USING (
    app_actor_type() = 'admin'
    AND app_has_permission('settings.read')
    AND "key" IN ('last_webhook_received_at_ziina', 'last_webhook_received_at_paddle')
  );

--> statement-breakpoint
-- Allow system actor (webhook handlers) to update these keys.
CREATE POLICY "platform_setting_system_update_webhook_health" ON "platform_setting"
  FOR UPDATE
  USING (
    app_actor_type() = 'system'
    AND "key" IN ('last_webhook_received_at_ziina', 'last_webhook_received_at_paddle')
  )
  WITH CHECK (
    "key" IN ('last_webhook_received_at_ziina', 'last_webhook_received_at_paddle')
  );


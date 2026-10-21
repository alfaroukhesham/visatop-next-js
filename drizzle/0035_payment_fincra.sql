-- Fincra / NGN checkout: nullable payment columns + webhook health key.
-- Expand-contract: old app ignores new columns; new app writes them.

ALTER TABLE "payment" ADD COLUMN "amount_received_minor" bigint;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fee_minor" bigint;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "variance_type" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fx_rate_used" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fx_base_currency" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fx_base_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fx_source" text;--> statement-breakpoint

CREATE INDEX "payment_provider_operation_idx" ON "payment" ("provider_operation_id");--> statement-breakpoint

INSERT INTO "platform_setting" ("key", "value")
VALUES ('last_webhook_received_at_fincra', '')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

DROP POLICY IF EXISTS "platform_setting_select_webhook_health" ON "platform_setting";--> statement-breakpoint
DROP POLICY IF EXISTS "platform_setting_system_update_webhook_health" ON "platform_setting";--> statement-breakpoint

CREATE POLICY "platform_setting_select_webhook_health" ON "platform_setting"
  FOR SELECT
  USING (
    app_actor_type() = 'admin'
    AND app_has_permission('settings.read')
    AND "key" IN (
      'last_webhook_received_at_ziina',
      'last_webhook_received_at_paddle',
      'last_webhook_received_at_fincra'
    )
  );--> statement-breakpoint

CREATE POLICY "platform_setting_system_update_webhook_health" ON "platform_setting"
  FOR UPDATE
  USING (
    app_actor_type() = 'system'
    AND "key" IN (
      'last_webhook_received_at_ziina',
      'last_webhook_received_at_paddle',
      'last_webhook_received_at_fincra'
    )
  )
  WITH CHECK (
    "key" IN (
      'last_webhook_received_at_ziina',
      'last_webhook_received_at_paddle',
      'last_webhook_received_at_fincra'
    )
  );

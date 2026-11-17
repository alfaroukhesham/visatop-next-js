-- Fincra attempt history + admin attention details for extra collections.
-- Expand-only: new table, nullable columns, no drops/renames.

ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "settled_merchant_reference" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "admin_attention_reason" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "admin_attention_details" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_fincra_attempt" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" text NOT NULL,
	"merchant_reference" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "payment_fincra_attempt" ADD CONSTRAINT "payment_fincra_attempt_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_fincra_attempt_merchant_reference_uidx" ON "payment_fincra_attempt" ("merchant_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_fincra_attempt_paymentId_idx" ON "payment_fincra_attempt" ("payment_id");--> statement-breakpoint
ALTER TABLE "payment_fincra_attempt" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payment_fincra_attempt_system_all" ON "payment_fincra_attempt"
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint
CREATE POLICY "payment_fincra_attempt_admin_select" ON "payment_fincra_attempt"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('payments.read'));--> statement-breakpoint

-- Backfill known current Fincra merchant references so reconcile can verify them.
INSERT INTO "payment_fincra_attempt" ("id", "payment_id", "merchant_reference", "attempt_number", "created_at")
SELECT gen_random_uuid()::text,
       "id",
       "provider_operation_id",
       CASE
         WHEN "provider_operation_id" ~ '-a[0-9]+$' THEN CAST(substring("provider_operation_id" from '-a([0-9]+)$') AS integer)
         ELSE 1
       END,
       "created_at"
FROM "payment"
WHERE "provider" = 'fincra'
  AND "provider_operation_id" IS NOT NULL
  AND btrim("provider_operation_id") <> ''
ON CONFLICT ("merchant_reference") DO NOTHING;--> statement-breakpoint

UPDATE "payment"
SET "settled_merchant_reference" = "provider_operation_id"
WHERE "provider" = 'fincra'
  AND "status" = 'paid'
  AND "settled_merchant_reference" IS NULL
  AND "provider_operation_id" IS NOT NULL
  AND btrim("provider_operation_id") <> '';

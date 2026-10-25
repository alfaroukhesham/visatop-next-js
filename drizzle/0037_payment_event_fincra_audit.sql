-- Persist every verified provider webhook (incl. unmatched refs and non-success events).
-- Expand-only: existing rows keep payment_id and default matched/signature_valid = true.
ALTER TABLE "payment_event" ALTER COLUMN "payment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN IF NOT EXISTS "merchant_reference" text;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN IF NOT EXISTS "status" text;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN IF NOT EXISTS "signature_valid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN IF NOT EXISTS "matched" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_event_merchant_reference_idx" ON "payment_event" USING btree ("merchant_reference");

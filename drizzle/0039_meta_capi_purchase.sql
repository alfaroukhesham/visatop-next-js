-- Meta Conversions API: capture Pay-click attribution + once-only Purchase marker.
-- Expand-only: nullable columns, no drops/renames. Old app ignores the new fields.

ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_fbp" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_fbc" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_client_ip" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_client_user_agent" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "meta_event_source_url" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "capi_purchase_sent_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_capiPurchaseSentAt_idx" ON "application" ("capi_purchase_sent_at");

-- Migration 0025: application_party (multi-traveller party root)
-- One row per traveller/party; application rows hang off it via party_id.

CREATE TABLE "application_party" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"guest_email" text,
	"nationality_code" text NOT NULL,
	"catalog_currency" text DEFAULT 'USD' NOT NULL,
	"resume_token_hash" text,
	"draft_expires_at" timestamp,
	"payment_status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "application_party" ADD CONSTRAINT "application_party_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "application_party" ADD CONSTRAINT "application_party_nationality_code_fkey" FOREIGN KEY ("nationality_code") REFERENCES "nationality"("code");--> statement-breakpoint

CREATE INDEX "application_party_resumeTokenHash_idx" ON "application_party" ("resume_token_hash");--> statement-breakpoint

CREATE INDEX "application_party_guestEmail_idx" ON "application_party" ("guest_email");--> statement-breakpoint

ALTER TABLE "application" ADD COLUMN "party_id" text;--> statement-breakpoint

ALTER TABLE "application" ADD COLUMN "traveler_role" text DEFAULT 'primary' NOT NULL;--> statement-breakpoint

ALTER TABLE "application" ADD COLUMN "traveler_kind" text DEFAULT 'adult' NOT NULL;--> statement-breakpoint

ALTER TABLE "application" ADD COLUMN "traveler_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "application" ADD CONSTRAINT "application_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "application_party"("id") ON DELETE CASCADE;--> statement-breakpoint

CREATE INDEX "application_partyId_idx" ON "application" ("party_id");--> statement-breakpoint

ALTER TABLE "application_party" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY application_party_system_all ON "application_party"
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint

CREATE POLICY application_party_admin_select ON "application_party"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));--> statement-breakpoint

CREATE POLICY application_party_admin_update ON "application_party"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint

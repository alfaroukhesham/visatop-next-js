ALTER TABLE "application" ADD COLUMN "previous_resume_token_hash" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "previous_resume_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "application_party" ADD COLUMN "previous_resume_token_hash" text;--> statement-breakpoint
ALTER TABLE "application_party" ADD COLUMN "previous_resume_token_expires_at" timestamp;--> statement-breakpoint

CREATE INDEX "application_previousResumeTokenHash_idx" ON "application" ("previous_resume_token_hash");--> statement-breakpoint
CREATE INDEX "application_party_previousResumeTokenHash_idx" ON "application_party" ("previous_resume_token_hash");--> statement-breakpoint

CREATE TABLE "document_upload_failure_notification" (
  "id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
  "application_id" text NOT NULL,
  "document_type" text NOT NULL,
  "failure_group" text NOT NULL,
  "error_code" text NOT NULL,
  "http_status" integer NOT NULL,
  "applicant_notified" boolean DEFAULT false NOT NULL,
  "locale" text DEFAULT 'en' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_sent_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  CONSTRAINT "document_upload_failure_notification_application_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);--> statement-breakpoint

CREATE UNIQUE INDEX "document_upload_failure_notification_open_uidx"
  ON "document_upload_failure_notification" ("application_id", "document_type", "failure_group")
  WHERE "resolved_at" is null;--> statement-breakpoint

CREATE INDEX "document_upload_failure_notification_application_id_idx"
  ON "document_upload_failure_notification" ("application_id");--> statement-breakpoint

CREATE INDEX "document_upload_failure_notification_document_type_idx"
  ON "document_upload_failure_notification" ("document_type");--> statement-breakpoint

ALTER TABLE "document_upload_failure_notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "document_upload_failure_notification_system_all" ON "document_upload_failure_notification"
  AS PERMISSIVE FOR ALL TO public
  USING (app_actor_type() = 'system'::text)
  WITH CHECK (app_actor_type() = 'system'::text);--> statement-breakpoint

CREATE POLICY "document_upload_failure_notification_admin_select" ON "document_upload_failure_notification"
  AS PERMISSIVE FOR SELECT TO public
  USING (app_actor_type() = 'admin'::text);

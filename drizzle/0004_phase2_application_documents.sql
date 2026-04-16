-- Phase 2: guest resume hash, application documents, client draft policies
CREATE TABLE "application_document" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"extraction_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "resume_token_hash" text;--> statement-breakpoint
ALTER TABLE "application_document" ADD CONSTRAINT "application_document_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_document_applicationId_idx" ON "application_document" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_resumeTokenHash_idx" ON "application" USING btree ("resume_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "application_resume_token_hash_uidx" ON "application" ("resume_token_hash") WHERE "resume_token_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "application_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "application_document_system_all" ON "application_document"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint
CREATE POLICY "application_document_admin_select" ON "application_document"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));--> statement-breakpoint
CREATE POLICY "application_document_admin_insert" ON "application_document"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_admin_update" ON "application_document"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_admin_delete" ON "application_document"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_client_select_own" ON "application_document"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a.id = "application_document"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );--> statement-breakpoint
CREATE POLICY "application_document_client_insert_own" ON "application_document"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a.id = "application_document"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  );--> statement-breakpoint
CREATE POLICY "application_document_client_update_own" ON "application_document"
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application" a
      WHERE a.id = "application_document"."application_id"
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
      WHERE a.id = "application_document"."application_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );--> statement-breakpoint
CREATE POLICY "application_client_insert_own" ON "application"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND "user_id" IS NOT NULL
    AND "user_id" = app_actor_id()
    AND "is_guest" = false
    AND "application_status" = 'draft'
    AND "payment_status" = 'unpaid'
    AND "fulfillment_status" = 'not_started'
  );--> statement-breakpoint
CREATE POLICY "application_client_update_own_draft" ON "application"
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND "user_id" IS NOT NULL
    AND "user_id" = app_actor_id()
    AND "application_status" = 'draft'
    AND "payment_status" = 'unpaid'
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND "user_id" IS NOT NULL
    AND "user_id" = app_actor_id()
    AND "application_status" = 'draft'
    AND "payment_status" = 'unpaid'
  );

CREATE TABLE "application_document_blob" (
	"document_id" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"temp_expires_at" timestamp,
	"retained_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "application_document_extraction" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"prompt_version" integer,
	"latency_ms" integer,
	"usage" jsonb,
	"result_json" jsonb,
	"validation_json" jsonb,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "application_document" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "application_document" ALTER COLUMN "mime_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "application_document" ALTER COLUMN "size_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "application_document" ALTER COLUMN "extraction_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "application_document" ADD COLUMN "document_type" text;--> statement-breakpoint
ALTER TABLE "application_document" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "application_document" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "application_document" ADD COLUMN "byte_length" bigint;--> statement-breakpoint
ALTER TABLE "application_document" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "application_document" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "place_of_birth" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "applicant_nationality" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_number" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_expiry_date" date;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "profession" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "applicant_profile_provenance_json" jsonb;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_lease_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_run_id" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_document_id" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "passport_extraction_sha256" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "checkout_state" text;--> statement-breakpoint
ALTER TABLE "application_document_blob" ADD CONSTRAINT "application_document_blob_document_id_application_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."application_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_document_extraction" ADD CONSTRAINT "application_document_extraction_document_id_application_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."application_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_document_extraction_documentId_idx" ON "application_document_extraction" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "application_document_extraction_attempt_idx" ON "application_document_extraction" USING btree ("document_id","attempt");--> statement-breakpoint
CREATE INDEX "application_document_documentType_idx" ON "application_document" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "application_document_status_idx" ON "application_document" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "application_document_app_type_sha_uidx" ON "application_document" USING btree ("application_id","document_type","sha256");--> statement-breakpoint
CREATE INDEX "application_passportExtractionStatus_idx" ON "application" USING btree ("passport_extraction_status");--> statement-breakpoint
CREATE INDEX "application_passportExtractionLeaseExpiresAt_idx" ON "application" USING btree ("passport_extraction_lease_expires_at");--> statement-breakpoint
CREATE INDEX "application_document_blob_tempExpiresAt_idx" ON "application_document_blob" USING btree ("temp_expires_at");--> statement-breakpoint
CREATE INDEX "application_document_blob_retainedAt_idx" ON "application_document_blob" USING btree ("retained_at");--> statement-breakpoint

-- RLS: blob table mirrors application_document policy split (join through parent document -> application).
ALTER TABLE "application_document_blob" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "application_document_blob_system_all" ON "application_document_blob"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint
CREATE POLICY "application_document_blob_admin_select" ON "application_document_blob"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));--> statement-breakpoint
CREATE POLICY "application_document_blob_admin_insert" ON "application_document_blob"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_blob_admin_update" ON "application_document_blob"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_blob_admin_delete" ON "application_document_blob"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_blob_client_select_own" ON "application_document_blob"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_blob"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );--> statement-breakpoint
CREATE POLICY "application_document_blob_client_insert_own" ON "application_document_blob"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_blob"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  );--> statement-breakpoint
CREATE POLICY "application_document_blob_client_update_own" ON "application_document_blob"
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_blob"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_blob"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );--> statement-breakpoint
CREATE POLICY "application_document_blob_client_delete_own" ON "application_document_blob"
  FOR DELETE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_blob"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  );--> statement-breakpoint

-- RLS: extraction rows use same split.
ALTER TABLE "application_document_extraction" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "application_document_extraction_system_all" ON "application_document_extraction"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint
CREATE POLICY "application_document_extraction_admin_select" ON "application_document_extraction"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));--> statement-breakpoint
CREATE POLICY "application_document_extraction_admin_insert" ON "application_document_extraction"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_extraction_admin_update" ON "application_document_extraction"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_extraction_admin_delete" ON "application_document_extraction"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'));--> statement-breakpoint
CREATE POLICY "application_document_extraction_client_select_own" ON "application_document_extraction"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_extraction"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
    )
  );--> statement-breakpoint
CREATE POLICY "application_document_extraction_client_insert_own" ON "application_document_extraction"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "application_document" d
      JOIN "application" a ON a.id = d.application_id
      WHERE d.id = "application_document_extraction"."document_id"
        AND a."user_id" IS NOT NULL
        AND a."user_id" = app_actor_id()
        AND a."application_status" = 'draft'
        AND a."payment_status" = 'unpaid'
    )
  );--> statement-breakpoint

-- Allow client to hard-delete own documents (needed for replace semantics).
CREATE POLICY "application_document_client_delete_own" ON "application_document"
  FOR DELETE
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
  );
-- User document vault (client-owned, RLS-protected)
CREATE TABLE "user_document" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_type" text NOT NULL,
	"supporting_category" text,
	"content_type" text,
	"byte_length" bigint,
	"original_filename" text,
	"sha256" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_document_blob" (
	"document_id" text PRIMARY KEY NOT NULL,
	"bytes" bytea NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_document_source" (
	"application_document_id" text PRIMARY KEY NOT NULL,
	"user_document_id" text NOT NULL,
	"copied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_document" ADD CONSTRAINT "user_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_document_blob" ADD CONSTRAINT "user_document_blob_document_id_user_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."user_document"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_document_source" ADD CONSTRAINT "application_document_source_application_document_id_application_document_id_fk" FOREIGN KEY ("application_document_id") REFERENCES "public"."application_document"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_document_source" ADD CONSTRAINT "application_document_source_user_document_id_user_document_id_fk" FOREIGN KEY ("user_document_id") REFERENCES "public"."user_document"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_document_userId_idx" ON "user_document" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "user_document_type_idx" ON "user_document" USING btree ("document_type");
--> statement-breakpoint
CREATE INDEX "user_document_createdAt_idx" ON "user_document" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_document_user_sha_type_uidx" ON "user_document" ("user_id","sha256","document_type");
--> statement-breakpoint
CREATE INDEX "application_document_source_userDocumentId_idx" ON "application_document_source" USING btree ("user_document_id");
--> statement-breakpoint
ALTER TABLE "user_document" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_document_blob" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "application_document_source" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- RLS: user_document
CREATE POLICY "user_document_system_all" ON "user_document"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');
--> statement-breakpoint
CREATE POLICY "user_document_client_select_own" ON "user_document"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND "user_id" = app_actor_id()
  );
--> statement-breakpoint
CREATE POLICY "user_document_client_insert_own" ON "user_document"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND "user_id" = app_actor_id()
  );
--> statement-breakpoint
CREATE POLICY "user_document_client_update_own" ON "user_document"
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND "user_id" = app_actor_id()
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND "user_id" = app_actor_id()
  );
--> statement-breakpoint
CREATE POLICY "user_document_client_delete_own" ON "user_document"
  FOR DELETE
  USING (
    app_actor_type() = 'client'
    AND "user_id" = app_actor_id()
  );
--> statement-breakpoint

-- RLS: user_document_blob (access only via owning user_document)
CREATE POLICY "user_document_blob_system_all" ON "user_document_blob"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');
--> statement-breakpoint
CREATE POLICY "user_document_blob_client_select_own" ON "user_document_blob"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_blob"."document_id"
        AND ud."user_id" = app_actor_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "user_document_blob_client_insert_own" ON "user_document_blob"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_blob"."document_id"
        AND ud."user_id" = app_actor_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "user_document_blob_client_update_own" ON "user_document_blob"
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_blob"."document_id"
        AND ud."user_id" = app_actor_id()
    )
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_blob"."document_id"
        AND ud."user_id" = app_actor_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "user_document_blob_client_delete_own" ON "user_document_blob"
  FOR DELETE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_blob"."document_id"
        AND ud."user_id" = app_actor_id()
    )
  );
--> statement-breakpoint

-- RLS: application_document_source (client can insert/select if app doc belongs to them)
CREATE POLICY "application_document_source_system_all" ON "application_document_source"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');
--> statement-breakpoint
CREATE POLICY "application_document_source_client_select_own" ON "application_document_source"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1
      FROM "application_document" ad
      JOIN "application" a ON a.id = ad."application_id"
      WHERE ad.id = "application_document_source"."application_document_id"
        AND a."user_id" = app_actor_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "application_document_source_client_insert_own" ON "application_document_source"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1
      FROM "application_document" ad
      JOIN "application" a ON a.id = ad."application_id"
      WHERE ad.id = "application_document_source"."application_document_id"
        AND a."user_id" = app_actor_id()
    )
  );


-- Vault provenance: track which application/doc a vault row came from
CREATE TABLE "user_document_source_application" (
  "user_document_id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL,
  "application_document_id" text NOT NULL,
  "ingested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_document_source_application"
  ADD CONSTRAINT "user_document_source_application_user_document_id_fk"
  FOREIGN KEY ("user_document_id") REFERENCES "public"."user_document"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_document_source_application"
  ADD CONSTRAINT "user_document_source_application_application_id_fk"
  FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_document_source_application"
  ADD CONSTRAINT "user_document_source_application_application_document_id_fk"
  FOREIGN KEY ("application_document_id") REFERENCES "public"."application_document"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_document_source_application_applicationId_idx" ON "user_document_source_application" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "user_document_source_application_applicationDocumentId_idx" ON "user_document_source_application" USING btree ("application_document_id");
--> statement-breakpoint
ALTER TABLE "user_document_source_application" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "user_document_source_application_system_all" ON "user_document_source_application"
  FOR ALL
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');
--> statement-breakpoint
CREATE POLICY "user_document_source_application_client_select_own" ON "user_document_source_application"
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_source_application"."user_document_id"
        AND ud."user_id" = app_actor_id()
    )
  );
--> statement-breakpoint
CREATE POLICY "user_document_source_application_client_insert_own" ON "user_document_source_application"
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM "user_document" ud
      WHERE ud.id = "user_document_source_application"."user_document_id"
        AND ud."user_id" = app_actor_id()
    )
  );


-- Migration 0023: catalog_document_type (admin-created extras)
-- Bank is seeded so existing catalog_document_requirement rows can FK to it.

CREATE TABLE "catalog_document_type" (
  "key"         text PRIMARY KEY,
  "label"       text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "accept_mime" text NOT NULL DEFAULT 'image/jpeg,image/png,application/pdf',
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_document_type_key_check"
    CHECK (
      "key" ~ '^[a-z][a-z0-9_]{1,62}$'
      AND "key" NOT IN (
        'passport_copy',
        'personal_photo',
        'supporting',
        'admin_step_attachment',
        'outcome_approval',
        'outcome_authority_rejection'
      )
    )
);--> statement-breakpoint

INSERT INTO "catalog_document_type" ("key", "label", "description")
VALUES (
  'bank_statement_6m',
  'Last 6 months bank account statement',
  'One PDF or image covering the last 6 months · JPEG / PNG / PDF · 8MB max'
)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

ALTER TABLE "catalog_document_requirement"
  ADD CONSTRAINT "catalog_document_requirement_document_type_fkey"
  FOREIGN KEY ("document_type") REFERENCES "catalog_document_type"("key");--> statement-breakpoint

ALTER TABLE "catalog_document_type" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY catalog_document_type_admin_select ON "catalog_document_type"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY catalog_document_type_admin_insert ON "catalog_document_type"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_document_type_admin_update ON "catalog_document_type"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_document_type_admin_delete ON "catalog_document_type"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_document_type_system_select ON "catalog_document_type"
  FOR SELECT
  USING (app_actor_type() = 'system');--> statement-breakpoint

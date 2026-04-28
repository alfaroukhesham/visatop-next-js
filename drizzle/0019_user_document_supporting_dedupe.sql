-- Adjust vault dedupe semantics:
-- - Non-supporting docs dedupe by (user_id, sha256, document_type)
-- - Supporting docs allow same bytes in multiple categories, dedupe by (user_id, sha256, document_type, supporting_category)

DROP INDEX IF EXISTS "user_document_user_sha_type_uidx";
--> statement-breakpoint

CREATE UNIQUE INDEX "user_document_user_sha_type_uidx"
  ON "user_document" ("user_id","sha256","document_type")
  WHERE "document_type" <> 'supporting';
--> statement-breakpoint

CREATE UNIQUE INDEX "user_document_user_sha_type_category_uidx"
  ON "user_document" ("user_id","sha256","document_type","supporting_category")
  WHERE "document_type" = 'supporting';


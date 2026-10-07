-- Soft-deleted document rows were included in
-- application_document_app_type_sha_uidx (application_id, document_type, sha256).
-- Re-uploading a file that had been replaced therefore hit unique_violation (HTTP 500).
--
-- Prod-safe: the previous unique index already forbade duplicate *active* rows.
-- This only drops deleted rows out of the uniqueness set. Existing active
-- (application_id, document_type, sha256) triples remain unique.
-- `IS DISTINCT FROM` keeps legacy NULL-status rows in the index.

DROP INDEX IF EXISTS "application_document_app_type_sha_uidx";--> statement-breakpoint

CREATE UNIQUE INDEX "application_document_app_type_sha_uidx"
  ON "application_document" ("application_id", "document_type", "sha256")
  WHERE "status" IS DISTINCT FROM 'deleted';

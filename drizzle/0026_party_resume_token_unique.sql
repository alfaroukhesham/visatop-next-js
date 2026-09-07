-- Migration 0026: guest resume token is unique per party, not per application row.
-- Multi-traveller drafts copy the same hash onto every member (Phase B).
-- 0004's unique index on application.resume_token_hash therefore rejects parties.

DROP INDEX IF EXISTS "application_resume_token_hash_uidx";--> statement-breakpoint

CREATE UNIQUE INDEX "application_party_resume_token_hash_uidx"
  ON "application_party" ("resume_token_hash")
  WHERE "resume_token_hash" IS NOT NULL;

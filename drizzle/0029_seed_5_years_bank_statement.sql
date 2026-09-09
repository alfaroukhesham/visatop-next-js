-- Migration 0029: require 6-month bank statement for every nationality on the "5 Years" visa.
-- Idempotent: existing Africa/Asia rows stay; missing pairs are inserted; role is forced to required.

INSERT INTO "catalog_document_requirement" ("nationality_code", "service_id", "document_type", "role")
SELECT n."code", s."id", 'bank_statement_6m', 'required'
FROM "nationality" n
CROSS JOIN "visa_service" s
WHERE lower(trim(s."name")) = '5 years'
ON CONFLICT ("nationality_code", "service_id", "document_type")
DO UPDATE SET "role" = EXCLUDED."role";

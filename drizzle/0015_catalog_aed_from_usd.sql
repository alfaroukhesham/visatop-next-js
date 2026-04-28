-- Demo / catalog: add AED reference prices and margin policies derived from existing USD rows (×3.68).
-- Idempotent: skips site+service (refs) or scope+service+mode+value (margins) when an AED row already exists.

INSERT INTO "affiliate_reference_price" ("id", "site_id", "service_id", "amount", "currency", "observed_at", "source_url")
SELECT
  gen_random_uuid()::text,
  r."site_id",
  r."service_id",
  (ROUND((r."amount"::numeric) * 3.68))::bigint,
  'AED',
  r."observed_at",
  CASE
    WHEN r."source_url" IS NULL OR r."source_url" = '' THEN 'seed://reference/aed-from-usd'
    ELSE r."source_url" || ' (AED from USD ×3.68)'
  END
FROM "affiliate_reference_price" r
WHERE r."currency" = 'USD'
  AND NOT EXISTS (
    SELECT 1
    FROM "affiliate_reference_price" x
    WHERE x."site_id" = r."site_id"
      AND x."service_id" = r."service_id"
      AND x."currency" = 'AED'
  );
--> statement-breakpoint

INSERT INTO "margin_policy" ("id", "scope", "service_id", "mode", "value", "currency", "enabled")
SELECT
  gen_random_uuid()::text,
  m."scope",
  m."service_id",
  m."mode",
  m."value",
  'AED',
  m."enabled"
FROM "margin_policy" m
WHERE m."currency" = 'USD'
  AND m."enabled" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "margin_policy" x
    WHERE x."scope" = m."scope"
      AND (x."service_id" IS NOT DISTINCT FROM m."service_id")
      AND x."mode" = m."mode"
      AND x."value" = m."value"
      AND x."currency" = 'AED'
      AND x."enabled" = m."enabled"
  );

-- Observability 6: additive timestamps, payment failure info, funnel country/device.
-- Expand-only: nullable columns, best-effort backfill, no drops/renames.

ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "fulfilled_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_paidAt_idx" ON "application" ("paid_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_fulfilledAt_idx" ON "application" ("fulfilled_at");--> statement-breakpoint

ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "failure_code" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "failure_message" text;--> statement-breakpoint

ALTER TABLE "analytics_funnel_event" ADD COLUMN IF NOT EXISTS "country_code" text;--> statement-breakpoint
ALTER TABLE "analytics_funnel_event" ADD COLUMN IF NOT EXISTS "device_type" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_funnel_event_countryCode_idx" ON "analytics_funnel_event" ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_funnel_event_deviceType_idx" ON "analytics_funnel_event" ("device_type");--> statement-breakpoint

-- paid_at: first payment_marked_paid audit for the application (and party members).
UPDATE "application" AS a
SET "paid_at" = s.paid_at
FROM (
  SELECT "entity_id" AS application_id, min("created_at") AS paid_at
  FROM "audit_log"
  WHERE "action" = 'payment_marked_paid'
    AND "entity_type" = 'application'
    AND "entity_id" IS NOT NULL
  GROUP BY "entity_id"
) AS s
WHERE a."id" = s.application_id
  AND a."paid_at" IS NULL
  AND a."payment_status" = 'paid';--> statement-breakpoint

UPDATE "application" AS a
SET "paid_at" = p."paid_at"
FROM "application" AS p
WHERE a."party_id" IS NOT NULL
  AND a."party_id" = p."party_id"
  AND p."paid_at" IS NOT NULL
  AND a."paid_at" IS NULL
  AND a."payment_status" = 'paid';--> statement-breakpoint

-- fulfilled_at: first admin transition to completed.
UPDATE "application" AS a
SET "fulfilled_at" = s.fulfilled_at
FROM (
  SELECT "entity_id" AS application_id, min("created_at") AS fulfilled_at
  FROM "audit_log"
  WHERE "action" = 'application.transition.applicationStatus'
    AND "entity_type" = 'application'
    AND "entity_id" IS NOT NULL
    AND "after_json" LIKE '%"applicationStatus":"completed"%'
  GROUP BY "entity_id"
) AS s
WHERE a."id" = s.application_id
  AND a."fulfilled_at" IS NULL
  AND a."application_status" = 'completed';--> statement-breakpoint

-- Fincra attempt failures already stored on payment_event (PR #39).
UPDATE "payment" AS p
SET
  "failure_code" = CASE
    WHEN pe."type" = 'charge.expired' THEN 'expired'
    WHEN pe."type" = 'charge.failed' THEN 'failed'
    ELSE p."failure_code"
  END,
  "failure_message" = COALESCE(p."failure_message", pe."status")
FROM (
  SELECT DISTINCT ON ("payment_id")
    "payment_id",
    "type",
    "status"
  FROM "payment_event"
  WHERE "payment_id" IS NOT NULL
    AND "type" IN ('charge.failed', 'charge.expired')
  ORDER BY "payment_id", "received_at" DESC
) AS pe
WHERE p."id" = pe."payment_id"
  AND p."failure_code" IS NULL
  AND p."status" IS DISTINCT FROM 'paid';--> statement-breakpoint

-- Ziina/Paddle rows already in failed status with no provider code.
UPDATE "payment"
SET "failure_code" = 'failed'
WHERE "failure_code" IS NULL
  AND "status" = 'failed';

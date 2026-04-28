-- Demo catalog seed: nationalities, visa services, eligibility, affiliate site + reference prices, global margin.
-- Safe to re-apply: uses ON CONFLICT upserts / DO NOTHING on composite keys.
-- Run via: pnpm db:seed:demo (not part of drizzle migrate).

INSERT INTO "affiliate_site" ("id", "domain", "enabled")
VALUES ('seed-affiliate-demo-1', 'pricing.demo.visatop.local', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "nationality" ("code", "name", "enabled")
VALUES
  ('US', 'United States', true),
  ('GB', 'United Kingdom', true),
  ('JP', 'Japan', true),
  ('DE', 'Germany', true)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "enabled" = EXCLUDED."enabled",
  "updated_at" = now();
--> statement-breakpoint

INSERT INTO "visa_service" ("id", "name", "enabled", "duration_days", "entries")
VALUES
  (
    'seed-svc-jp-tourist',
    'Demo — Japan tourist (short stay)',
    true,
    30,
    'single'
  ),
  (
    'seed-svc-gb-visitor',
    'Demo — UK standard visitor',
    true,
    180,
    'multiple'
  ),
  (
    'seed-svc-schengen-tourism',
    'Demo — Schengen short-stay tourism',
    true,
    90,
    'multiple'
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "enabled" = EXCLUDED."enabled",
  "duration_days" = EXCLUDED."duration_days",
  "entries" = EXCLUDED."entries",
  "updated_at" = now();
--> statement-breakpoint

INSERT INTO "visa_service_eligibility" ("service_id", "nationality_code")
VALUES
  ('seed-svc-jp-tourist', 'US'),
  ('seed-svc-jp-tourist', 'JP'),
  ('seed-svc-jp-tourist', 'GB'),
  ('seed-svc-gb-visitor', 'US'),
  ('seed-svc-gb-visitor', 'GB'),
  ('seed-svc-schengen-tourism', 'US'),
  ('seed-svc-schengen-tourism', 'GB'),
  ('seed-svc-schengen-tourism', 'DE')
ON CONFLICT ("service_id", "nationality_code") DO NOTHING;
--> statement-breakpoint

INSERT INTO "margin_policy" ("id", "scope", "service_id", "mode", "value", "currency", "enabled")
VALUES ('seed-margin-global', 'global', NULL, 'percent', 20, 'USD', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "margin_policy" ("id", "scope", "service_id", "mode", "value", "currency", "enabled")
VALUES (
  'seed-margin-jp-service',
  'service',
  'seed-svc-jp-tourist',
  'percent',
  12,
  'USD',
  true
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "margin_policy" ("id", "scope", "service_id", "mode", "value", "currency", "enabled")
VALUES ('seed-margin-global-aed', 'global', NULL, 'percent', 20, 'AED', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "margin_policy" ("id", "scope", "service_id", "mode", "value", "currency", "enabled")
VALUES (
  'seed-margin-jp-service-aed',
  'service',
  'seed-svc-jp-tourist',
  'percent',
  12,
  'AED',
  true
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "affiliate_reference_price" (
  "id",
  "site_id",
  "service_id",
  "amount",
  "currency",
  "observed_at",
  "source_url"
)
VALUES
  (
    'seed-ref-jp',
    'seed-affiliate-demo-1',
    'seed-svc-jp-tourist',
    14500,
    'USD',
    now(),
    'seed://reference/jp-tourist'
  ),
  (
    'seed-ref-gb',
    'seed-affiliate-demo-1',
    'seed-svc-gb-visitor',
    18900,
    'USD',
    now(),
    'seed://reference/gb-visitor'
  ),
  (
    'seed-ref-schengen',
    'seed-affiliate-demo-1',
    'seed-svc-schengen-tourism',
    9900,
    'USD',
    now(),
    'seed://reference/schengen'
  )
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "affiliate_reference_price" (
  "id",
  "site_id",
  "service_id",
  "amount",
  "currency",
  "observed_at",
  "source_url"
)
VALUES
  (
    'seed-ref-jp-aed',
    'seed-affiliate-demo-1',
    'seed-svc-jp-tourist',
    53360,
    'AED',
    now(),
    'seed://reference/jp-tourist-aed'
  ),
  (
    'seed-ref-gb-aed',
    'seed-affiliate-demo-1',
    'seed-svc-gb-visitor',
    69552,
    'AED',
    now(),
    'seed://reference/gb-visitor-aed'
  ),
  (
    'seed-ref-schengen-aed',
    'seed-affiliate-demo-1',
    'seed-svc-schengen-tourism',
    36432,
    'AED',
    now(),
    'seed://reference/schengen-aed'
  )
ON CONFLICT ("id") DO NOTHING;

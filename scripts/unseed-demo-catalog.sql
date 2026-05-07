-- Reverse demo seed + reset catalog for a clean XLSX import.
-- Run via: pnpm db:unseed:demo
--
-- What this does:
-- 1) Wipes ALL catalog_customer_price and catalog_customer_price_pending rows.
-- 2) Removes legacy demo rows in affiliate_reference_price / margin_policy if those tables still exist (pre–migration 0020).
-- 3) Deletes visa_service rows that are NOT referenced by any application (demo + orphan import services).
-- 4) Deletes demo affiliate_site (and its connectors) for seed-affiliate-demo-1.
-- 5) Deletes nationality rows US/GB/JP/DE only when no application references them.
--
-- Does NOT delete applications, users, or admin data.

--> statement-breakpoint
DELETE FROM "catalog_customer_price";
--> statement-breakpoint
DELETE FROM "catalog_customer_price_pending";
--> statement-breakpoint
DELETE FROM "affiliate_reference_price"
WHERE "id" LIKE 'seed-ref-%'
   OR "site_id" = 'seed-affiliate-demo-1';
--> statement-breakpoint
DELETE FROM "margin_policy"
WHERE "id" LIKE 'seed-margin-%';
--> statement-breakpoint
DELETE FROM "automation_job"
WHERE "connector_id" IN (
  SELECT "id" FROM "affiliate_connector" WHERE "site_id" = 'seed-affiliate-demo-1'
);
--> statement-breakpoint
DELETE FROM "affiliate_connector"
WHERE "site_id" = 'seed-affiliate-demo-1';
--> statement-breakpoint
DELETE FROM "affiliate_site"
WHERE "id" = 'seed-affiliate-demo-1';
--> statement-breakpoint
DELETE FROM "visa_service" v
WHERE v."id" LIKE 'seed-%'
  AND NOT EXISTS (
    SELECT 1 FROM "application" a WHERE a."service_id" = v."id"
  );
--> statement-breakpoint
DELETE FROM "nationality" n
WHERE n."code" IN ('US', 'GB', 'JP', 'DE')
  AND NOT EXISTS (
    SELECT 1 FROM "application" a WHERE a."nationality_code" = n."code"
  );

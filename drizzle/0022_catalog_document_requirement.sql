-- Migration 0022: catalog_document_requirement + RLS
-- Stores EXTRA document types per nationality × service.
-- CHECK forbids passport_copy and personal_photo (handled by dedicated flows).

CREATE TABLE "catalog_document_requirement" (
  "id"               text PRIMARY KEY DEFAULT gen_random_uuid(),
  "nationality_code" text NOT NULL REFERENCES "nationality"("code") ON DELETE CASCADE,
  "service_id"       text NOT NULL REFERENCES "visa_service"("id") ON DELETE CASCADE,
  "document_type"    text NOT NULL,
  "role"             text NOT NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_document_requirement_uidx"
    UNIQUE ("nationality_code", "service_id", "document_type"),
  CONSTRAINT "catalog_document_requirement_role_check"
    CHECK ("role" IN ('required', 'additional')),
  CONSTRAINT "catalog_document_requirement_document_type_check"
    CHECK ("document_type" NOT IN ('passport_copy', 'personal_photo'))
);--> statement-breakpoint

CREATE INDEX "catalog_document_requirement_nat_idx"
  ON "catalog_document_requirement" ("nationality_code");--> statement-breakpoint

CREATE INDEX "catalog_document_requirement_svc_idx"
  ON "catalog_document_requirement" ("service_id");--> statement-breakpoint

ALTER TABLE "catalog_document_requirement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY catalog_document_requirement_admin_select ON "catalog_document_requirement"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.read'));--> statement-breakpoint

CREATE POLICY catalog_document_requirement_admin_insert ON "catalog_document_requirement"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_document_requirement_admin_update ON "catalog_document_requirement"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_document_requirement_admin_delete ON "catalog_document_requirement"
  FOR DELETE
  USING (app_actor_type() = 'admin' AND app_has_permission('catalog.write'));--> statement-breakpoint

CREATE POLICY catalog_document_requirement_system_select ON "catalog_document_requirement"
  FOR SELECT
  USING (
    app_actor_type() = 'system'
    AND EXISTS (
      SELECT 1 FROM "visa_service" v
      WHERE v."id" = "catalog_document_requirement"."service_id" AND v."enabled" = true
    )
    AND EXISTS (
      SELECT 1 FROM "nationality" n
      WHERE n."code" = "catalog_document_requirement"."nationality_code" AND n."enabled" = true
    )
  );--> statement-breakpoint

-- Seed copies #8 bank extras only (AFRICA_ASIA_NATIONALITY_CODES + classifyServiceKind). Floor passport/photo stay in code.

INSERT INTO "catalog_document_requirement" ("nationality_code", "service_id", "document_type", "role")
SELECT e."nationality_code", e."service_id", 'bank_statement_6m', 'required'
FROM "visa_service_eligibility" e
JOIN "visa_service" ON "visa_service"."id" = e."service_id"
WHERE e."nationality_code" IN (
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD',
  'CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE',
  'LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG',
  'RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG',
  'EH','ZM','ZW',
  'AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','HK','IN','ID',
  'IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY','MV',
  'MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK',
  'SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE'
)
AND NOT (
  "visa_service"."name" ~* '\ytransit\y'
  OR "visa_service"."name" ~* '\y48[[:space:]]*h'
  OR "visa_service"."name" ~* '\y96[[:space:]]*h'
  OR ("visa_service"."duration_days" IS NOT NULL AND "visa_service"."duration_days" IN (2, 4))
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

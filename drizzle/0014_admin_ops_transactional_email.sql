-- Admin ops step label + transactional email idempotency (Mailgun).
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "admin_ops_step" text;

CREATE TABLE IF NOT EXISTS "transactional_email_sent" (
  "id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
  "application_id" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "transactional_email_sent_application_id_application_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE CASCADE ON UPDATE NO action
);

CREATE UNIQUE INDEX IF NOT EXISTS "transactional_email_sent_application_id_kind_uidx"
  ON "transactional_email_sent" USING btree ("application_id", "kind");

CREATE INDEX IF NOT EXISTS "transactional_email_sent_application_id_idx"
  ON "transactional_email_sent" USING btree ("application_id");

ALTER TABLE "transactional_email_sent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactional_email_sent_system_all" ON "transactional_email_sent"
  AS PERMISSIVE FOR ALL TO public
  USING (app_actor_type() = 'system'::text)
  WITH CHECK (app_actor_type() = 'system'::text);

CREATE POLICY "transactional_email_sent_admin_select" ON "transactional_email_sent"
  AS PERMISSIVE FOR SELECT TO public
  USING (app_actor_type() = 'admin'::text);

CREATE TABLE "platform_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "platform_setting" ("key", "value") VALUES ('draft_ttl_hours', '48');
--> statement-breakpoint
INSERT INTO "admin_permission" ("key", "description") VALUES
  ('settings.read', 'Read platform settings'),
  ('settings.write', 'Update platform settings')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "admin_role_permission" ("role_id", "permission_key") VALUES
  ('00000000-0000-0000-0000-000000000001', 'settings.read'),
  ('00000000-0000-0000-0000-000000000001', 'settings.write')
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "platform_setting" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "platform_setting_select_draft_ttl" ON "platform_setting"
  FOR SELECT
  USING ("key" = 'draft_ttl_hours');
--> statement-breakpoint
CREATE POLICY "platform_setting_admin_update_draft_ttl" ON "platform_setting"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('settings.write') AND "key" = 'draft_ttl_hours')
  WITH CHECK ("key" = 'draft_ttl_hours');

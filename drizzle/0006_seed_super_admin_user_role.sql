-- Link the Phase 0 bootstrapped admin to the seeded `super_admin` role so
-- `withAdminDbActor` resolves all permissions (RLS + app gates).
-- The role id matches `drizzle/0002_harsh_wolverine.sql`.
INSERT INTO "admin_user_role" ("admin_user_id", "role_id")
SELECT u."id", '00000000-0000-0000-0000-000000000001'
FROM "admin_user" u
WHERE lower(btrim(u."email")) = lower(btrim('info@visatop.com'))
ON CONFLICT ("admin_user_id", "role_id") DO NOTHING;

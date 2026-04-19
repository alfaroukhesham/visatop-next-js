DROP POLICY IF EXISTS "audit_log_system_insert" ON "audit_log";

CREATE POLICY "audit_log_system_insert" ON "audit_log"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'system');

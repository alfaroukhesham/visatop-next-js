-- Prevent duplicate visa_service rows with the same display name (case/whitespace insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS "visa_service_name_norm_uidx"
  ON "visa_service" (lower(trim("name")));

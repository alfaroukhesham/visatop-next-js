/**
 * Runtime DB URL for Next.js / API routes.
 * Prefer pooled `DATABASE_URL` (Neon `-pooler` host); reserve `DATABASE_URL_DIRECT` for migrations.
 */
export function resolveRuntimeDatabaseUrl(): string {
  const pooled = process.env.DATABASE_URL?.trim();
  if (pooled) return pooled;

  const direct = process.env.DATABASE_URL_DIRECT?.trim();
  if (direct) return direct;

  throw new Error(
    "DATABASE_URL is not set. Use the Neon pooled connection string for app runtime (see .env.example).",
  );
}

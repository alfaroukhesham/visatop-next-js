import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Keep runtime DB URL selection consistent with drizzle-kit migrations.
// Prefer DIRECT when present (better for migrations / long transactions), else fall back.
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL_DIRECT (preferred) or DATABASE_URL is not set. Add it to .env.local (see .env.example).",
  );
}

/** Pooled driver so `db.transaction()` works (RLS `set_config` is session-scoped). */
export const db = drizzle(url, { schema });

/** Transaction callback handle (same query surface as `db` for RLS-scoped work). */
export type DbTransaction = Parameters<
  Parameters<(typeof db)["transaction"]>[0]
>[0];

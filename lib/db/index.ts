import { drizzle } from "drizzle-orm/neon-serverless";
import { resolveRuntimeDatabaseUrl } from "@/lib/db/runtime-database-url";
import * as schema from "./schema";

const url = resolveRuntimeDatabaseUrl();

/** Pooled driver so `db.transaction()` works (RLS `set_config` is session-scoped). */
export const db = drizzle(url, { schema });

/** Transaction callback handle (same query surface as `db` for RLS-scoped work). */
export type DbTransaction = Parameters<
  Parameters<(typeof db)["transaction"]>[0]
>[0];

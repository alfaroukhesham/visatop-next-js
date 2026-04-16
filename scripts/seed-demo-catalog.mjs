/**
 * Optional demo catalog data (nationalities, services, pricing).
 * Does not run with `pnpm db:migrate` — invoke explicitly: `pnpm db:seed:demo`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url || typeof url !== "string") {
  console.error(
    "Missing DATABASE_URL_DIRECT or DATABASE_URL. Set in `.env` or `.env.local` (see `.env.example`).",
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "seed-demo-catalog.sql");
const raw = readFileSync(sqlPath, "utf8");
const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const pool = new pg.Pool({ connectionString: url });
try {
  for (let i = 0; i < statements.length; i++) {
    await pool.query(statements[i]);
  }
  console.log(`Demo seed OK (${statements.length} statement(s)).`);
} catch (e) {
  console.error("Demo seed failed:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

/**
 * Undo demo catalog seed + clear customer price tables for a clean XLSX import.
 * Safe on DBs that already ran migration 0020 (drops margin_policy / affiliate_reference_price):
 * statements that target missing tables are skipped.
 *
 * Invoke: pnpm db:unseed:demo
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

config({ path: resolve(projectRoot, ".env") });
config({ path: resolve(projectRoot, ".env.local"), override: true });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url || typeof url !== "string") {
  console.error(
    "Missing DATABASE_URL_DIRECT or DATABASE_URL. Set in `.env` or `.env.local` (see `.env.example`).",
  );
  process.exit(1);
}

const sqlPath = join(scriptDir, "unseed-demo-catalog.sql");
const raw = readFileSync(sqlPath, "utf8");
const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

function connectionSummary(connectionString) {
  try {
    const m = /:\/\/(?:[^@/]+@)?([^/?]+)\/([^?]*)/.exec(connectionString);
    if (m) return `${m[1]} / ${m[2] || "(default db)"}`;
  } catch {
    /* ignore */
  }
  return "(could not parse connection URL)";
}

/** PostgreSQL: undefined_table */
const UNDEFINED_TABLE = "42P01";

const pool = new pg.Pool({ connectionString: url });

async function printMigrationHint() {
  console.error(`Connection target: ${connectionSummary(url)}`);
  try {
    let rows;
    try {
      ({ rows } = await pool.query(
        `SELECT * FROM "__drizzle_migrations" ORDER BY "created_at" DESC LIMIT 8`,
      ));
    } catch {
      ({ rows } = await pool.query(`SELECT * FROM "__drizzle_migrations" LIMIT 20`));
    }
    if (rows.length) {
      console.error('Recent "__drizzle_migrations" rows:');
      console.error(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      console.error(
        "\nIf migrations look complete but catalog_customer_price is missing, the DB is out of sync with Drizzle history. In dev you can run: pnpm exec drizzle-kit push",
      );
    } else {
      console.error('No rows in "__drizzle_migrations" — empty or non-Drizzle database.');
    }
  } catch (e) {
    console.error("Could not read __drizzle_migrations:", e instanceof Error ? e.message : e);
  }
}

function isLegacyPricingStatement(sql) {
  const s = sql.toLowerCase();
  return s.includes('"affiliate_reference_price"') || s.includes('"margin_policy"');
}

try {
  console.log(`Using env from: ${projectRoot} (${connectionSummary(url)})`);

  let ran = 0;
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const optionalLegacy = isLegacyPricingStatement(sql);
    try {
      const res = await pool.query(sql);
      ran++;
      const n = res.rowCount;
      if (typeof n === "number" && n >= 0) {
        console.log(`OK [${i + 1}/${statements.length}] rows affected: ${n}`);
      } else {
        console.log(`OK [${i + 1}/${statements.length}]`);
      }
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? /** @type {{ code: string }} */ (e).code : "";
      if (code === UNDEFINED_TABLE && optionalLegacy) {
        console.warn(
          `Skip [${i + 1}/${statements.length}] (legacy pricing table already dropped in migration 0020):`,
          sql.split("\n")[0]?.slice(0, 80) ?? "",
        );
        continue;
      }
      if (code === UNDEFINED_TABLE && !optionalLegacy) {
        console.error(
          "\nThis database is missing a required table (e.g. catalog_customer_price).\n" +
            "Use the SAME DATABASE_URL_DIRECT / DATABASE_URL as in this repo’s .env at:\n" +
            `  ${projectRoot}\n\n` +
            "Then: pnpm run db:migrate\n",
        );
        console.error("Failing statement:", sql.split("\n")[0]?.slice(0, 120) ?? sql);
        await printMigrationHint();
      }
      throw e;
    }
  }
  console.log(`Demo unseed finished (${ran} statement(s) executed).`);
} catch (e) {
  console.error("Demo unseed failed:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

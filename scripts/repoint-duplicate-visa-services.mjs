/**
 * One-off: re-point applications from duplicate visa_service rows to canonical
 * services (same normalized name), then delete empty duplicate services.
 *
 * Usage: node scripts/repoint-duplicate-visa-services.mjs
 * Requires DATABASE_URL in environment (reads /root/visatop/.env if unset).
 */
import { readFileSync } from "node:fs";
import pg from "pg";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const env = readFileSync("/root/visatop/.env", "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found");
  return m[1].trim();
}

function compareCandidates(a, b) {
  if (b.price_count !== a.price_count) return b.price_count - a.price_count;
  const bt = b.last_price_update ? new Date(b.last_price_update).getTime() : 0;
  const at = a.last_price_update ? new Date(a.last_price_update).getTime() : 0;
  if (bt !== at) return bt - at;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

async function main() {
  const client = new pg.Client({ connectionString: loadDatabaseUrl() });
  await client.connect();

  try {
    await client.query("BEGIN");

    const { rows: services } = await client.query(`
      SELECT v.id, v.name, v.created_at,
        (SELECT count(*)::int FROM catalog_customer_price c WHERE c.service_id = v.id) AS price_count,
        (SELECT max(updated_at) FROM catalog_customer_price c WHERE c.service_id = v.id) AS last_price_update,
        (SELECT count(*)::int FROM application a WHERE a.service_id = v.id) AS app_count,
        (SELECT count(*)::int FROM visa_service_eligibility e WHERE e.service_id = v.id) AS elig_count,
        (SELECT count(*)::int FROM visa_service_addon sa WHERE sa.service_id = v.id) AS addon_count,
        (SELECT count(*)::int FROM catalog_customer_price_pending p WHERE p.service_id = v.id) AS pending_count
      FROM visa_service v
      ORDER BY v.name, v.created_at
    `);

    const byNorm = new Map();
    for (const s of services) {
      const norm = s.name.trim().toLowerCase();
      if (!byNorm.has(norm)) byNorm.set(norm, []);
      byNorm.get(norm).push(s);
    }

    const repointPairs = [];
    const deleteIds = [];

    for (const [, arr] of byNorm) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort(compareCandidates);
      const canonical = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const dup = sorted[i];
        repointPairs.push({ from: dup.id, to: canonical.id, name: dup.name });
        deleteIds.push(dup.id);
      }
    }

    console.log(`Re-pointing ${repointPairs.length} duplicate service(s)...`);
    let appsUpdated = 0;
    for (const { from, to, name } of repointPairs) {
      const r = await client.query(
        `UPDATE application SET service_id = $1 WHERE service_id = $2`,
        [to, from],
      );
      appsUpdated += r.rowCount ?? 0;
      console.log(`  ${name}: ${from} → ${to} (${r.rowCount} application(s))`);
    }

    console.log(`Deleting ${deleteIds.length} duplicate service row(s)...`);
    for (const id of deleteIds) {
      const check = await client.query(
        `SELECT
          (SELECT count(*)::int FROM catalog_customer_price WHERE service_id = $1) AS prices,
          (SELECT count(*)::int FROM application WHERE service_id = $1) AS apps,
          (SELECT count(*)::int FROM visa_service_eligibility WHERE service_id = $1) AS elig,
          (SELECT count(*)::int FROM catalog_customer_price_pending WHERE service_id = $1) AS pending`,
        [id],
      );
      const c = check.rows[0];
      if (c.prices > 0 || c.apps > 0 || c.pending > 0) {
        throw new Error(`Refusing to delete ${id}: still referenced (${JSON.stringify(c)})`);
      }
      await client.query(`DELETE FROM visa_service WHERE id = $1`, [id]);
    }

    const { rows: remainingDupNames } = await client.query(`
      SELECT lower(trim(name)) AS norm, count(*)::int AS cnt
      FROM visa_service
      GROUP BY 1
      HAVING count(*) > 1
    `);

    await client.query("COMMIT");

    console.log("\nDone.");
    console.log({ applicationsRepointed: appsUpdated, duplicateServicesDeleted: deleteIds.length });
    console.log({ remainingDuplicateNames: remainingDupNames.length });
    if (remainingDupNames.length > 0) {
      console.warn("Still duplicated (likely both have prices — manual merge needed):", remainingDupNames);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

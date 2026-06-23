import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const sql = neon(
  readFileSync("/root/visatop/.env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
);

const counts = await sql`
  SELECT 'catalog_customer_price' AS tbl, count(*)::int AS cnt FROM catalog_customer_price
  UNION ALL SELECT 'catalog_customer_price_pending', count(*)::int FROM catalog_customer_price_pending
  UNION ALL SELECT 'visa_service_eligibility', count(*)::int FROM visa_service_eligibility
`;

const pendingBatches = await sql`
  SELECT batch_id, count(*)::int AS cnt, min(created_at) AS first_at
  FROM catalog_customer_price_pending
  GROUP BY 1 ORDER BY first_at DESC
`;

const pendingSummary = await sql`
  SELECT count(*)::int AS total,
         count(DISTINCT (nationality_code, service_id))::int AS distinct_pairs,
         count(DISTINCT batch_id)::int AS batch_count
  FROM catalog_customer_price_pending
`;

const dupPendingPairs = await sql`
  SELECT count(*)::int AS pairs_with_dupes FROM (
    SELECT nationality_code, service_id FROM catalog_customer_price_pending
    GROUP BY 1,2 HAVING count(*) > 1
  ) t
`;

const dupPendingDetail = await sql`
  SELECT nationality_code, service_id, count(*)::int AS cnt, count(DISTINCT batch_id)::int AS batches
  FROM catalog_customer_price_pending
  GROUP BY 1,2 HAVING count(*) > 1
  ORDER BY cnt DESC LIMIT 10
`;

const priceBySource = await sql`
  SELECT source, count(*)::int AS cnt, max(updated_at) AS last_update
  FROM catalog_customer_price GROUP BY source ORDER BY cnt DESC
`;

const priceByTime = await sql`
  SELECT date_trunc('minute', updated_at) AS ts, count(*)::int AS cnt
  FROM catalog_customer_price GROUP BY 1 ORDER BY ts DESC LIMIT 10
`;

const pricePairs = await sql`
  SELECT count(DISTINCT (nationality_code, service_id))::int AS pairs, count(*)::int AS rows
  FROM catalog_customer_price
`;

const pendingOverlapPublished = await sql`
  SELECT count(*)::int AS cnt FROM catalog_customer_price_pending p
  WHERE EXISTS (
    SELECT 1 FROM catalog_customer_price c
    WHERE c.nationality_code = p.nationality_code AND c.service_id = p.service_id
  )
`;

const dupPrices = await sql`
  SELECT nationality_code, service_id, currency, count(*)::int AS cnt
  FROM catalog_customer_price GROUP BY 1,2,3 HAVING count(*) > 1 LIMIT 5
`;

const audits = await sql`
  SELECT action, created_at, after_json::text
  FROM audit_log
  WHERE action IN ('catalog_customer_price.bulk_import', 'catalog_customer_price.assign_pending_currency')
  ORDER BY created_at DESC LIMIT 12
`;

console.log(JSON.stringify({
  counts,
  pendingSummary: pendingSummary[0],
  pendingBatches,
  dupPendingPairs: dupPendingPairs[0],
  dupPendingDetail,
  pricePairs: pricePairs[0],
  priceBySource,
  priceByTime,
  pendingOverlapPublished: pendingOverlapPublished[0],
  dupPrices,
  audits: audits.map((a) => ({
    action: a.action,
    at: a.created_at,
    after: JSON.parse(a.after_json),
  })),
}, null, 2));

import { sql, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { ImportCatalogScope } from "./purge-catalog-outside-sheet-scope";

export type ImportPriceUpsert = {
  nationalityCode: string;
  serviceId: string;
  currency: "USD" | "AED";
  amountMinor: bigint;
  source: string;
};

export type ImportPairDelete = {
  nationalityCode: string;
  serviceId: string;
};

export type ImportPendingRow = {
  nationalityCode: string;
  serviceId: string;
  amountMinor: bigint;
};

export type FilteredImportPlan = {
  upserts: ImportPriceUpsert[];
  deletes: ImportPairDelete[];
  pending: ImportPendingRow[];
  replacePurgeNeeded: boolean;
  clearStalePendingNeeded: boolean;
  hasChanges: boolean;
};

function pairKey(nationalityCode: string, serviceId: string): string {
  return `${nationalityCode}\x1f${serviceId}`;
}

function priceTripleKey(nationalityCode: string, serviceId: string, currency: string): string {
  return `${nationalityCode}\x1f${serviceId}\x1f${currency}`;
}

function pendingKey(nationalityCode: string, serviceId: string, amountMinor: bigint): string {
  return `${nationalityCode}\x1f${serviceId}\x1f${amountMinor.toString()}`;
}

async function countPricesOutsideSheetScope(
  tx: DbTransaction,
  sheetNationalities: ReadonlySet<string>,
  sheetServiceIds: ReadonlySet<string>,
): Promise<number> {
  const nats = [...sheetNationalities];
  if (!nats.length) return 0;

  const natIn = sql.join(nats.map((n) => sql`${n}`), sql`, `);
  const svcIds = [...sheetServiceIds];

  if (svcIds.length === 0) {
    const r = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.catalogCustomerPrice)
      .where(sql`nationality_code NOT IN (${natIn})`);
    return r[0]?.c ?? 0;
  }

  const svcIn = sql.join(svcIds.map((id) => sql`${id}`), sql`, `);
  const r = await tx
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.catalogCustomerPrice)
    .where(
      sql`nationality_code NOT IN (${natIn})
        OR (nationality_code IN (${natIn}) AND service_id NOT IN (${svcIn}))`,
    );
  return r[0]?.c ?? 0;
}

/**
 * Drop import operations that would leave the catalog unchanged.
 * Empty-cell deletes are kept when prices or eligibility still exist for the pair.
 */
export async function filterImportPlanToChanges(
  tx: DbTransaction,
  input: {
    upserts: ImportPriceUpsert[];
    deletes: ImportPairDelete[];
    pending: ImportPendingRow[];
    catalogScope: ImportCatalogScope;
    sheetNationalities: ReadonlySet<string>;
    sheetServiceIds: ReadonlySet<string>;
  },
): Promise<FilteredImportPlan> {
  const deletePairs = [...input.deletes];
  const upserts = [...input.upserts];
  const pending = [...input.pending];

  const pairKeys = new Set<string>();
  for (const d of deletePairs) pairKeys.add(pairKey(d.nationalityCode, d.serviceId));
  for (const u of upserts) pairKeys.add(pairKey(u.nationalityCode, u.serviceId));
  for (const p of pending) pairKeys.add(pairKey(p.nationalityCode, p.serviceId));

  const existingPrices = new Map<string, { amountMinor: bigint; source: string }>();
  const pairsWithPrices = new Set<string>();
  const pairsWithEligibility = new Set<string>();

  if (pairKeys.size > 0) {
    const tupleIn = sql.join(
      [...pairKeys].map((k) => {
        const [nationalityCode, serviceId] = k.split("\x1f");
        return sql`(${nationalityCode}, ${serviceId})`;
      }),
      sql`, `,
    );

    const priceRows = await tx
      .select({
        nationalityCode: schema.catalogCustomerPrice.nationalityCode,
        serviceId: schema.catalogCustomerPrice.serviceId,
        currency: schema.catalogCustomerPrice.currency,
        amountMinor: schema.catalogCustomerPrice.amountMinor,
        source: schema.catalogCustomerPrice.source,
      })
      .from(schema.catalogCustomerPrice)
      .where(sql`(nationality_code, service_id) IN (${tupleIn})`);

    for (const row of priceRows) {
      const pk = pairKey(row.nationalityCode, row.serviceId);
      pairsWithPrices.add(pk);
      existingPrices.set(priceTripleKey(row.nationalityCode, row.serviceId, row.currency), {
        amountMinor: BigInt(row.amountMinor),
        source: row.source,
      });
    }

    const eligRows = await tx
      .select({
        nationalityCode: schema.visaServiceEligibility.nationalityCode,
        serviceId: schema.visaServiceEligibility.serviceId,
      })
      .from(schema.visaServiceEligibility)
      .where(
        sql`(service_id, nationality_code) IN (${sql.join(
          [...pairKeys].map((k) => {
            const [nationalityCode, serviceId] = k.split("\x1f");
            return sql`(${serviceId}, ${nationalityCode})`;
          }),
          sql`, `,
        )})`,
      );

    for (const row of eligRows) {
      pairsWithEligibility.add(pairKey(row.nationalityCode, row.serviceId));
    }
  }

  const existingPending = new Set<string>();
  if (pending.length > 0) {
    const serviceIds = [...new Set(pending.map((p) => p.serviceId))];
    const pendingRows = await tx
      .select({
        nationalityCode: schema.catalogCustomerPricePending.nationalityCode,
        serviceId: schema.catalogCustomerPricePending.serviceId,
        amountMinor: schema.catalogCustomerPricePending.amountMinor,
      })
      .from(schema.catalogCustomerPricePending)
      .where(inArray(schema.catalogCustomerPricePending.serviceId, serviceIds));

    for (const row of pendingRows) {
      existingPending.add(
        pendingKey(row.nationalityCode, row.serviceId, BigInt(row.amountMinor)),
      );
    }
  }

  const filteredDeletes = deletePairs.filter((d) => {
    const pk = pairKey(d.nationalityCode, d.serviceId);
    return pairsWithPrices.has(pk) || pairsWithEligibility.has(pk);
  });

  const filteredUpserts = upserts.filter((u) => {
    const key = priceTripleKey(u.nationalityCode, u.serviceId, u.currency);
    const existing = existingPrices.get(key);
    if (!existing) return true;
    return existing.amountMinor !== u.amountMinor || existing.source !== u.source;
  });

  const filteredPending = pending.filter((p) => {
    if (existingPending.has(pendingKey(p.nationalityCode, p.serviceId, p.amountMinor))) {
      return false;
    }
    const pk = pairKey(p.nationalityCode, p.serviceId);
    if (!pairsWithPrices.has(pk)) return true;
    // Already published for this pair — skip re-pending the same sheet cell.
    const usd = existingPrices.get(priceTripleKey(p.nationalityCode, p.serviceId, "USD"));
    const aed = existingPrices.get(priceTripleKey(p.nationalityCode, p.serviceId, "AED"));
    return !(
      (usd?.amountMinor === p.amountMinor && usd.source === "admin_import") ||
      (aed?.amountMinor === p.amountMinor && aed.source === "admin_import")
    );
  });

  let replacePurgeNeeded = false;
  let clearStalePendingNeeded = false;
  if (input.catalogScope === "replace") {
    const outside = await countPricesOutsideSheetScope(
      tx,
      input.sheetNationalities,
      input.sheetServiceIds,
    );
    replacePurgeNeeded = outside > 0;

    const pendingCount = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.catalogCustomerPricePending);
    clearStalePendingNeeded = (pendingCount[0]?.c ?? 0) > 0;
  }

  const hasChanges =
    filteredUpserts.length > 0 ||
    filteredDeletes.length > 0 ||
    filteredPending.length > 0 ||
    replacePurgeNeeded ||
    clearStalePendingNeeded;

  return {
    upserts: filteredUpserts,
    deletes: filteredDeletes,
    pending: filteredPending,
    replacePurgeNeeded,
    clearStalePendingNeeded,
    hasChanges,
  };
}

/**
 * Transactional logic for applying a parsed price sheet import.
 *
 * Input: parsed grid (from parse-price-sheet + read-xlsx-buffer)
 * Output: apply summary with autoFix list, errors, eligibility changes
 *
 * All writes run inside a withAdminDbActor transaction.
 */

import { eq, sql, inArray, asc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  detectHeaderRowIndex,
  parseHeaderRow,
  matchNationality,
  parseMoneyCell,
  normalizeCountryName,
  collectMissingNationalityEntries,
  type RawRow,
  type MissingNationalityEntry,
} from "./parse-price-sheet";
import { fxUsdToAed, fxAedToUsd, readFxRateString } from "@/lib/pricing/fx-usd-aed";
import { withSuggestedAlpha2 } from "./suggest-country-alpha2";

export type ImportRowError = {
  rowIdx: number; // 1-based display row
  countryRaw: string;
  message: string;
};

export type AutoFix = {
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  fixedCurrency: "USD" | "AED";
  derivedFrom: "USD" | "AED";
  fxRate: string;
};

export type PendingRow = {
  id: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  amountMinor: string;
  rowRef: string;
  batchId: string;
};

export type ServiceCreated = {
  id: string;
  name: string;
};

export type ApplyImportResult = {
  batchId: string;
  /** When false, no prices/pending/eligibility/audit were written (validation or invalid sheet). */
  committed: boolean;
  /** Row index of detected header, or -1 if none. */
  headerRowIndex: number;
  partialApplied: boolean;
  rowsProcessed: number;
  skippedRows: number;
  skippedCells: number;
  pricesUpserted: number;
  pricesDeleted: number;
  pendingCreated: number;
  eligibilityAdded: number;
  eligibilityRemoved: number;
  autoFix: AutoFix[];
  servicesCreated: ServiceCreated[];
  errors: ImportRowError[];
  /** Country names from the sheet with no matching nationality row (apply blocked until resolved). */
  missingNationalities: MissingNationalityEntry[];
};

export type PreviewImportResult = {
  headerRowIndex: number;
  headerRowCount: number; // rows scanned
  errors: ImportRowError[];
  pending: Array<{
    rowIdx: number;
    nationalityCode: string | null;
    serviceId: string | null;
    serviceName: string;
    amountMinor: string;
    rowRef: string;
  }>;
  autoFixPreview: Array<{
    nationalityCode: string | null;
    serviceName: string;
    existingCurrency: "USD" | "AED";
    derivedCurrency: "USD" | "AED";
    fxRate: string | null;
  }>;
  unknownServices: string[];
  /** Distinct sheet countries not in the nationality catalog (bulk-create UX). */
  missingNationalities: MissingNationalityEntry[];
  stats: {
    dataRows: number;
    pricedCells: number;
    ambiguousCells: number;
    emptyCells: number;
  };
};

type SchemaDb = DbTransaction;

/** Unit separator — avoids collisions if country codes ever contained `|`. */
const IMPORT_PAIR_SEP = "\x1f";

function natServiceNormKey(natCode: string, serviceNorm: string) {
  return `${natCode}${IMPORT_PAIR_SEP}${serviceNorm}`;
}

function splitNatServiceNormKey(key: string): { natCode: string; serviceNorm: string } {
  const i = key.indexOf(IMPORT_PAIR_SEP);
  if (i <= 0) {
    return { natCode: key, serviceNorm: "" };
  }
  return {
    natCode: key.slice(0, i),
    serviceNorm: key.slice(i + IMPORT_PAIR_SEP.length),
  };
}

function natSvcIdKey(natCode: string, serviceId: string) {
  return `${natCode}${IMPORT_PAIR_SEP}${serviceId}`;
}

/** Postgres parameter budget — keep batched statements well under limits. */
const UPSERT_CHUNK = 400;
const DELETE_PAIR_CHUNK = 400;
const PENDING_INSERT_CHUNK = 500;
const PENDING_DELETE_ID_CHUNK = 500;
const ELIGIBILITY_PAIR_CHUNK = 350;
/** Larger batches for assign-pending (fewer round trips; under PG param limits). */
const ASSIGN_PRICE_UPSERT_CHUNK = 2500;
/** Distinct (nat, service) pairs per INSERT…SELECT eligibility statement. */
const ELIGIBILITY_INSERT_SELECT_CHUNK = 2000;

/** Cap autoFix rows returned to the client and stored on audit (full list is redundant at scale). */
const ASSIGN_PENDING_AUTOFIX_RESPONSE_CAP = 80;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function neonSqlRows(result: unknown): Record<string, unknown>[] {
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

/**
 * Ensures visa_service_eligibility rows exist for every (nationality, service) that already has
 * catalog_customer_price rows matching `pairs`. One INSERT…SELECT per chunk; counts newly inserted rows.
 * Faster than GROUP BY counts + separate inserts when prices are already materialised (e.g. assign pending).
 */
async function bulkEnsureEligibilityFromCatalogPrices(
  tx: SchemaDb,
  pairs: { nationalityCode: string; serviceId: string }[],
): Promise<number> {
  if (pairs.length === 0) return 0;
  let added = 0;
  for (const chunk of chunkArray(pairs, ELIGIBILITY_INSERT_SELECT_CHUNK)) {
    const tupleIn = sql.join(
      chunk.map((p) => sql`(${p.nationalityCode}, ${p.serviceId})`),
      sql`, `,
    );
    const r = await tx.execute(sql`
      WITH ins AS (
        INSERT INTO visa_service_eligibility (service_id, nationality_code)
        SELECT DISTINCT c.service_id, c.nationality_code
        FROM catalog_customer_price AS c
        WHERE (c.nationality_code, c.service_id) IN (${tupleIn})
        ON CONFLICT (service_id, nationality_code) DO NOTHING
        RETURNING 1
      )
      SELECT count(*)::int AS added FROM ins
    `);
    const rows = neonSqlRows(r);
    const n = Number(rows[0]?.added ?? 0);
    if (Number.isFinite(n)) added += n;
  }
  return added;
}

/**
 * After bulk price writes, sync visa_service_eligibility for all touched nationality×service pairs.
 * Replaces per-pair count + insert/delete round trips with batched SQL.
 */
async function syncEligibilityForTouchedPairs(
  tx: SchemaDb,
  touchedKeys: string[],
): Promise<{ added: number; removed: number }> {
  if (touchedKeys.length === 0) return { added: 0, removed: 0 };

  let eligibilityAdded = 0;
  let eligibilityRemoved = 0;

  for (const keyChunk of chunkArray(touchedKeys, ELIGIBILITY_PAIR_CHUNK)) {
    const pairs = keyChunk.map((key) => {
      const { natCode, serviceNorm: serviceId } = splitNatServiceNormKey(key);
      return { nationalityCode: natCode, serviceId };
    });

    const tupleIn = sql.join(
      pairs.map((p) => sql`(${p.nationalityCode}, ${p.serviceId})`),
      sql`, `,
    );

    const countRows = await tx
      .select({
        nationalityCode: schema.catalogCustomerPrice.nationalityCode,
        serviceId: schema.catalogCustomerPrice.serviceId,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.catalogCustomerPrice)
      .where(sql`(nationality_code, service_id) IN (${tupleIn})`)
      .groupBy(schema.catalogCustomerPrice.nationalityCode, schema.catalogCustomerPrice.serviceId);

    const hasPrice = new Set(
      countRows
        .filter((r) => (r.c ?? 0) > 0)
        .map((r) => natSvcIdKey(r.nationalityCode, r.serviceId)),
    );

    const toEnsure = pairs.filter((p) => hasPrice.has(natSvcIdKey(p.nationalityCode, p.serviceId)));
    const toRemove = pairs.filter((p) => !hasPrice.has(natSvcIdKey(p.nationalityCode, p.serviceId)));

    if (toEnsure.length > 0) {
      const ins = await tx
        .insert(schema.visaServiceEligibility)
        .values(
          toEnsure.map((p) => ({
            serviceId: p.serviceId,
            nationalityCode: p.nationalityCode,
          })),
        )
        .onConflictDoNothing()
        .returning({ serviceId: schema.visaServiceEligibility.serviceId });
      eligibilityAdded += ins.length;
    }

    if (toRemove.length > 0) {
      const rmIn = sql.join(
        toRemove.map((p) => sql`(${p.serviceId}, ${p.nationalityCode})`),
        sql`, `,
      );
      const del = await tx
        .delete(schema.visaServiceEligibility)
        .where(sql`(service_id, nationality_code) IN (${rmIn})`)
        .returning({ serviceId: schema.visaServiceEligibility.serviceId });
      eligibilityRemoved += del.length;
    }
  }

  return { added: eligibilityAdded, removed: eligibilityRemoved };
}

// ─── Nationality map builder ─────────────────────────────────────────────────

async function buildNationalityMap(tx: SchemaDb): Promise<Map<string, string>> {
  const rows = await tx
    .select({ code: schema.nationality.code, name: schema.nationality.name })
    .from(schema.nationality);
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(normalizeCountryName(r.name), r.code);
  }
  return map;
}

// ─── Service resolver (create if unknown) ────────────────────────────────────

async function resolveServiceId(
  tx: SchemaDb,
  trimmedName: string,
  serviceNameToId: Map<string, string>,
  created: ServiceCreated[],
): Promise<string> {
  const norm = trimmedName.trim().toLowerCase();
  const existing = serviceNameToId.get(norm);
  if (existing) return existing;

  // Create a new visa_service (enabled, null duration/entries)
  const newId = createId();
  await tx.insert(schema.visaService).values({
    id: newId,
    name: trimmedName.trim(),
    enabled: true,
  });
  serviceNameToId.set(norm, newId);
  created.push({ id: newId, name: trimmedName.trim() });
  return newId;
}

// ─── Audit log ───────────────────────────────────────────────────────────────

async function writeImportAudit(
  tx: SchemaDb,
  adminUserId: string,
  summary: ApplyImportResult,
  fileHash?: string,
): Promise<void> {
  await tx.insert(schema.auditLog).values({
    actorType: "admin",
    actorId: adminUserId,
    action: "catalog_customer_price.bulk_import",
    entityType: "catalog_customer_price",
    entityId: summary.batchId,
    afterJson: JSON.stringify({
      batchId: summary.batchId,
      fileHash: fileHash ?? null,
      partialApplied: summary.partialApplied,
      rowsProcessed: summary.rowsProcessed,
      skippedRows: summary.skippedRows,
      skippedCells: summary.skippedCells,
      pricesUpserted: summary.pricesUpserted,
      pricesDeleted: summary.pricesDeleted,
      pendingCreated: summary.pendingCreated,
      eligibilityAdded: summary.eligibilityAdded,
      eligibilityRemoved: summary.eligibilityRemoved,
      autoFix: summary.autoFix,
      servicesCreated: summary.servicesCreated,
      errors: summary.errors,
    }),
  });
}

// ─── Preview (no writes) ─────────────────────────────────────────────────────

export async function previewPriceSheetImport(
  tx: SchemaDb,
  rows: RawRow[],
): Promise<PreviewImportResult> {
  const headerRowIdx = detectHeaderRowIndex(rows);
  if (headerRowIdx === -1) {
    return {
      headerRowIndex: -1,
      headerRowCount: rows.length,
      errors: [
        {
          rowIdx: 0,
          countryRaw: "",
          message:
            "Could not detect header row. Ensure the sheet has columns: '#', 'Country', and at least one service column within the first 25 rows.",
        },
      ],
      pending: [],
      autoFixPreview: [],
      unknownServices: [],
      missingNationalities: [],
      stats: { dataRows: 0, pricedCells: 0, ambiguousCells: 0, emptyCells: 0 },
    };
  }

  const header = parseHeaderRow(rows[headerRowIdx]);
  const nationalityMap = await buildNationalityMap(tx);
  const missingNationalities = withSuggestedAlpha2(
    collectMissingNationalityEntries(rows, headerRowIdx, header.countryColIdx, nationalityMap),
  );

  // Existing services map
  const existingServices = await tx
    .select({ id: schema.visaService.id, name: schema.visaService.name })
    .from(schema.visaService);
  const serviceNameToId = new Map<string, string>();
  for (const s of existingServices) {
    serviceNameToId.set(s.name.trim().toLowerCase(), s.id);
  }

  const errors: PreviewImportResult["errors"] = [];
  const pending: PreviewImportResult["pending"] = [];
  const autoFixPreview: PreviewImportResult["autoFixPreview"] = [];
  const unknownServices: string[] = [];
  const stats = { dataRows: 0, pricedCells: 0, ambiguousCells: 0, emptyCells: 0 };

  // Identify unknown service headers
  for (const col of header.serviceColumns) {
    const norm = col.trimmedName.toLowerCase();
    if (!serviceNameToId.has(norm)) {
      unknownServices.push(col.trimmedName);
    }
  }

  // Detect FX rate availability (don't throw — just note in preview)
  let fxRateStr: string | null = null;
  try {
    fxRateStr = readFxRateString();
  } catch {
    // FX rate missing — will surface in autoFixPreview cells that need it
  }

  // Track per (nationality, service) which currencies are present in the sheet.
  const seenPairCurrencies = new Map<
    string,
    { serviceName: string; currencies: Set<"USD" | "AED"> }
  >();
  function pairKey(nat: string, svcName: string) {
    return natServiceNormKey(nat, svcName.toLowerCase());
  }

  // Scan data rows
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const countryRaw = row[header.countryColIdx];
    if (countryRaw == null || String(countryRaw).trim() === "") continue;

    stats.dataRows++;
    const natCode = matchNationality(countryRaw, nationalityMap);

    for (const col of header.serviceColumns) {
      const raw = row[col.colIdx];
      const parsed = parseMoneyCell(raw);
      const svcName = col.trimmedName;

      if (parsed.kind === "empty") {
        stats.emptyCells++;
      } else if (parsed.kind === "priced") {
        stats.pricedCells++;
        if (natCode) {
          const k = pairKey(natCode, svcName);
          const existing = seenPairCurrencies.get(k) ?? {
            serviceName: svcName,
            currencies: new Set<"USD" | "AED">(),
          };
          existing.currencies.add(parsed.currency);
          existing.serviceName = svcName;
          seenPairCurrencies.set(k, existing);
        }
      } else if (parsed.kind === "ambiguous") {
        stats.ambiguousCells++;
        const svcId = serviceNameToId.get(svcName.toLowerCase()) ?? null;
        pending.push({
          rowIdx: i + 1,
          nationalityCode: natCode,
          serviceId: svcId,
          serviceName: svcName,
          amountMinor: parsed.amountMinor.toString(),
          rowRef: `row ${i + 1}, col ${col.colIdx + 1}`,
        });
      }
    }
  }

  // Build auto-fix preview: any pair with exactly one currency in sheet will need FX.
  for (const [key, entry] of seenPairCurrencies) {
    if (entry.currencies.size !== 1) continue;
    const { natCode } = splitNatServiceNormKey(key);
    const [existingCurrency] = [...entry.currencies.values()];
    const derivedCurrency: "USD" | "AED" = existingCurrency === "USD" ? "AED" : "USD";
    autoFixPreview.push({
      nationalityCode: natCode,
      serviceName: entry.serviceName,
      existingCurrency,
      derivedCurrency,
      fxRate: fxRateStr,
    });
  }

  // If FX is missing but sheet would require FX-derived materialisation, surface as preview errors.
  if (!fxRateStr && autoFixPreview.length > 0) {
    errors.push({
      rowIdx: 0,
      countryRaw: "",
      message:
        "FX rate is not configured, but the sheet requires FX auto-fill (only one currency present for some rows). Set NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD (or FX_AED_PER_USD) before applying.",
    });
  }

  return {
    headerRowIndex: headerRowIdx,
    headerRowCount: rows.length,
    errors,
    pending,
    autoFixPreview,
    unknownServices,
    missingNationalities,
    stats,
  };
}

// ─── Apply (transactional writes) ────────────────────────────────────────────

export async function applyPriceSheetImport(
  tx: SchemaDb,
  rows: RawRow[],
  adminUserId: string,
  options: { fileHash?: string; mode?: "strict" | "partial" } = {},
): Promise<ApplyImportResult> {
  const batchId = createId();
  const errors: ImportRowError[] = [];
  const autoFix: AutoFix[] = [];
  const servicesCreated: ServiceCreated[] = [];

  let pricesUpserted = 0;
  let pricesDeleted = 0;
  let pendingCreated = 0;
  let eligibilityAdded = 0;
  let eligibilityRemoved = 0;
  let rowsProcessed = 0;
  let skippedRows = 0;
  let skippedCells = 0;

  const headerRowIdx = detectHeaderRowIndex(rows);
  if (headerRowIdx === -1) {
    return {
      batchId,
      committed: false,
      headerRowIndex: -1,
      partialApplied: false,
      rowsProcessed: 0,
      skippedRows: 0,
      skippedCells: 0,
      pricesUpserted: 0,
      pricesDeleted: 0,
      pendingCreated: 0,
      eligibilityAdded: 0,
      eligibilityRemoved: 0,
      autoFix: [],
      servicesCreated: [],
      missingNationalities: [],
      errors: [
        {
          rowIdx: 0,
          countryRaw: "",
          message:
            "Could not detect header row. Ensure the sheet has columns: '#', 'Country', and at least one service column within the first 25 rows.",
        },
      ],
    };
  }

  const header = parseHeaderRow(rows[headerRowIdx]);
  const nationalityMap = await buildNationalityMap(tx);
  const missingNationalities = withSuggestedAlpha2(
    collectMissingNationalityEntries(rows, headerRowIdx, header.countryColIdx, nationalityMap),
  );

  if (missingNationalities.length > 0) {
    return {
      batchId,
      committed: false,
      headerRowIndex: headerRowIdx,
      partialApplied: false,
      rowsProcessed: 0,
      skippedRows: 0,
      skippedCells: 0,
      pricesUpserted: 0,
      pricesDeleted: 0,
      pendingCreated: 0,
      eligibilityAdded: 0,
      eligibilityRemoved: 0,
      autoFix: [],
      servicesCreated: [],
      missingNationalities,
      errors: [],
    };
  }


  const existingServices = await tx
    .select({ id: schema.visaService.id, name: schema.visaService.name })
    .from(schema.visaService);
  const serviceNameToId = new Map<string, string>();
  for (const s of existingServices) {
    serviceNameToId.set(s.name.trim().toLowerCase(), s.id);
  }

  const serviceColByIdx = new Map<
    number,
    { serviceName: string; serviceNorm: string }
  >();
  for (const col of header.serviceColumns) {
    const serviceNorm = col.trimmedName.trim().toLowerCase();
    serviceColByIdx.set(col.colIdx, {
      serviceName: col.trimmedName,
      serviceNorm,
    });
  }

  const seenPair = new Map<
    string,
    { usdMinor?: bigint; aedMinor?: bigint }
  >();

  type UpsertPlan = {
    nationalityCode: string;
    serviceNorm: string;
    serviceName: string;
    currency: "USD" | "AED";
    amountMinor: bigint;
    source: string;
  };

  const toUpsert: UpsertPlan[] = [];
  const toDelete: Array<{ nationalityCode: string; serviceNorm: string }> = [];
  const toPending: Array<{
    nationalityCode: string;
    serviceNorm: string;
    serviceName: string;
    amountMinor: bigint;
    rowRef: string;
  }> = [];

  const rowHasError = new Set<number>();

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const countryRaw = row[header.countryColIdx];
    if (countryRaw == null || String(countryRaw).trim() === "") continue;

    rowsProcessed++;
    const natCode = matchNationality(countryRaw, nationalityMap);
    if (!natCode) {
      rowHasError.add(i);
      skippedRows++;
      skippedCells += header.serviceColumns.length;
      continue;
    }

    for (const col of header.serviceColumns) {
      const meta = serviceColByIdx.get(col.colIdx);
      if (!meta) continue;

      const raw = row[col.colIdx];
      const parsed = parseMoneyCell(raw);
      const pairK = natServiceNormKey(natCode, meta.serviceNorm);

      if (parsed.kind === "empty") {
        if (rowHasError.has(i)) {
          skippedCells++;
        } else {
          toDelete.push({ nationalityCode: natCode, serviceNorm: meta.serviceNorm });
        }
      } else if (parsed.kind === "priced") {
        const existing = seenPair.get(pairK) ?? {};
        if (parsed.currency === "USD") {
          existing.usdMinor = parsed.amountMinor;
        } else {
          existing.aedMinor = parsed.amountMinor;
        }
        seenPair.set(pairK, existing);
        toUpsert.push({
          nationalityCode: natCode,
          serviceNorm: meta.serviceNorm,
          serviceName: meta.serviceName,
          currency: parsed.currency,
          amountMinor: parsed.amountMinor,
          source: "admin_import",
        });
      } else if (parsed.kind === "ambiguous") {
        toPending.push({
          nationalityCode: natCode,
          serviceNorm: meta.serviceNorm,
          serviceName: meta.serviceName,
          amountMinor: parsed.amountMinor,
          rowRef: `row ${i + 1}, col ${col.colIdx + 1}`,
        });
      }
    }
  }

  const fxToUpsert: UpsertPlan[] = [];
  const needsFxDerivation = [...seenPair.values()].some(
    (seen) =>
      (seen.usdMinor !== undefined && seen.aedMinor === undefined) ||
      (seen.aedMinor !== undefined && seen.usdMinor === undefined),
  );
  let fxRate: string | null = null;
  if (needsFxDerivation || toPending.length > 0) {
    try {
      fxRate = readFxRateString();
    } catch {
      fxRate = null;
    }
  }

  if (!fxRate && needsFxDerivation) {
    errors.push({
      rowIdx: 0,
      countryRaw: "",
      message:
        "FX rate is not configured, but the import requires FX auto-fill (only one currency present for some nationality/service pairs).",
    });
  }

  const normToDisplayName = new Map<string, string>();
  for (const col of header.serviceColumns) {
    const serviceNorm = col.trimmedName.trim().toLowerCase();
    if (!normToDisplayName.has(serviceNorm)) {
      normToDisplayName.set(serviceNorm, col.trimmedName);
    }
  }

  for (const [key, seen] of seenPair) {
    const { natCode, serviceNorm } = splitNatServiceNormKey(key);
    const svcName = normToDisplayName.get(serviceNorm) ?? serviceNorm;

    if (seen.usdMinor !== undefined && seen.aedMinor === undefined) {
      if (!fxRate) continue;
      const aedMinor = fxUsdToAed(seen.usdMinor, fxRate);
      fxToUpsert.push({
        nationalityCode: natCode,
        serviceNorm,
        serviceName: svcName,
        currency: "AED",
        amountMinor: aedMinor,
        source: "fx_derived_aed_from_usd",
      });
    } else if (seen.aedMinor !== undefined && seen.usdMinor === undefined) {
      if (!fxRate) continue;
      const usdMinor = fxAedToUsd(seen.aedMinor, fxRate);
      fxToUpsert.push({
        nationalityCode: natCode,
        serviceNorm,
        serviceName: svcName,
        currency: "USD",
        amountMinor: usdMinor,
        source: "fx_derived_usd_from_aed",
      });
    }
  }

  const mode = options.mode ?? "strict";
  const partialApplied = mode === "partial";

  if (mode === "strict" && errors.length > 0) {
    return {
      batchId,
      committed: false,
      headerRowIndex: headerRowIdx,
      partialApplied: false,
      rowsProcessed,
      skippedRows,
      skippedCells,
      pricesUpserted: 0,
      pricesDeleted: 0,
      pendingCreated: 0,
      eligibilityAdded: 0,
      eligibilityRemoved: 0,
      autoFix: [],
      servicesCreated: [],
      missingNationalities: [],
      errors,
    };
  }

  const normToId = new Map<string, string>();
  const uniqueNorms = [
    ...new Set(header.serviceColumns.map((c) => c.trimmedName.trim().toLowerCase())),
  ];
  for (const norm of uniqueNorms) {
    const displayName = normToDisplayName.get(norm) ?? norm;
    const id = await resolveServiceId(tx, displayName, serviceNameToId, servicesCreated);
    normToId.set(norm, id);
  }

  const fxRateForAudit = fxRate ?? "";
  for (const u of fxToUpsert) {
    const serviceId = normToId.get(u.serviceNorm)!;
    if (u.source === "fx_derived_aed_from_usd") {
      autoFix.push({
        nationalityCode: u.nationalityCode,
        serviceId,
        serviceName: u.serviceName,
        fixedCurrency: "AED",
        derivedFrom: "USD",
        fxRate: fxRateForAudit,
      });
    } else {
      autoFix.push({
        nationalityCode: u.nationalityCode,
        serviceId,
        serviceName: u.serviceName,
        fixedCurrency: "USD",
        derivedFrom: "AED",
        fxRate: fxRateForAudit,
      });
    }
  }

  const resolvePlan = (u: UpsertPlan) => ({
    nationalityCode: u.nationalityCode,
    serviceId: normToId.get(u.serviceNorm)!,
    serviceName: u.serviceName,
    currency: u.currency,
    amountMinor: u.amountMinor,
    source: u.source,
  });

  const toUpsertDb = [...toUpsert, ...fxToUpsert].map(resolvePlan);
  const upsertByTriple = new Map<
    string,
    {
      nationalityCode: string;
      serviceId: string;
      serviceName: string;
      currency: "USD" | "AED";
      amountMinor: bigint;
      source: string;
    }
  >();
  for (const u of toUpsertDb) {
    const tripleKey = `${u.nationalityCode}${IMPORT_PAIR_SEP}${u.serviceId}${IMPORT_PAIR_SEP}${u.currency}`;
    upsertByTriple.set(tripleKey, u);
  }
  const toUpsertUnique = [...upsertByTriple.values()];

  const toDeleteDb = toDelete.map((d) => ({
    nationalityCode: d.nationalityCode,
    serviceId: normToId.get(d.serviceNorm)!,
  }));
  const toPendingDb = toPending.map((p) => ({
    nationalityCode: p.nationalityCode,
    serviceId: normToId.get(p.serviceNorm)!,
    serviceName: p.serviceName,
    amountMinor: p.amountMinor,
    rowRef: p.rowRef,
  }));

  const uniqueDeletePairs: { nationalityCode: string; serviceId: string }[] = [];
  const seenDeletePair = new Set<string>();
  for (const d of toDeleteDb) {
    const k = natSvcIdKey(d.nationalityCode, d.serviceId);
    if (seenDeletePair.has(k)) continue;
    seenDeletePair.add(k);
    uniqueDeletePairs.push({ nationalityCode: d.nationalityCode, serviceId: d.serviceId });
  }

  for (const chunk of chunkArray(uniqueDeletePairs, DELETE_PAIR_CHUNK)) {
    if (chunk.length === 0) continue;
    const tupleIn = sql.join(
      chunk.map((c) => sql`(${c.nationalityCode}, ${c.serviceId})`),
      sql`, `,
    );
    const del = await tx
      .delete(schema.catalogCustomerPrice)
      .where(sql`(nationality_code, service_id) IN (${tupleIn})`)
      .returning({ id: schema.catalogCustomerPrice.id });
    pricesDeleted += del.length;
  }

  for (const chunk of chunkArray(toUpsertUnique, UPSERT_CHUNK)) {
    if (chunk.length === 0) continue;
    await tx
      .insert(schema.catalogCustomerPrice)
      .values(
        chunk.map((u) => ({
          nationalityCode: u.nationalityCode,
          serviceId: u.serviceId,
          currency: u.currency,
          amountMinor: u.amountMinor,
          source: u.source,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: sql`excluded.amount_minor`,
          source: sql`excluded.source`,
          updatedAt: new Date(),
        },
      });
    pricesUpserted += chunk.length;
  }

  for (const chunk of chunkArray(toPendingDb, PENDING_INSERT_CHUNK)) {
    if (chunk.length === 0) continue;
    await tx.insert(schema.catalogCustomerPricePending).values(
      chunk.map((p) => ({
        nationalityCode: p.nationalityCode,
        serviceId: p.serviceId,
        amountMinor: p.amountMinor,
        batchId,
        rowRef: p.rowRef,
      })),
    );
    pendingCreated += chunk.length;
  }

  const touchedPairs = new Set<string>();
  for (const u of toUpsertUnique) touchedPairs.add(natSvcIdKey(u.nationalityCode, u.serviceId));
  for (const d of toDeleteDb) touchedPairs.add(natSvcIdKey(d.nationalityCode, d.serviceId));

  const elig = await syncEligibilityForTouchedPairs(tx, [...touchedPairs]);
  eligibilityAdded = elig.added;
  eligibilityRemoved = elig.removed;

  const result: ApplyImportResult = {
    batchId,
    committed: true,
    headerRowIndex: headerRowIdx,
    partialApplied,
    rowsProcessed,
    skippedRows,
    skippedCells,
    pricesUpserted,
    pricesDeleted,
    pendingCreated,
    eligibilityAdded,
    eligibilityRemoved,
    autoFix,
    servicesCreated,
    missingNationalities: [],
    errors,
  };

  await writeImportAudit(tx, adminUserId, result, options.fileHash);

  return result;
}

// ─── Pending currency wizard ─────────────────────────────────────────────────

export type PendingImportListRow = {
  id: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  amountMinor: string;
  rowRef: string | null;
  batchId: string;
};

/** Paginated pending rows for the currency wizard (read-only). */
export async function listPendingPriceImportPage(
  tx: SchemaDb,
  batchId: string,
  options: { limit: number; offset: number },
): Promise<{ rows: PendingImportListRow[]; total: number }> {
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit)));
  const offset = Math.max(0, Math.floor(options.offset));

  const [countRow] = await tx
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.catalogCustomerPricePending)
    .where(eq(schema.catalogCustomerPricePending.batchId, batchId));

  const total = Number(countRow?.c ?? 0);

  const raw = await tx
    .select({
      id: schema.catalogCustomerPricePending.id,
      nationalityCode: schema.catalogCustomerPricePending.nationalityCode,
      serviceId: schema.catalogCustomerPricePending.serviceId,
      amountMinor: schema.catalogCustomerPricePending.amountMinor,
      rowRef: schema.catalogCustomerPricePending.rowRef,
      batchId: schema.catalogCustomerPricePending.batchId,
      serviceName: schema.visaService.name,
    })
    .from(schema.catalogCustomerPricePending)
    .innerJoin(
      schema.visaService,
      eq(schema.catalogCustomerPricePending.serviceId, schema.visaService.id),
    )
    .where(eq(schema.catalogCustomerPricePending.batchId, batchId))
    .orderBy(asc(schema.catalogCustomerPricePending.id))
    .limit(limit)
    .offset(offset);

  const rows: PendingImportListRow[] = raw.map((r) => ({
    id: r.id,
    nationalityCode: r.nationalityCode,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    amountMinor: r.amountMinor.toString(),
    rowRef: r.rowRef ?? null,
    batchId: r.batchId,
  }));

  return { rows, total };
}

type CatalogPriceUpsertRow = {
  nationalityCode: string;
  serviceId: string;
  currency: "USD" | "AED";
  amountMinor: bigint;
  source: string;
};

function dedupeCatalogPriceUpserts(rows: CatalogPriceUpsertRow[]): CatalogPriceUpsertRow[] {
  const m = new Map<string, CatalogPriceUpsertRow>();
  for (const r of rows) {
    const k = `${r.nationalityCode}${IMPORT_PAIR_SEP}${r.serviceId}${IMPORT_PAIR_SEP}${r.currency}`;
    m.set(k, r);
  }
  return [...m.values()];
}

export type AssignPendingCurrencyInput = {
  currency: "USD" | "AED";
  pendingIds?: string[]; // if empty, assigns to all rows of batchId
  batchId?: string;
};

export type AssignPendingCurrencyResult = {
  promoted: number;
  autoFix: AutoFix[];
  eligibilityAdded: number;
  /** Total rows promoted (same as promoted); present when promoted &gt; 0. */
  autoFixTotal: number;
  /** True when `autoFix` is only a sample of the full set. */
  autoFixTruncated: boolean;
};

export async function assignPendingCurrency(
  tx: SchemaDb,
  input: AssignPendingCurrencyInput,
  adminUserId: string,
): Promise<AssignPendingCurrencyResult> {
  const { currency, pendingIds, batchId } = input;

  const pendingCols = {
    id: schema.catalogCustomerPricePending.id,
    nationalityCode: schema.catalogCustomerPricePending.nationalityCode,
    serviceId: schema.catalogCustomerPricePending.serviceId,
    amountMinor: schema.catalogCustomerPricePending.amountMinor,
    batchId: schema.catalogCustomerPricePending.batchId,
  };

  let pendingRows: {
    id: string;
    nationalityCode: string;
    serviceId: string;
    amountMinor: bigint;
    batchId: string;
  }[] = [];

  if (pendingIds && pendingIds.length > 0) {
    pendingRows = await tx.select(pendingCols).from(schema.catalogCustomerPricePending).where(
      inArray(schema.catalogCustomerPricePending.id, pendingIds),
    );
  } else if (batchId) {
    pendingRows = await tx
      .select(pendingCols)
      .from(schema.catalogCustomerPricePending)
      .where(eq(schema.catalogCustomerPricePending.batchId, batchId));
  }

  if (!pendingRows.length) {
    return {
      promoted: 0,
      autoFix: [],
      eligibilityAdded: 0,
      autoFixTotal: 0,
      autoFixTruncated: false,
    };
  }

  const promoted = pendingRows.length;
  const fxRate = readFxRateString();

  const primarySource = "admin_import";
  const primaryRows: CatalogPriceUpsertRow[] = pendingRows.map((p) => ({
    nationalityCode: p.nationalityCode,
    serviceId: p.serviceId,
    currency,
    amountMinor: p.amountMinor,
    source: primarySource,
  }));

  const siblingCurrency: "USD" | "AED" = currency === "USD" ? "AED" : "USD";
  const siblingSource =
    currency === "USD" ? "fx_derived_aed_from_usd" : "fx_derived_usd_from_aed";
  const siblingRows: CatalogPriceUpsertRow[] = pendingRows.map((p) => {
    const siblingAmountMinor =
      currency === "USD"
        ? fxUsdToAed(p.amountMinor, fxRate)
        : fxAedToUsd(p.amountMinor, fxRate);
    return {
      nationalityCode: p.nationalityCode,
      serviceId: p.serviceId,
      currency: siblingCurrency,
      amountMinor: siblingAmountMinor,
      source: siblingSource,
    };
  });

  const primaryUnique = dedupeCatalogPriceUpserts(primaryRows);
  const siblingUnique = dedupeCatalogPriceUpserts(siblingRows);

  for (const chunk of chunkArray(primaryUnique, ASSIGN_PRICE_UPSERT_CHUNK)) {
    if (chunk.length === 0) continue;
    await tx
      .insert(schema.catalogCustomerPrice)
      .values(
        chunk.map((r) => ({
          nationalityCode: r.nationalityCode,
          serviceId: r.serviceId,
          currency: r.currency,
          amountMinor: r.amountMinor,
          source: r.source,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: sql`excluded.amount_minor`,
          source: sql`excluded.source`,
          updatedAt: new Date(),
        },
      });
  }

  for (const chunk of chunkArray(siblingUnique, ASSIGN_PRICE_UPSERT_CHUNK)) {
    if (chunk.length === 0) continue;
    await tx
      .insert(schema.catalogCustomerPrice)
      .values(
        chunk.map((r) => ({
          nationalityCode: r.nationalityCode,
          serviceId: r.serviceId,
          currency: r.currency,
          amountMinor: r.amountMinor,
          source: r.source,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: sql`excluded.amount_minor`,
          source: sql`excluded.source`,
          updatedAt: new Date(),
        },
      });
  }

  const distinctPairs: { nationalityCode: string; serviceId: string }[] = [
    ...new Map(
      pendingRows.map((p) => [
        natSvcIdKey(p.nationalityCode, p.serviceId),
        { nationalityCode: p.nationalityCode, serviceId: p.serviceId },
      ]),
    ).values(),
  ];
  const eligibilityAdded = await bulkEnsureEligibilityFromCatalogPrices(tx, distinctPairs);

  const fullBatchByBatchId =
    Boolean(batchId) && (!pendingIds || pendingIds.length === 0);
  if (fullBatchByBatchId && batchId) {
    await tx
      .delete(schema.catalogCustomerPricePending)
      .where(eq(schema.catalogCustomerPricePending.batchId, batchId));
  } else {
    const pendingIdsAll = pendingRows.map((p) => p.id);
    for (const chunk of chunkArray(pendingIdsAll, PENDING_DELETE_ID_CHUNK)) {
      if (chunk.length === 0) continue;
      await tx
        .delete(schema.catalogCustomerPricePending)
        .where(inArray(schema.catalogCustomerPricePending.id, chunk));
    }
  }

  const samplePending = pendingRows.slice(0, ASSIGN_PENDING_AUTOFIX_RESPONSE_CAP);
  const sampleServiceIds = [...new Set(samplePending.map((p) => p.serviceId))];
  const svcRows =
    sampleServiceIds.length > 0
      ? await tx
          .select({ id: schema.visaService.id, name: schema.visaService.name })
          .from(schema.visaService)
          .where(inArray(schema.visaService.id, sampleServiceIds))
      : [];
  const serviceIdToName = new Map(svcRows.map((s) => [s.id, s.name]));

  const autoFix: AutoFix[] = samplePending.map((p) => ({
    nationalityCode: p.nationalityCode,
    serviceId: p.serviceId,
    serviceName: serviceIdToName.get(p.serviceId) ?? p.serviceId,
    fixedCurrency: siblingCurrency,
    derivedFrom: currency,
    fxRate,
  }));

  const autoFixTruncated = promoted > ASSIGN_PENDING_AUTOFIX_RESPONSE_CAP;

  await tx.insert(schema.auditLog).values({
    actorType: "admin",
    actorId: adminUserId,
    action: "catalog_customer_price.assign_pending_currency",
    entityType: "catalog_customer_price_pending",
    entityId: batchId ?? pendingIds?.[0] ?? "unknown",
    afterJson: JSON.stringify({
      currency,
      promoted,
      eligibilityAdded,
      autoFixTotal: promoted,
      autoFixTruncated,
      autoFixSample: autoFix,
      fxRate,
    }),
  });

  return {
    promoted,
    autoFix,
    eligibilityAdded,
    autoFixTotal: promoted,
    autoFixTruncated,
  };
}

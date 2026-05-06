/**
 * Transactional logic for applying a parsed price sheet import.
 *
 * Input: parsed grid (from parse-price-sheet + read-xlsx-buffer)
 * Output: apply summary with autoFix list, errors, eligibility changes
 *
 * All writes run inside a withAdminDbActor transaction.
 */

import { eq, and, sql, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  detectHeaderRowIndex,
  parseHeaderRow,
  matchNationality,
  parseMoneyCell,
  normalizeCountryName,
  type RawRow,
} from "./parse-price-sheet";
import { fxUsdToAed, fxAedToUsd, readFxRateString } from "@/lib/pricing/fx-usd-aed";

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

// ─── Eligibility sync ────────────────────────────────────────────────────────

async function syncEligibility(
  tx: SchemaDb,
  nationalityCode: string,
  serviceId: string,
): Promise<{ added: boolean; removed: boolean }> {
  // Count published (non-pending) prices for this pair
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.catalogCustomerPrice)
    .where(
      and(
        eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode),
        eq(schema.catalogCustomerPrice.serviceId, serviceId),
      ),
    );

  const hasPrices = (row?.count ?? 0) > 0;

  if (hasPrices) {
    // Ensure eligibility exists
    const inserted = await tx
      .insert(schema.visaServiceEligibility)
      .values({ serviceId, nationalityCode })
      .onConflictDoNothing()
      .returning({ serviceId: schema.visaServiceEligibility.serviceId });
    return { added: inserted.length > 0, removed: false };
  } else {
    // Remove eligibility
    const deleted = await tx
      .delete(schema.visaServiceEligibility)
      .where(
        and(
          eq(schema.visaServiceEligibility.serviceId, serviceId),
          eq(schema.visaServiceEligibility.nationalityCode, nationalityCode),
        ),
      )
      .returning({ id: schema.visaServiceEligibility.serviceId });
    return { added: false, removed: deleted.length > 0 };
  }
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
      stats: { dataRows: 0, pricedCells: 0, ambiguousCells: 0, emptyCells: 0 },
    };
  }

  const header = parseHeaderRow(rows[headerRowIdx]);
  const nationalityMap = await buildNationalityMap(tx);

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

    if (!natCode) {
      errors.push({
        rowIdx: i + 1,
        countryRaw: String(countryRaw),
        message: `Cannot resolve nationality: "${countryRaw}"`,
      });
    }

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

  function natSvcIdKey(natCode: string, serviceId: string) {
    return `${natCode}${IMPORT_PAIR_SEP}${serviceId}`;
  }

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
      errors.push({
        rowIdx: i + 1,
        countryRaw: String(countryRaw),
        message: `Cannot resolve nationality: "${countryRaw}"`,
      });
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

  const deletedPairs = new Set<string>();
  for (const d of toDeleteDb) {
    const k = natSvcIdKey(d.nationalityCode, d.serviceId);
    if (deletedPairs.has(k)) continue;
    deletedPairs.add(k);
    const del = await tx
      .delete(schema.catalogCustomerPrice)
      .where(
        and(
          eq(schema.catalogCustomerPrice.nationalityCode, d.nationalityCode),
          eq(schema.catalogCustomerPrice.serviceId, d.serviceId),
        ),
      )
      .returning({ id: schema.catalogCustomerPrice.id });
    pricesDeleted += del.length;
  }

  for (const u of toUpsertDb) {
    await tx
      .insert(schema.catalogCustomerPrice)
      .values({
        nationalityCode: u.nationalityCode,
        serviceId: u.serviceId,
        currency: u.currency,
        amountMinor: u.amountMinor,
        source: u.source,
      })
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: u.amountMinor,
          source: u.source,
          updatedAt: new Date(),
        },
      });
    pricesUpserted++;
  }

  for (const p of toPendingDb) {
    await tx.insert(schema.catalogCustomerPricePending).values({
      nationalityCode: p.nationalityCode,
      serviceId: p.serviceId,
      amountMinor: p.amountMinor,
      batchId,
      rowRef: p.rowRef,
    });
    pendingCreated++;
  }

  const touchedPairs = new Set<string>();
  for (const u of toUpsertDb) touchedPairs.add(natSvcIdKey(u.nationalityCode, u.serviceId));
  for (const d of toDeleteDb) touchedPairs.add(natSvcIdKey(d.nationalityCode, d.serviceId));

  for (const key of touchedPairs) {
    const { natCode, serviceNorm: serviceId } = splitNatServiceNormKey(key);
    const { added, removed } = await syncEligibility(tx, natCode, serviceId);
    if (added) eligibilityAdded++;
    if (removed) eligibilityRemoved++;
  }

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
    errors,
  };

  await writeImportAudit(tx, adminUserId, result, options.fileHash);

  return result;
}

// ─── Pending currency wizard ─────────────────────────────────────────────────

export type AssignPendingCurrencyInput = {
  currency: "USD" | "AED";
  pendingIds?: string[]; // if empty, assigns to all rows of batchId
  batchId?: string;
};

export async function assignPendingCurrency(
  tx: SchemaDb,
  input: AssignPendingCurrencyInput,
  adminUserId: string,
): Promise<{
  promoted: number;
  autoFix: AutoFix[];
  eligibilityAdded: number;
}> {
  const { currency, pendingIds, batchId } = input;

  let pendingRows: {
    id: string;
    nationalityCode: string;
    serviceId: string;
    amountMinor: bigint;
    batchId: string;
  }[] = [];

  if (pendingIds && pendingIds.length > 0) {
    // Load specific rows
    pendingRows = await tx
      .select()
      .from(schema.catalogCustomerPricePending)
      .where(inArray(schema.catalogCustomerPricePending.id, pendingIds));
  } else if (batchId) {
    pendingRows = await tx
      .select()
      .from(schema.catalogCustomerPricePending)
      .where(eq(schema.catalogCustomerPricePending.batchId, batchId));
  }

  if (!pendingRows.length) {
    return { promoted: 0, autoFix: [], eligibilityAdded: 0 };
  }

  const serviceIds = [...new Set(pendingRows.map((p) => p.serviceId))];
  const svcRows =
    serviceIds.length > 0
      ? await tx
          .select({ id: schema.visaService.id, name: schema.visaService.name })
          .from(schema.visaService)
          .where(inArray(schema.visaService.id, serviceIds))
      : [];
  const serviceIdToName = new Map(svcRows.map((s) => [s.id, s.name]));

  const fxRate = readFxRateString();
  const autoFix: AutoFix[] = [];
  let promoted = 0;
  let eligibilityAdded = 0;

  for (const pending of pendingRows) {
    const primaryAmountMinor = pending.amountMinor;
    const primarySource = "admin_import";

    // Upsert primary currency
    await tx
      .insert(schema.catalogCustomerPrice)
      .values({
        nationalityCode: pending.nationalityCode,
        serviceId: pending.serviceId,
        currency,
        amountMinor: primaryAmountMinor,
        source: primarySource,
      })
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: primaryAmountMinor,
          source: primarySource,
          updatedAt: new Date(),
        },
      });

    // Materialise sibling currency
    const siblingCurrency: "USD" | "AED" = currency === "USD" ? "AED" : "USD";
    const siblingSource =
      currency === "USD" ? "fx_derived_aed_from_usd" : "fx_derived_usd_from_aed";
    const siblingAmountMinor =
      currency === "USD"
        ? fxUsdToAed(primaryAmountMinor, fxRate)
        : fxAedToUsd(primaryAmountMinor, fxRate);

    await tx
      .insert(schema.catalogCustomerPrice)
      .values({
        nationalityCode: pending.nationalityCode,
        serviceId: pending.serviceId,
        currency: siblingCurrency,
        amountMinor: siblingAmountMinor,
        source: siblingSource,
      })
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: siblingAmountMinor,
          source: siblingSource,
          updatedAt: new Date(),
        },
      });

    autoFix.push({
      nationalityCode: pending.nationalityCode,
      serviceId: pending.serviceId,
      serviceName: serviceIdToName.get(pending.serviceId) ?? pending.serviceId,
      fixedCurrency: siblingCurrency,
      derivedFrom: currency,
      fxRate,
    });

    // Sync eligibility
    const { added } = await syncEligibility(
      tx,
      pending.nationalityCode,
      pending.serviceId,
    );
    if (added) eligibilityAdded++;

    // Delete the pending row
    await tx
      .delete(schema.catalogCustomerPricePending)
      .where(eq(schema.catalogCustomerPricePending.id, pending.id));

    promoted++;
  }

  // Audit
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
      autoFix,
    }),
  });

  return { promoted, autoFix, eligibilityAdded };
}

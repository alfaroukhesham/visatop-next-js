/**
 * Extract pipeline orchestration helpers (spec §6, §9.4, §10.2, §10.2.1).
 *
 * These helpers are split out from the route handler so they can be unit-
 * tested without Next.js request plumbing. They must always run inside an
 * actor-scoped transaction (`withClientDbActor` / `withSystemDbActor`).
 */
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  applicationDocumentExtraction,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  EXTRACTION_ATTEMPT_STATUS,
  EXTRACTION_STATUS,
  type ExtractionStatus,
} from "@/lib/db/schema";
import type { ExtractPassportResult, OcrAttemptOutcome } from "./gemini-passport";
import type { OcrResult } from "./schema";

/** Lease window for an in-flight extraction (spec §10.2.1). */
export const EXTRACTION_LEASE_MS = 30_000;

export type LeaseAcquisition =
  | {
      acquired: true;
      runId: number;
      documentId: string;
      documentSha256: string;
      documentContentType: string;
      documentBytes: Buffer;
      applicantProfile: ApplicantProfileSnapshot;
      provenance: ApplicantProfileProvenance;
      paymentStatus: string | null;
      checkoutState: string | null;
    }
  | { acquired: false; reason: "ALREADY_RUNNING" | "NO_PASSPORT_DOCUMENT" };

/** Columns the orchestrator reads on `application` when loading an app. */
export type ApplicantProfileSnapshot = {
  fullName: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  applicantNationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  profession: string | null;
  address: string | null;
};

export type ProvenanceSource = "ocr" | "manual";

export type ApplicantProfileProvenance = Partial<
  Record<keyof ApplicantProfileSnapshot, { source: ProvenanceSource }>
>;

const LEASE_ACQUIRABLE_STATES = [
  EXTRACTION_STATUS.NOT_STARTED,
  EXTRACTION_STATUS.NEEDS_MANUAL,
  EXTRACTION_STATUS.FAILED,
  EXTRACTION_STATUS.BLOCKED_INVALID_DOC,
];

/**
 * Atomically transition to `running` (spec §10.2.1). Succeeds if the app is in
 * a terminal state OR its prior lease has expired. Returns the bumped `runId`
 * and the latest passport-copy bytes so the caller can feed OCR without a
 * second round-trip. Returns `{ acquired: false, reason }` for:
 *
 * - `ALREADY_RUNNING` — another active lease.
 * - `NO_PASSPORT_DOCUMENT` — no non-deleted passport_copy exists.
 */
export async function acquireExtractionLease(
  tx: DbTransaction,
  applicationId: string,
  now: Date,
): Promise<LeaseAcquisition> {
  const leaseExpiresAt = new Date(now.getTime() + EXTRACTION_LEASE_MS);

  const updated = await tx
    .update(application)
    .set({
      passportExtractionStatus: EXTRACTION_STATUS.RUNNING,
      passportExtractionStartedAt: now,
      passportExtractionLeaseExpiresAt: leaseExpiresAt,
      passportExtractionRunId: sql<number>`${application.passportExtractionRunId} + 1`,
      passportExtractionUpdatedAt: now,
    })
    .where(
      and(
        eq(application.id, applicationId),
        or(
          inArray(application.passportExtractionStatus, LEASE_ACQUIRABLE_STATES),
          and(
            eq(application.passportExtractionStatus, EXTRACTION_STATUS.RUNNING),
            lt(application.passportExtractionLeaseExpiresAt, now),
          ),
        ),
      ),
    )
    .returning({
      runId: application.passportExtractionRunId,
      paymentStatus: application.paymentStatus,
      checkoutState: application.checkoutState,
      fullName: application.fullName,
      dateOfBirth: application.dateOfBirth,
      placeOfBirth: application.placeOfBirth,
      applicantNationality: application.applicantNationality,
      passportNumber: application.passportNumber,
      passportExpiryDate: application.passportExpiryDate,
      profession: application.profession,
      address: application.address,
      applicantProfileProvenanceJson: application.applicantProfileProvenanceJson,
    });

  if (updated.length === 0) {
    return { acquired: false, reason: "ALREADY_RUNNING" };
  }
  const row = updated[0];

  const docRows = await tx
    .select({
      id: applicationDocument.id,
      sha256: applicationDocument.sha256,
      contentType: applicationDocument.contentType,
      bytes: applicationDocumentBlob.bytes,
    })
    .from(applicationDocument)
    .leftJoin(
      applicationDocumentBlob,
      eq(applicationDocumentBlob.documentId, applicationDocument.id),
    )
    .where(
      and(
        eq(applicationDocument.applicationId, applicationId),
        eq(applicationDocument.documentType, DOCUMENT_TYPE.PASSPORT_COPY),
        eq(applicationDocument.status, DOCUMENT_STATUS.UPLOADED_TEMP),
      ),
    )
    .orderBy(sql`${applicationDocument.createdAt} DESC`)
    .limit(1);
  const doc = docRows[0];
  if (!doc || !doc.bytes || !doc.sha256 || !doc.contentType) {
    // Roll back the lease we just took so the next request can acquire.
    await tx
      .update(application)
      .set({
        passportExtractionStatus: EXTRACTION_STATUS.NOT_STARTED,
        passportExtractionStartedAt: null,
        passportExtractionLeaseExpiresAt: null,
        passportExtractionUpdatedAt: now,
      })
      .where(
        and(
          eq(application.id, applicationId),
          eq(application.passportExtractionRunId, row.runId),
        ),
      );
    return { acquired: false, reason: "NO_PASSPORT_DOCUMENT" };
  }

  return {
    acquired: true,
    runId: row.runId,
    documentId: doc.id,
    documentSha256: doc.sha256,
    documentContentType: doc.contentType,
    documentBytes: Buffer.isBuffer(doc.bytes) ? doc.bytes : Buffer.from(doc.bytes),
    applicantProfile: {
      fullName: row.fullName ?? null,
      // Drizzle `date(..., { mode: "string" })` returns ISO-formatted strings;
      // normalize anyway in case a raw Date slips in via a future mode change.
      dateOfBirth: normalizeSqlDate(row.dateOfBirth),
      placeOfBirth: row.placeOfBirth ?? null,
      applicantNationality: row.applicantNationality ?? null,
      passportNumber: row.passportNumber ?? null,
      passportExpiryDate: normalizeSqlDate(row.passportExpiryDate),
      profession: row.profession ?? null,
      address: row.address ?? null,
    },
    provenance:
      normalizeProvenance(row.applicantProfileProvenanceJson as unknown),
    paymentStatus: row.paymentStatus ?? null,
    checkoutState: row.checkoutState ?? null,
  };
}

/**
 * Write a per-attempt row to `application_document_extraction`. One call per
 * OCR attempt; idempotency is provided by the `(documentId, attempt)` pair
 * which is indexed and (de-facto) unique per extraction run.
 */
export async function persistExtractionAttempt(
  tx: DbTransaction,
  args: {
    documentId: string;
    provider: ExtractPassportResult["provider"];
    model: string;
    promptVersion: number;
    attempt: OcrAttemptOutcome;
    validationJson: unknown;
    now: Date;
  },
): Promise<void> {
  const status =
    args.attempt.status === "succeeded"
      ? EXTRACTION_ATTEMPT_STATUS.SUCCEEDED
      : EXTRACTION_ATTEMPT_STATUS.FAILED;

  await tx.insert(applicationDocumentExtraction).values({
    documentId: args.documentId,
    attempt: args.attempt.attempt,
    status,
    provider: args.provider,
    model: args.model,
    promptVersion: args.promptVersion,
    latencyMs: args.attempt.latencyMs,
    usage: (args.attempt.usage ?? null) as never,
    resultJson: (args.attempt.result ?? null) as never,
    validationJson: args.validationJson as never,
    errorCode: args.attempt.errorCode,
    errorMessage: args.attempt.errorMessage,
    finishedAt: args.now,
  });
}

export type ProfileUpdateDelta = {
  updates: Partial<{
    fullName: string;
    dateOfBirth: string;
    placeOfBirth: string;
    applicantNationality: string;
    passportNumber: string;
    passportExpiryDate: string;
    profession: string;
    address: string;
  }>;
  provenance: ApplicantProfileProvenance;
};

/**
 * Apply OCR → profile with manual-precedence rules (spec §6.4). Fields marked
 * `source = 'manual'` are never overwritten. Null/empty OCR values are
 * ignored. Returns only the mutations that should be applied, plus the new
 * merged provenance JSON. Pure helper — no DB access.
 */
export function mergeOcrIntoProfile(
  current: ApplicantProfileSnapshot,
  currentProvenance: ApplicantProfileProvenance,
  ocr: OcrResult | null,
): ProfileUpdateDelta {
  const updates: ProfileUpdateDelta["updates"] = {};
  const provenance: ApplicantProfileProvenance = { ...currentProvenance };
  if (!ocr) return { updates, provenance };

  const ocrToColumn: Record<string, keyof ApplicantProfileSnapshot> = {
    fullName: "fullName",
    dateOfBirth: "dateOfBirth",
    placeOfBirth: "placeOfBirth",
    nationality: "applicantNationality",
    passportNumber: "passportNumber",
    passportExpiryDate: "passportExpiryDate",
    profession: "profession",
    address: "address",
  };

  for (const [ocrKey, col] of Object.entries(ocrToColumn)) {
    const value = (ocr as unknown as Record<string, unknown>)[ocrKey];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;

    const existingProv = currentProvenance[col];
    if (existingProv?.source === "manual") continue;

    const currentValue = current[col];
    if (currentValue === trimmed) {
      provenance[col] = { source: "ocr" };
      continue;
    }

    updates[col as keyof ProfileUpdateDelta["updates"]] = trimmed;
    provenance[col] = { source: "ocr" };
  }

  return { updates, provenance };
}

/**
 * Apply the terminal outcome of an extraction run atomically. Writes only
 * when `passport_extraction_run_id` still matches the lease `runId` (spec
 * §10.2.1). Returns `false` when the row has moved on (stale lease) so the
 * route can respond with `409 STALE_EXTRACTION_LEASE`.
 */
export async function finalizeExtraction(
  tx: DbTransaction,
  args: {
    applicationId: string;
    runId: number;
    documentId: string;
    documentSha256: string;
    terminalStatus: ExtractionStatus;
    profileDelta: ProfileUpdateDelta;
    now: Date;
  },
): Promise<boolean> {
  const rows = await tx
    .update(application)
    .set({
      passportExtractionStatus: args.terminalStatus,
      passportExtractionStartedAt: null,
      passportExtractionLeaseExpiresAt: null,
      passportExtractionUpdatedAt: args.now,
      passportExtractionDocumentId: args.documentId,
      passportExtractionSha256: args.documentSha256,
      applicantProfileProvenanceJson: args.profileDelta.provenance as never,
      ...args.profileDelta.updates,
    })
    .where(
      and(
        eq(application.id, args.applicationId),
        eq(application.passportExtractionRunId, args.runId),
      ),
    )
    .returning({ id: application.id });
  return rows.length > 0;
}

function normalizeProvenance(v: unknown): ApplicantProfileProvenance {
  if (!v || typeof v !== "object") return {};
  const out: ApplicantProfileProvenance = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const source = (raw as { source?: unknown }).source;
    if (source === "ocr" || source === "manual") {
      out[k as keyof ApplicantProfileSnapshot] = { source };
    }
  }
  return out;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalize whatever `date` column value Drizzle hands us into a nullable ISO
 * string (`YYYY-MM-DD`). In string mode the driver returns strings already;
 * the Date branch guards against future mode toggles.
 */
function normalizeSqlDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return toIsoDate(value);
  return null;
}

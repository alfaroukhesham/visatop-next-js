/**
 * POST /api/applications/[id]/extract — synchronous passport OCR pipeline.
 *
 * Flow (spec §6, §10.2, §10.2.1):
 *   1. Resolve access (session or vt_resume cookie).
 *   2. Rate limit guests on the EXTRACT bucket.
 *   3. Acquire a 30s lease + bump runId atomically; also load the latest
 *      passport_copy blob in the same txn to avoid a second round-trip.
 *   4. Run the Gemini adapter (up to 2 attempts, 25s budget) OUTSIDE the DB
 *      transaction — OCR I/O must not hold a Postgres session.
 *   5. Reopen a txn to persist attempt rows, merge OCR into the profile under
 *      spec §6.4 provenance rules, and finalize the extraction status with a
 *      conditional update guarded by the captured runId. Mismatch → 409
 *      STALE_EXTRACTION_LEASE and we discard all writes.
 *   6. Compute `validation` (spec §6.5) against the post-merge profile +
 *      upload presence, and return the enveloped extraction payload.
 */
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { extractClientIp } from "@/lib/applications/client-ip";
import { consume } from "@/lib/applications/document-rate-limit";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import {
  application,
  applicationDocument,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  EXTRACTION_STATUS,
  type ExtractionStatus,
} from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db";
import {
  computeValidation,
  type ApplicantProfile,
  type ValidationResult,
} from "@/lib/documents/validation-readiness";
import { extractPassport, type ExtractPassportResult } from "@/lib/ocr/gemini-passport";
import { GeminiNotConfiguredError } from "@/lib/gemini/client";
import type { OcrResult } from "@/lib/ocr/schema";
import {
  acquireExtractionLease,
  finalizeExtraction,
  mergeOcrIntoProfile,
  persistExtractionAttempt,
  type ApplicantProfileSnapshot,
} from "@/lib/ocr/extract-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExtractResponsePayload = {
  extraction: {
    status: ExtractionStatus;
    attemptsUsed: number;
    documentId: string;
    prefill: OcrPrefill;
    ocrMissingFields: string[];
    submissionMissingFields: string[];
    validation: ValidationResult;
  };
};

type OcrPrefill = {
  fullName: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  profession: string | null;
  address: string | null;
};

function snapshotToPrefill(s: ApplicantProfileSnapshot, ocr: OcrResult | null): OcrPrefill {
  return {
    fullName: s.fullName,
    dateOfBirth: s.dateOfBirth,
    placeOfBirth: s.placeOfBirth,
    nationality: s.applicantNationality ?? ocr?.nationality ?? null,
    passportNumber: s.passportNumber,
    passportExpiryDate: s.passportExpiryDate,
    profession: s.profession,
    address: s.address,
  };
}

function mergeIntoSnapshot(
  current: ApplicantProfileSnapshot,
  updates: Partial<ApplicantProfileSnapshot>,
): ApplicantProfileSnapshot {
  return { ...current, ...updates };
}

function snapshotToValidationProfile(
  s: ApplicantProfileSnapshot,
  extra: { email: string | null; phone: string | null },
): ApplicantProfile {
  return {
    email: extra.email,
    phone: extra.phone,
    fullName: s.fullName,
    dateOfBirth: s.dateOfBirth,
    placeOfBirth: s.placeOfBirth,
    nationality: s.applicantNationality,
    passportNumber: s.passportNumber,
    passportExpiryDate: s.passportExpiryDate,
    profession: s.profession,
    address: s.address,
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

  const access = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!access.ok) {
    if (access.failure.kind === "not_found") {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }

  if (access.access.kind === "guest") {
    const ip = extractClientIp(hdrs);
    const decision = consume("EXTRACT", { ip, applicationId });
    if (!decision.ok) {
      return jsonError("RATE_LIMITED", "Too many extract requests.", {
        status: 429,
        requestId,
        headers: {
          "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)),
        },
      });
    }
  }

  const now = new Date();
  const runLease = async (tx: DbTransaction) => acquireExtractionLease(tx, applicationId, now);
  const lease =
    access.access.kind === "user"
      ? await withClientDbActor(access.access.userId, runLease)
      : await withSystemDbActor(runLease);

  if (!lease.acquired) {
    if (lease.reason === "NO_PASSPORT_DOCUMENT") {
      return jsonError(
        "NO_PASSPORT_DOCUMENT",
        "Upload a passport copy before extraction.",
        { status: 404, requestId },
      );
    }
    return jsonError(
      "EXTRACTION_ALREADY_RUNNING",
      "Extraction is already in progress. Please wait and retry.",
      { status: 409, requestId },
    );
  }

  // Run OCR OUTSIDE the DB transaction.
  let ocrResult: ExtractPassportResult;
  try {
    ocrResult = await extractPassport({
      imageBytes: lease.documentBytes,
      contentType: lease.documentContentType,
    });
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      // Treat as provider error; clear lease so retries can proceed.
      ocrResult = {
        status: "failed",
        attempts: [],
        finalResult: null,
        missingFields: [],
        provider: "gemini",
        model: "",
        promptVersion: 0,
      };
    } else {
      throw err;
    }
  }

  // Commit: persist attempts, merge into profile, finalize under runId guard.
  const finishedAt = new Date();
  const delta = mergeOcrIntoProfile(
    lease.applicantProfile,
    lease.provenance,
    ocrResult.finalResult,
  );

  const mergedSnapshot = mergeIntoSnapshot(lease.applicantProfile, delta.updates);

  const commitFn = async (
    tx: DbTransaction,
  ): Promise<
    | { ok: true; staleLease: false; uploads: { passport: boolean; photo: boolean }; email: string | null; phone: string | null }
    | { ok: false; staleLease: true }
  > => {
    const uploads = await tx
      .select({
        id: applicationDocument.id,
        documentType: applicationDocument.documentType,
      })
      .from(applicationDocument)
      .where(
        and(
          eq(applicationDocument.applicationId, applicationId),
          eq(applicationDocument.status, DOCUMENT_STATUS.UPLOADED_TEMP),
        ),
      );

    const hasPassport = uploads.some((u) => u.documentType === DOCUMENT_TYPE.PASSPORT_COPY);
    const hasPhoto = uploads.some((u) => u.documentType === DOCUMENT_TYPE.PERSONAL_PHOTO);

    const contactRows = await tx
      .select({
        guestEmail: application.guestEmail,
        phone: application.phone,
        runId: application.passportExtractionRunId,
      })
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    const contact = contactRows[0];

    if (!contact || contact.runId !== lease.runId) {
      return { ok: false, staleLease: true };
    }

    for (const attempt of ocrResult.attempts) {
      await persistExtractionAttempt(tx, {
        documentId: lease.documentId,
        provider: ocrResult.provider,
        model: ocrResult.model,
        promptVersion: ocrResult.promptVersion,
        attempt,
        validationJson: null,
        now: finishedAt,
      });
    }

    const terminalStatus: ExtractionStatus =
      ocrResult.status === "succeeded"
        ? EXTRACTION_STATUS.SUCCEEDED
        : ocrResult.status === "needs_manual"
          ? EXTRACTION_STATUS.NEEDS_MANUAL
          : EXTRACTION_STATUS.FAILED;

    const committed = await finalizeExtraction(tx, {
      applicationId,
      runId: lease.runId,
      documentId: lease.documentId,
      documentSha256: lease.documentSha256,
      terminalStatus,
      profileDelta: delta,
      now: finishedAt,
    });
    if (!committed) return { ok: false, staleLease: true };

    return {
      ok: true,
      staleLease: false,
      uploads: { passport: hasPassport, photo: hasPhoto },
      email: contact.guestEmail ?? null,
      phone: contact.phone ?? null,
    };
  };

  const commit =
    access.access.kind === "user"
      ? await withClientDbActor(access.access.userId, commitFn)
      : await withSystemDbActor(commitFn);

  if (!commit.ok) {
    return jsonError(
      "STALE_EXTRACTION_LEASE",
      "Extraction was invalidated by a newer upload. Retry.",
      { status: 409, requestId },
    );
  }

  const validation = computeValidation({
    profile: snapshotToValidationProfile(mergedSnapshot, {
      email: commit.email,
      phone: commit.phone,
    }),
    uploads: {
      passportCopyPresent: commit.uploads.passport,
      personalPhotoPresent: commit.uploads.photo,
    },
    now: finishedAt,
  });

  const terminalStatus: ExtractionStatus =
    ocrResult.status === "succeeded"
      ? EXTRACTION_STATUS.SUCCEEDED
      : ocrResult.status === "needs_manual"
        ? EXTRACTION_STATUS.NEEDS_MANUAL
        : EXTRACTION_STATUS.FAILED;

  // Server-side diagnostic breadcrumb; do not log OCR JSON or bytes.
  console.info("[extract] finished", {
    requestId,
    applicationId,
    documentId: lease.documentId,
    status: terminalStatus,
    provider: ocrResult.provider,
    model: ocrResult.model,
    promptVersion: ocrResult.promptVersion,
    attempts: ocrResult.attempts.map((a) => ({
      attempt: a.attempt,
      status: a.status,
      errorCode: a.errorCode,
      errorMessage: a.errorMessage,
      missingFields: a.missingFields,
      latencyMs: a.latencyMs,
    })),
  });

  const payload: ExtractResponsePayload = {
    extraction: {
      status: terminalStatus,
      attemptsUsed: ocrResult.attempts.length,
      documentId: lease.documentId,
      prefill: snapshotToPrefill(mergedSnapshot, ocrResult.finalResult),
      ocrMissingFields: ocrResult.missingFields.slice(),
      submissionMissingFields: validation.requiredFieldsMissing.slice(),
      validation,
    },
  };

  return jsonOk(payload, { requestId });
}

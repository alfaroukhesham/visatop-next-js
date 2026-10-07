import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/applications/evaluate-readiness", () => ({
  evaluateApplicationReadiness: vi.fn(async () => undefined),
}));

vi.mock("@/lib/analytics/record-funnel-event", () => ({
  recordFunnelEvent: vi.fn(async () => ({ stored: true, reason: "stored" })),
}));

import { DOCUMENT_STATUS } from "@/lib/db/schema";
import { persistUploadedDocument } from "./document-upload";
import { evaluateApplicationReadiness } from "@/lib/applications/evaluate-readiness";
import { recordFunnelEvent } from "@/lib/analytics/record-funnel-event";

const appRow = {
  id: "app-1",
  draftExpiresAt: null,
  paymentStatus: "unpaid",
  checkoutState: "none",
  passportExtractionRunId: 0,
  applicantProfileProvenanceJson: {},
};

const priorDoc = {
  id: "doc-old",
  applicationId: "app-1",
  documentType: "passport_copy",
  status: DOCUMENT_STATUS.UPLOADED_TEMP,
  sha256: "sha-a",
  contentType: "image/jpeg",
  byteLength: 12,
  originalFilename: "a.jpg",
  createdAt: new Date("2026-09-21T00:00:00Z"),
};

const newDoc = {
  ...priorDoc,
  id: "doc-new",
  sha256: "sha-b",
  originalFilename: "b.jpg",
};

const inputB = {
  applicationId: "app-1",
  documentType: "passport_copy" as const,
  sha256: "sha-b",
  contentType: "image/jpeg",
  byteLength: 10,
  bytes: Buffer.from("bbbb"),
  originalFilename: "b.jpg",
};

const makeTx = (opts: {
  prior?: typeof priorDoc | null;
  updateReturning?: Array<{ id: string; status: string }>;
}) => {
  const prior = opts.prior === undefined ? priorDoc : opts.prior;
  const updateReturning = opts.updateReturning ?? [
    { id: priorDoc.id, status: DOCUMENT_STATUS.DELETED },
  ];

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [appRow]),
          orderBy: vi.fn(async () => (prior ? [prior] : [])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => updateReturning),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(undefined)),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [newDoc]),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(undefined)),
      })),
    })),
  };
  return tx;
};

describe("persistUploadedDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if marking the prior document deleted returns no row", async () => {
    const tx = makeTx({ updateReturning: [] });
    await expect(persistUploadedDocument(tx as never, inputB)).rejects.toThrow(
      /failed to mark prior document deleted/i,
    );
  });

  it("replaces a different sha and records the new document", async () => {
    const tx = makeTx({});
    const result = await persistUploadedDocument(tx as never, inputB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replacedPriorId).toBe("doc-old");
    expect(result.document.id).toBe("doc-new");
    expect(result.wasIdempotent).toBe(false);
    expect(evaluateApplicationReadiness).toHaveBeenCalled();
    expect(recordFunnelEvent).toHaveBeenCalled();
  });

  it("is idempotent when the active document already has the same sha", async () => {
    const tx = makeTx({ prior: { ...priorDoc, sha256: "sha-b" } });
    const result = await persistUploadedDocument(tx as never, inputB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wasIdempotent).toBe(true);
    expect(result.replacedPriorId).toBeNull();
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";

import {
  applicationDocument,
  applicationDocumentBlob,
} from "@/lib/db/schema";

import { retainRequiredDocuments } from "./retain-required-documents";

type SelectRow = { id: string; status: string; hasBytes: string | null };

function makeTx(rowsInCallOrder: (SelectRow | null)[]) {
  let selectCall = 0;
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  const tx = {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => {
                const row = rowsInCallOrder[selectCall] ?? null;
                selectCall += 1;
                return row ? [row] : [];
              },
            }),
          }),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }),
  } as unknown as Parameters<typeof retainRequiredDocuments>[0];

  return { tx, updates };
}

describe("retainRequiredDocuments", () => {
  it("returns MISSING_REQUIRED_DOCUMENT when no passport exists", async () => {
    const { tx, updates } = makeTx([null, null]);
    const result = await retainRequiredDocuments(tx, "app-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("MISSING_REQUIRED_DOCUMENT");
      expect(result.missing).toEqual(["passport_copy", "personal_photo"]);
    }
    expect(updates).toHaveLength(0);
  });

  it("returns BLOB_BYTES_MISSING when latest row has no blob bytes", async () => {
    const { tx, updates } = makeTx([
      { id: "d1", status: "uploaded_temp", hasBytes: null },
      { id: "d2", status: "uploaded_temp", hasBytes: "d2" },
    ]);
    const result = await retainRequiredDocuments(tx, "app-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("BLOB_BYTES_MISSING");
      expect(result.missing).toEqual(["passport_copy"]);
    }
    expect(updates).toHaveLength(0);
  });

  it("treats a retained latest row as MISSING (invariant violation)", async () => {
    const { tx, updates } = makeTx([
      { id: "d1", status: "retained", hasBytes: "d1" },
      { id: "d2", status: "uploaded_temp", hasBytes: "d2" },
    ]);
    const result = await retainRequiredDocuments(tx, "app-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("MISSING_REQUIRED_DOCUMENT");
      expect(result.missing).toEqual(["passport_copy"]);
    }
    expect(updates).toHaveLength(0);
  });

  it("flips status + sets retainedAt + clears tempExpiresAt for both required docs", async () => {
    const { tx, updates } = makeTx([
      { id: "d1", status: "uploaded_temp", hasBytes: "d1" },
      { id: "d2", status: "uploaded_temp", hasBytes: "d2" },
    ]);
    const now = new Date("2026-05-01T00:00:00.000Z");
    const result = await retainRequiredDocuments(tx, "app-1", now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.retainedDocumentIds).toEqual(["d1", "d2"]);
      expect(result.retainedAt).toBe(now);
    }
    // Expect: update documentStatus, update blobRetention — for each of 2 docs.
    const docUpdates = updates.filter((u) => u.table === applicationDocument);
    const blobUpdates = updates.filter((u) => u.table === applicationDocumentBlob);
    expect(docUpdates).toHaveLength(2);
    expect(blobUpdates).toHaveLength(2);
    for (const u of docUpdates) {
      expect(u.values.status).toBe("retained");
    }
    for (const u of blobUpdates) {
      expect(u.values.retainedAt).toBe(now);
      expect(u.values.tempExpiresAt).toBeNull();
    }
  });
});

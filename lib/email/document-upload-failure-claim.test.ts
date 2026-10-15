import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));

import {
  tryClaimDocumentUploadFailure,
  tryClaimDocumentUploadResolved,
} from "./document-upload-failure-claim";
import { uploadFailureGroup } from "./upload-failure-group";

describe("uploadFailureGroup", () => {
  it("maps 403 to session_auth and 415 to file_type", () => {
    expect(uploadFailureGroup({ errorCode: "FORBIDDEN", httpStatus: 403 })).toBe("session_auth");
    expect(uploadFailureGroup({ errorCode: "UNSUPPORTED_TYPE", httpStatus: 415 })).toBe("file_type");
  });
});

describe("tryClaimDocumentUploadFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the inserted row on first claim", async () => {
    const row = { id: "n1", applicationId: "app-1" };
    tx.insert.mockReturnValue({
      values: () => ({
        returning: async () => [row],
      }),
    });
    const claimed = await tryClaimDocumentUploadFailure({
      applicationId: "app-1",
      documentType: "passport_copy",
      failureGroup: "session_auth",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      applicantNotified: true,
      locale: "en",
    });
    expect(claimed).toEqual(row);
  });

  it("returns null on unique violation (retry of the same failure)", async () => {
    tx.insert.mockReturnValue({
      values: () => ({
        returning: async () => {
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        },
      }),
    });
    const claimed = await tryClaimDocumentUploadFailure({
      applicationId: "app-1",
      documentType: "passport_copy",
      failureGroup: "session_auth",
      errorCode: "FORBIDDEN",
      httpStatus: 403,
      applicantNotified: true,
      locale: "en",
    });
    expect(claimed).toBeNull();
  });
});

describe("tryClaimDocumentUploadResolved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns claimed rows and none on a second success", async () => {
    const resolved = [{ id: "n1", resolvedAt: new Date() }];
    tx.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: async () => resolved,
        }),
      }),
    });
    expect(await tryClaimDocumentUploadResolved("app-1", "passport_copy")).toEqual(resolved);

    tx.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: async () => [],
        }),
      }),
    });
    expect(await tryClaimDocumentUploadResolved("app-1", "passport_copy")).toEqual([]);
  });
});

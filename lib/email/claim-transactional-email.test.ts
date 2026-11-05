import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  insert: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));

import {
  releaseTransactionalEmailClaim,
  tryClaimTransactionalEmail,
} from "./claim-transactional-email";

describe("tryClaimTransactionalEmail / releaseTransactionalEmailClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the insert wins the unique row", async () => {
    tx.insert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [{ id: "row-1" }],
        }),
      }),
    });
    expect(await tryClaimTransactionalEmail("app-1", "recovery_checkout")).toBe(true);
  });

  it("deletes the claim row for that application and kind", async () => {
    tx.delete.mockReturnValue({
      where: async () => undefined,
    });
    await releaseTransactionalEmailClaim("app-1", "recovery_checkout");
    expect(tx.delete).toHaveBeenCalledTimes(1);
  });
});

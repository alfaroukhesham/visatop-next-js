import { describe, expect, it, vi } from "vitest";
import { LinkEligibilityValidationError, linkEligibilityPairs } from "./link-eligibility-pairs";
import * as schema from "@/lib/db/schema";

const makeTx = (opts?: {
  services?: string[];
  nationalities?: string[];
  inserted?: Array<{ serviceId: string; nationalityCode: string } | undefined>;
}) => {
  const services = opts?.services ?? ["s1"];
  const nationalities = opts?.nationalities ?? ["IN", "US"];
  const inserted = opts?.inserted ?? [
    { serviceId: "s1", nationalityCode: "IN" },
    undefined,
  ];
  let i = 0;
  const tx = {
    select: vi.fn((cols: unknown) => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === schema.visaService) {
            return Promise.resolve(services.map((id) => ({ id })));
          }
          return Promise.resolve(nationalities.map((code) => ({ code })));
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => {
            const row = inserted[i];
            i += 1;
            return row ? [row] : [];
          }),
        })),
      })),
    })),
  };
  return { tx, inserted };
};

describe("linkEligibilityPairs", () => {
  it("rejects an empty pairs array", async () => {
    await expect(
      linkEligibilityPairs({} as never, [], { adminUserId: "a1", writeAudit: vi.fn() }),
    ).rejects.toBeInstanceOf(LinkEligibilityValidationError);
  });

  it("rejects more than 200 pairs", async () => {
    const pairs = Array.from({ length: 201 }, () => ({
      serviceId: "s",
      nationalityCode: "IN",
    }));
    await expect(
      linkEligibilityPairs({} as never, pairs, { adminUserId: "a1", writeAudit: vi.fn() }),
    ).rejects.toBeInstanceOf(LinkEligibilityValidationError);
  });

  it("rejects when a service is missing (atomic, no insert)", async () => {
    const { tx } = makeTx({ services: ["s1"], nationalities: ["IN"] });
    await expect(
      linkEligibilityPairs(
        tx as never,
        [{ serviceId: "missing", nationalityCode: "IN" }],
        { adminUserId: "a1", writeAudit: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(LinkEligibilityValidationError);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("rejects when a nationality is missing (atomic, no insert)", async () => {
    const { tx } = makeTx({ services: ["s1"], nationalities: ["IN"] });
    await expect(
      linkEligibilityPairs(
        tx as never,
        [{ serviceId: "s1", nationalityCode: "ZZ" }],
        { adminUserId: "a1", writeAudit: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(LinkEligibilityValidationError);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("inserts new pairs and skips audit for conflicts", async () => {
    const { tx } = makeTx();
    const writeAudit = vi.fn();
    const result = await linkEligibilityPairs(
      tx as never,
      [
        { serviceId: "s1", nationalityCode: "IN" },
        { serviceId: "s1", nationalityCode: "US" },
      ],
      { adminUserId: "a1", writeAudit },
    );
    expect(result.created).toEqual([{ serviceId: "s1", nationalityCode: "IN" }]);
    expect(result.deduped).toBe(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});

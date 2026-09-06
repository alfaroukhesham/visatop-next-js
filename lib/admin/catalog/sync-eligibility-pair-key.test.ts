import { describe, expect, it, vi } from "vitest";
import { syncEligibilityForTouchedPairs } from "@/lib/admin/catalog/apply-customer-price-import";

const makeTx = (priced: Array<{ nationalityCode: string; serviceId: string; c: number }>) => {
  const inserted: Array<{ serviceId: string; nationalityCode: string }> = [];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => Promise.resolve(priced)),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((rows: Array<{ serviceId: string; nationalityCode: string }>) => {
        inserted.push(...rows);
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => rows),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
    })),
  };
  return { tx, inserted };
};

describe("syncEligibilityForTouchedPairs pair keys", () => {
  it("parses unit-separator keys into nationality + service id", async () => {
    const { tx, inserted } = makeTx([{ nationalityCode: "IN", serviceId: "svc-1", c: 2 }]);
    await syncEligibilityForTouchedPairs(tx as never, ["IN\x1fsvc-1"]);
    expect(inserted).toEqual([{ serviceId: "svc-1", nationalityCode: "IN" }]);
  });

  it("does not parse colon keys as nationality + service id", async () => {
    const { tx, inserted } = makeTx([]);
    await syncEligibilityForTouchedPairs(tx as never, ["IN:svc-1"]);
    expect(inserted).toEqual([]);
  });
});

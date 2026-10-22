import { describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

vi.mock("@/lib/admin/catalog/apply-customer-price-import", () => ({
  syncEligibilityForTouchedPairs: vi.fn(async () => ({ added: 1, removed: 0 })),
}));

vi.mock("@/lib/async/apply-chunks-in-parallel", () => ({
  applyChunksInParallel: vi.fn(async (items: unknown[], _size: number, fn: (chunk: unknown[]) => Promise<void>) => {
    if (items.length > 0) await fn(items);
  }),
}));

import { applyLocalCurrencyPriceUiUpdates } from "./apply-local-currency-price-updates";

describe("applyLocalCurrencyPriceUiUpdates", () => {
  it("upserts only the local currency row and never writes USD/AED FX siblings", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(async () => (table === schema.visaService ? [{ id: "svc-1" }] : [])),
        })),
      })),
      insert: vi.fn((table: unknown) => {
        expect(table).toBe(schema.catalogCustomerPrice);
        return {
          values: (rows: Array<Record<string, unknown>>) => {
            inserted.push(...rows);
            return {
              onConflictDoUpdate: vi.fn(async () => undefined),
            };
          },
        };
      }),
    };

    const result = await applyLocalCurrencyPriceUiUpdates(tx as never, {
      nationalityCode: "NG",
      currency: "NGN",
      updates: [
        { serviceId: "svc-1", amountMajor: "185000.00" },
        { serviceId: "svc-1", amountMajor: "" },
      ],
    });

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      nationalityCode: "NG",
      serviceId: "svc-1",
      currency: "NGN",
      amountMinor: 18_500_000,
      source: "admin_ui",
    });
  });
});

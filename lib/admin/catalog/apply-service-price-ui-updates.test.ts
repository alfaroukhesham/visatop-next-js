import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

vi.mock("@/lib/admin/catalog/apply-customer-price-import", () => ({
  syncEligibilityForTouchedPairs: vi.fn(async () => ({ added: 2, removed: 0 })),
}));

vi.mock("@/lib/async/apply-chunks-in-parallel", () => ({
  applyChunksInParallel: vi.fn(async (items: unknown[], _size: number, fn: (chunk: unknown[]) => Promise<void>) => {
    if (items.length > 0) await fn(items);
  }),
}));

import { syncEligibilityForTouchedPairs } from "@/lib/admin/catalog/apply-customer-price-import";
import {
  applyServicePriceUiUpdates,
  ServicePriceFxMissingError,
  ServicePriceValidationError,
} from "./apply-service-price-ui-updates";

const FX_ENV = "FX_AED_PER_USD";

type TMockTxOpts = {
  enabledNationalities?: Array<{ code: string }>;
  knownNationalities?: Array<{ code: string }>;
  existingPricedCodes?: string[];
};

const makeTx = (opts: TMockTxOpts = {}) => {
  const enabledNationalities = opts.enabledNationalities ?? [
    { code: "IN" },
    { code: "US" },
  ];
  const knownNationalities =
    opts.knownNationalities ??
    enabledNationalities.map((n) => ({ code: n.code }));
  const existingPricedCodes = opts.existingPricedCodes ?? [];
  const inserted: Array<Record<string, unknown>> = [];
  let deleteCalled = false;

  const tx = {
    select: vi.fn((cols: unknown) => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          const rows =
            table === schema.nationality ? enabledNationalities : [];
          const result = Promise.resolve(rows);
          return Object.assign(result, {
            limit: vi.fn(() => Promise.resolve(rows)),
          });
        }),
      })),
    })),
    selectDistinct: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === schema.catalogCustomerPrice) {
            return Promise.resolve(
              existingPricedCodes.map((code) => ({ nationalityCode: code })),
            );
          }
          return Promise.resolve([]);
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        inserted.push(...list);
        return {
          onConflictDoUpdate: vi.fn(async () => undefined),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        deleteCalled = true;
      }),
    })),
  };

  return {
    tx,
    inserted,
    deleteCalled: () => deleteCalled,
    knownNationalities: knownNationalities.map((n) => ({ code: n.code ?? n })),
  };
};

describe("applyServicePriceUiUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env[FX_ENV] = "3.6725";
  });

  afterEach(() => {
    delete process.env[FX_ENV];
    delete process.env.NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD;
  });

  it("mode all: upserts every enabled nationality and syncs eligibility", async () => {
    const { tx, inserted } = makeTx();
    const result = await applyServicePriceUiUpdates(tx as never, {
      mode: "all",
      serviceId: "svc-1",
      usdMajor: "100",
    });

    expect(result.updated).toBe(2);
    expect(result.removed).toBe(0);
    expect(result.mode).toBe("all");
    expect(inserted.length).toBe(4); // IN+US × USD+AED
    expect(syncEligibilityForTouchedPairs).toHaveBeenCalledWith(
      tx,
      expect.arrayContaining(["IN\x1fsvc-1", "US\x1fsvc-1"]),
    );
    expect(result.eligibilityAdded).toBe(2);
  });

  it("mode all: derives AED sibling when only USD is provided", async () => {
    const { tx, inserted } = makeTx({ enabledNationalities: [{ code: "IN" }] });
    await applyServicePriceUiUpdates(tx as never, {
      mode: "all",
      serviceId: "svc-1",
      usdMajor: "100",
    });

    const usdRow = inserted.find((r) => r.currency === "USD");
    const aedRow = inserted.find((r) => r.currency === "AED");
    expect(usdRow?.source).toBe("admin_ui");
    expect(aedRow?.source).toBe("fx_derived_aed_from_usd");
    expect(aedRow?.amountMinor).toBe(36725);
  });

  it("mode all: both amounts are admin_ui with no derived sibling", async () => {
    const { tx, inserted } = makeTx({ enabledNationalities: [{ code: "IN" }] });
    await applyServicePriceUiUpdates(tx as never, {
      mode: "all",
      serviceId: "svc-1",
      usdMajor: "100",
      aedMajor: "400",
    });

    expect(inserted.find((r) => r.currency === "USD")?.source).toBe("admin_ui");
    expect(inserted.find((r) => r.currency === "AED")?.source).toBe("admin_ui");
  });

  it("throws when FX is missing and only one amount is provided", async () => {
    delete process.env[FX_ENV];
    const { tx, inserted } = makeTx();
    await expect(
      applyServicePriceUiUpdates(tx as never, {
        mode: "all",
        serviceId: "svc-1",
        usdMajor: "100",
      }),
    ).rejects.toBeInstanceOf(ServicePriceFxMissingError);
    expect(inserted).toHaveLength(0);
  });

  it("mode groups: replaces priced set, deletes removed nationalities, syncs touched pairs", async () => {
    vi.mocked(syncEligibilityForTouchedPairs).mockResolvedValueOnce({ added: 1, removed: 1 });
    const { tx, inserted, deleteCalled } = makeTx({
      enabledNationalities: [{ code: "IN" }, { code: "US" }],
      existingPricedCodes: ["IN", "US"],
    });

    const result = await applyServicePriceUiUpdates(tx as never, {
      mode: "groups",
      serviceId: "svc-1",
      groups: [{ usdMajor: "50", nationalityCodes: ["IN"] }],
    });

    expect(result.updated).toBe(1);
    expect(result.removed).toBe(1);
    expect(deleteCalled()).toBe(true);
    expect(inserted.length).toBe(2);
    expect(syncEligibilityForTouchedPairs).toHaveBeenCalledWith(
      tx,
      expect.arrayContaining(["IN\x1fsvc-1", "US\x1fsvc-1"]),
    );
  });

  it("rejects duplicate nationality across groups", async () => {
    const { tx, inserted } = makeTx();
    await expect(
      applyServicePriceUiUpdates(tx as never, {
        mode: "groups",
        serviceId: "svc-1",
        groups: [
          { usdMajor: "50", nationalityCodes: ["IN"] },
          { usdMajor: "60", nationalityCodes: ["IN", "US"] },
        ],
      }),
    ).rejects.toBeInstanceOf(ServicePriceValidationError);
    expect(inserted).toHaveLength(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import {
  CatalogDeleteBlockedError,
  CatalogEntityNotFoundError,
  deleteCatalogNationality,
  deleteCatalogVisaService,
} from "./delete-catalog-entity";

const makeTx = () => {
  const selectResult: unknown[] = [];
  const countResult = [{ n: 0 }];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === schema.application) {
            return Promise.resolve(countResult);
          }
          return {
            limit: vi.fn(() => Promise.resolve(selectResult)),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };
  return { tx, selectResult, countResult };
};

describe("deleteCatalogNationality", () => {
  it("throws not found when the code is missing", async () => {
    const { tx } = makeTx();
    await expect(deleteCatalogNationality(tx as never, "ZZ")).rejects.toBeInstanceOf(
      CatalogEntityNotFoundError,
    );
  });

  it("throws blocked when an application references the code", async () => {
    const { tx, selectResult, countResult } = makeTx();
    selectResult.push({ code: "IN", name: "India", enabled: true });
    countResult[0] = { n: 2 };
    await expect(deleteCatalogNationality(tx as never, "IN")).rejects.toBeInstanceOf(
      CatalogDeleteBlockedError,
    );
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("deletes when no applications reference the code", async () => {
    const { tx, selectResult } = makeTx();
    const row = { code: "IN", name: "India", enabled: true };
    selectResult.push(row);
    await expect(deleteCatalogNationality(tx as never, "IN")).resolves.toEqual(row);
    expect(tx.delete).toHaveBeenCalled();
  });
});

describe("deleteCatalogVisaService", () => {
  it("throws not found when the service is missing", async () => {
    const { tx } = makeTx();
    await expect(deleteCatalogVisaService(tx as never, "missing")).rejects.toBeInstanceOf(
      CatalogEntityNotFoundError,
    );
  });

  it("throws blocked when an application references the service", async () => {
    const { tx, selectResult, countResult } = makeTx();
    selectResult.push({ id: "svc-1", name: "Tourist", enabled: true });
    countResult[0] = { n: 1 };
    await expect(deleteCatalogVisaService(tx as never, "svc-1")).rejects.toBeInstanceOf(
      CatalogDeleteBlockedError,
    );
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("deletes when no applications reference the service", async () => {
    const { tx, selectResult } = makeTx();
    const row = { id: "svc-1", name: "Tourist", enabled: true };
    selectResult.push(row);
    await expect(deleteCatalogVisaService(tx as never, "svc-1")).resolves.toEqual(row);
    expect(tx.delete).toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import {
  assignDocumentRequirements,
  DOCUMENT_REQUIREMENT_PAIR_LIMIT,
  previewDocumentRequirementAssign,
  removeDocumentRequirements,
  removeOneDocumentRequirement,
} from "./document-requirement-assign";

type ReqRow = {
  id: string;
  nationality_code: string;
  service_id: string;
  document_type: string;
  role: string;
};

type Store = {
  nationality: Set<string>;
  visa_service: Set<string>;
  visa_service_eligibility: Set<string>;
  catalog_customer_price: Set<string>;
  catalog_document_requirement: ReqRow[];
};

type StoreInit = {
  nationality?: string[];
  visa_service?: string[];
  visa_service_eligibility?: string[];
  catalog_customer_price?: string[];
  catalog_document_requirement?: ReqRow[];
};

function makeStore(init?: StoreInit): Store {
  return {
    nationality: new Set(init?.nationality ?? []),
    visa_service: new Set(init?.visa_service ?? []),
    visa_service_eligibility: new Set(init?.visa_service_eligibility ?? []),
    catalog_customer_price: new Set(init?.catalog_customer_price ?? []),
    catalog_document_requirement: init?.catalog_document_requirement ?? [],
  };
}

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `req_${idCounter}`;
}

function inArrayInfo(cond: unknown): { col: string; values: unknown[] } | null {
  const chunks = (cond as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  let col: string | null = null;
  let values: unknown[] | null = null;
  for (const c of chunks) {
    if (c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string") {
      col = (c as { name: string }).name;
    }
    if (Array.isArray(c)) {
      values = c.map((e) =>
        e && typeof e === "object" && "value" in e ? (e as { value: unknown }).value : e,
      );
    }
  }
  if (col && values) return { col, values };
  return null;
}

function rowsForTable(store: Store, tableName: string): Record<string, unknown>[] {
  switch (tableName) {
    case "nationality":
      return [...store.nationality].map((code) => ({ code }));
    case "visa_service":
      return [...store.visa_service].map((id) => ({ id }));
    case "visa_service_eligibility":
      return [...store.visa_service_eligibility].map((k) => {
        const [service_id, nationality_code] = k.split(":");
        return { service_id, nationality_code };
      });
    case "catalog_customer_price":
      return [...store.catalog_customer_price].map((k) => {
        const [nationality_code, service_id] = k.split(":");
        return { nationality_code, service_id };
      });
    case "catalog_document_requirement":
      return store.catalog_document_requirement;
    default:
      return [];
  }
}

function filterByCond(rows: Record<string, unknown>[], cond: unknown): Record<string, unknown>[] {
  const info = inArrayInfo(cond);
  if (!info) return rows;
  return rows.filter((r) => info.values.includes(r[info.col]));
}

function mapCols(cols: Record<string, { name: string }>, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(cols)) {
    out[key] = row[cols[key].name];
  }
  return out;
}

function insertDoNothing(store: Store, tableName: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const inserted: Record<string, unknown>[] = [];
  if (tableName === "visa_service_eligibility") {
    for (const row of rows) {
      const key = `${row.serviceId}:${row.nationalityCode}`;
      if (!store.visa_service_eligibility.has(key)) {
        store.visa_service_eligibility.add(key);
        inserted.push({ service_id: row.serviceId, nationality_code: row.nationalityCode });
      }
    }
  } else if (tableName === "catalog_document_requirement") {
    for (const row of rows) {
      const key = `${row.nationalityCode}:${row.serviceId}:${row.documentType}`;
      const exists = store.catalog_document_requirement.some(
        (r) => `${r.nationality_code}:${r.service_id}:${r.document_type}` === key,
      );
      if (!exists) {
        const rec: ReqRow = {
          id: genId(),
          nationality_code: String(row.nationalityCode),
          service_id: String(row.serviceId),
          document_type: String(row.documentType),
          role: String(row.role),
        };
        store.catalog_document_requirement.push(rec);
        inserted.push(rec);
      }
    }
  }
  return inserted;
}

function upsert(store: Store, tableName: string, rows: Record<string, unknown>[], opts: { set: { role: string } }): void {
  if (tableName !== "catalog_document_requirement") return;
  for (const row of rows) {
    const key = `${row.nationalityCode}:${row.serviceId}:${row.documentType}`;
    const existing = store.catalog_document_requirement.find(
      (r) => `${r.nationality_code}:${r.service_id}:${r.document_type}` === key,
    );
    if (existing) {
      existing.role = opts.set.role;
    } else {
      store.catalog_document_requirement.push({
        id: genId(),
        nationality_code: String(row.nationalityCode),
        service_id: String(row.serviceId),
        document_type: String(row.documentType),
        role: String(row.role),
      });
    }
  }
}

function deleteRows(store: Store, tableName: string, cond: unknown): Record<string, unknown>[] {
  if (tableName !== "catalog_document_requirement") return [];
  const info = inArrayInfo(cond);
  if (!info) return [];
  const deleted: ReqRow[] = [];
  store.catalog_document_requirement = store.catalog_document_requirement.filter((r) => {
    if (info.values.includes((r as unknown as Record<string, unknown>)[info.col])) {
      deleted.push(r);
      return false;
    }
    return true;
  });
  return deleted;
}

function tableName(table: unknown): string {
  const t = table as Record<symbol, unknown>;
  const nameSym = Object.getOwnPropertySymbols(t).find((s) => String(s) === "Symbol(drizzle:Name)");
  return nameSym ? String(t[nameSym]) : "";
}

function makeTx(store: Store) {
  const tx = {
    select: (cols: Record<string, { name: string }>) => ({
      from: (table: unknown) => {
        const name = tableName(table);
        const doSelect = (cond: unknown) => {
          const rows = rowsForTable(store, name);
          const filtered = cond ? filterByCond(rows, cond) : rows;
          return filtered.map((r) => mapCols(cols, r));
        };
        return {
          where: (cond: unknown) => Promise.resolve(doSelect(cond)),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(doSelect(null)).then(resolve),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (rows: Record<string, unknown>[]) => ({
        onConflictDoNothing: () => ({
          returning: (cols: Record<string, { name: string }>) => {
            const inserted = insertDoNothing(store, tableName(table), rows);
            return Promise.resolve(inserted.map((r) => mapCols(cols, r)));
          },
        }),
        onConflictDoUpdate: (opts: { set: { role: string } }) => {
          upsert(store, tableName(table), rows, opts);
          return Promise.resolve([]);
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (cond: unknown) => ({
        returning: (cols: Record<string, { name: string }>) => {
          const deleted = deleteRows(store, tableName(table), cond);
          return Promise.resolve(deleted.map((r) => mapCols(cols, r)));
        },
      }),
    }),
  };
  return tx as never;
}

const BANK = "bank_statement_6m";

describe("previewDocumentRequirementAssign", () => {
  it("previews 3 explicit pairs: 1 eligible, 0 extras, 1 without price", async () => {
    const store = makeStore({
      nationality: ["US", "GB", "IN"],
      visa_service: ["svc1", "svc2", "svc3"],
      visa_service_eligibility: ["svc1:US"],
      catalog_customer_price: ["US:svc1", "GB:svc2"],
    });
    const tx = makeTx(store);
    const preview = await previewDocumentRequirementAssign(tx, {
      documentType: BANK,
      role: "required",
      pairs: [
        { nationalityCode: "US", serviceId: "svc1" },
        { nationalityCode: "GB", serviceId: "svc2" },
        { nationalityCode: "IN", serviceId: "svc3" },
      ],
    });
    expect(preview).toEqual({
      pairCount: 3,
      alreadyEligible: 1,
      willCreateEligibility: 2,
      pairsWithoutPrice: 1,
      alreadyHasDocument: 0,
      willInsert: 3,
      willUpdateRole: 0,
    });
  });
});

describe("assignDocumentRequirements", () => {
  it("inserts missing eligibility + extras; second assign with other role updates role only", async () => {
    const store = makeStore({
      nationality: ["US", "GB"],
      visa_service: ["svc1", "svc2"],
    });
    const tx = makeTx(store);
    const input = {
      documentType: BANK,
      role: "required" as const,
      pairs: [
        { nationalityCode: "US", serviceId: "svc1" },
        { nationalityCode: "GB", serviceId: "svc2" },
      ],
    };
    const first = await assignDocumentRequirements(tx, input);
    expect(first).toEqual({ pairCount: 2, eligibilityCreated: 2, upserted: 2 });
    expect(store.visa_service_eligibility.has("svc1:US")).toBe(true);
    expect(store.visa_service_eligibility.has("svc2:GB")).toBe(true);
    expect(store.catalog_document_requirement).toHaveLength(2);

    const second = await assignDocumentRequirements(tx, { ...input, role: "additional" });
    expect(second).toEqual({ pairCount: 2, eligibilityCreated: 0, upserted: 2 });
    expect(store.catalog_document_requirement.every((r) => r.role === "additional")).toBe(true);
  });

  it("rejects floor type, unknown type, empty pairs, and over-limit pairs", async () => {
    const store = makeStore({ nationality: ["US"], visa_service: ["svc1"] });
    const tx = makeTx(store);
    const base = { documentType: BANK, role: "required" as const };

    await expect(
      assignDocumentRequirements(tx, {
        ...base,
        documentType: "passport_copy",
        pairs: [{ nationalityCode: "US", serviceId: "svc1" }],
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_REQUIREMENTS_TYPE_INVALID" });

    await expect(
      assignDocumentRequirements(tx, {
        ...base,
        documentType: "not_real",
        pairs: [{ nationalityCode: "US", serviceId: "svc1" }],
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_REQUIREMENTS_TYPE_INVALID" });

    await expect(
      assignDocumentRequirements(tx, { ...base, pairs: [] }),
    ).rejects.toMatchObject({ code: "DOCUMENT_REQUIREMENTS_PAIRS_EMPTY" });

    const many = Array.from({ length: DOCUMENT_REQUIREMENT_PAIR_LIMIT + 1 }, (_, i) => ({
      nationalityCode: `N${i}`,
      serviceId: `S${i}`,
    }));
    await expect(
      assignDocumentRequirements(tx, { ...base, pairs: many }),
    ).rejects.toMatchObject({ code: "DOCUMENT_REQUIREMENTS_PAIR_LIMIT" });
  });

  it("dedupes duplicate pairs and uppercases nationality codes", async () => {
    const store = makeStore({
      nationality: ["US", "GB"],
      visa_service: ["svc1"],
    });
    const tx = makeTx(store);
    const result = await assignDocumentRequirements(tx, {
      documentType: BANK,
      role: "required",
      pairs: [
        { nationalityCode: "us", serviceId: "svc1" },
        { nationalityCode: "US", serviceId: "svc1" },
        { nationalityCode: "gb", serviceId: "svc1" },
      ],
    });
    expect(result).toEqual({ pairCount: 2, eligibilityCreated: 2, upserted: 2 });
    expect(store.visa_service_eligibility.has("svc1:US")).toBe(true);
    expect(store.visa_service_eligibility.has("svc1:GB")).toBe(true);
  });
});

describe("removeDocumentRequirements", () => {
  it("deletes extras and does not delete eligibility", async () => {
    const store = makeStore({
      nationality: ["US", "GB"],
      visa_service: ["svc1", "svc2"],
      visa_service_eligibility: ["svc1:US", "svc2:GB"],
      catalog_document_requirement: [
        { id: "r1", nationality_code: "US", service_id: "svc1", document_type: BANK, role: "required" },
        { id: "r2", nationality_code: "GB", service_id: "svc2", document_type: BANK, role: "required" },
        { id: "r3", nationality_code: "US", service_id: "svc1", document_type: "other_type", role: "required" },
      ],
    });
    const tx = makeTx(store);
    const result = await removeDocumentRequirements(tx, {
      documentType: BANK,
      pairs: [
        { nationalityCode: "US", serviceId: "svc1" },
        { nationalityCode: "GB", serviceId: "svc2" },
      ],
    });
    expect(result).toEqual({ deleted: 2 });
    expect(store.catalog_document_requirement).toHaveLength(1);
    expect(store.catalog_document_requirement[0].id).toBe("r3");
    expect(store.visa_service_eligibility.has("svc1:US")).toBe(true);
    expect(store.visa_service_eligibility.has("svc2:GB")).toBe(true);
  });
});

describe("removeOneDocumentRequirement", () => {
  it("deletes a single row; unknown id throws NOT_FOUND", async () => {
    const store = makeStore({
      catalog_document_requirement: [
        { id: "r1", nationality_code: "US", service_id: "svc1", document_type: BANK, role: "required" },
      ],
    });
    const tx = makeTx(store);
    await removeOneDocumentRequirement(tx, "r1");
    expect(store.catalog_document_requirement).toHaveLength(0);
    await expect(removeOneDocumentRequirement(tx, "missing")).rejects.toMatchObject({
      code: "DOCUMENT_REQUIREMENTS_NOT_FOUND",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  deleteCatalogDocumentType,
  humanizeDocumentTypeKey,
  isReservedDocumentTypeKey,
  slugifyDocumentTypeLabel,
} from "./document-type";

type TTypeRow = {
  key: string;
  label: string;
  description: string;
  accept_mime: string;
};

type TReqRow = {
  id: string;
  document_type: string;
};

type TStore = {
  catalog_document_type: TTypeRow[];
  catalog_document_requirement: TReqRow[];
};

const tableName = (table: unknown): string => {
  const t = table as Record<symbol, unknown>;
  const nameSym = Object.getOwnPropertySymbols(t).find((s) => String(s) === "Symbol(drizzle:Name)");
  return nameSym ? String(t[nameSym]) : "";
};

const eqInfo = (cond: unknown): { col: string; value: unknown } | null => {
  const chunks = (cond as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  let col: string | null = null;
  let value: unknown = null;
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && typeof (chunk as { name?: unknown }).name === "string") {
      col = (chunk as { name: string }).name;
    }
    if (
      chunk &&
      typeof chunk === "object" &&
      "value" in chunk &&
      typeof (chunk as { value: unknown }).value === "string"
    ) {
      value = (chunk as { value: string }).value;
    }
  }
  return col ? { col, value } : null;
};

const mapCols = (
  cols: Record<string, { name: string }>,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(cols)) {
    out[key] = row[cols[key].name];
  }
  return out;
};

const makeTx = (store: TStore) => {
  const rowsFor = (name: string): Record<string, unknown>[] => {
    if (name === "catalog_document_type") return store.catalog_document_type;
    if (name === "catalog_document_requirement") return store.catalog_document_requirement;
    return [];
  };

  return {
    select: (cols: Record<string, { name: string }>) => ({
      from: (table: unknown) => {
        const name = tableName(table);
        const run = (cond: unknown) => {
          const info = cond ? eqInfo(cond) : null;
          const rows = rowsFor(name).filter((row) =>
            info ? row[info.col] === info.value : true,
          );
          return rows.map((row) => mapCols(cols, row));
        };
        return {
          where: (cond: unknown) => ({
            limit: (n: number) => Promise.resolve(run(cond).slice(0, n)),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(run(cond)).then(resolve),
          }),
        };
      },
    }),
    delete: (table: unknown) => ({
      where: (cond: unknown) => {
        const name = tableName(table);
        const info = eqInfo(cond);
        const deleted = rowsFor(name).filter((row) => (info ? row[info.col] === info.value : false));
        if (name === "catalog_document_type") {
          store.catalog_document_type = store.catalog_document_type.filter(
            (row) => (info ? row[info.col] !== info.value : true),
          );
        }
        if (name === "catalog_document_requirement") {
          store.catalog_document_requirement = store.catalog_document_requirement.filter(
            (row) => (info ? row[info.col] !== info.value : true),
          );
        }
        return {
          returning: (cols: Record<string, { name: string }>) =>
            Promise.resolve(deleted.map((row) => mapCols(cols, row))),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(deleted).then(resolve),
        };
      },
    }),
  } as never;
};

describe("slugifyDocumentTypeLabel", () => {
  it("turns a display name into a stable key", () => {
    expect(slugifyDocumentTypeLabel("Invitation letter")).toBe("invitation_letter");
    expect(slugifyDocumentTypeLabel("  Last 6 months bank  ")).toBe("last_6_months_bank");
  });

  it("rejects empty labels", () => {
    expect(slugifyDocumentTypeLabel("   ")).toBe("");
    expect(slugifyDocumentTypeLabel("!!!")).toBe("");
  });
});

describe("isReservedDocumentTypeKey", () => {
  it("blocks floor and non-catalog upload types", () => {
    expect(isReservedDocumentTypeKey("passport_copy")).toBe(true);
    expect(isReservedDocumentTypeKey("personal_photo")).toBe(true);
    expect(isReservedDocumentTypeKey("supporting")).toBe(true);
    expect(isReservedDocumentTypeKey("outcome_approval")).toBe(true);
  });

  it("allows bank and admin-created extras", () => {
    expect(isReservedDocumentTypeKey("bank_statement_6m")).toBe(false);
    expect(isReservedDocumentTypeKey("invitation_letter")).toBe(false);
  });
});

describe("humanizeDocumentTypeKey", () => {
  it("makes a readable fallback label", () => {
    expect(humanizeDocumentTypeKey("invitation_letter")).toBe("Invitation letter");
  });
});

describe("deleteCatalogDocumentType", () => {
  it("deletes the document and every assignment for that type only", async () => {
    const store: TStore = {
      catalog_document_type: [
        {
          key: "invitation_letter",
          label: "Invitation letter",
          description: "",
          accept_mime: "image/jpeg,image/png,application/pdf",
        },
        {
          key: "bank_statement_6m",
          label: "Bank statement",
          description: "",
          accept_mime: "image/jpeg,image/png,application/pdf",
        },
      ],
      catalog_document_requirement: [
        { id: "r1", document_type: "invitation_letter" },
        { id: "r2", document_type: "invitation_letter" },
        { id: "r3", document_type: "bank_statement_6m" },
      ],
    };

    const result = await deleteCatalogDocumentType(makeTx(store), "invitation_letter");

    expect(result).toEqual({
      key: "invitation_letter",
      label: "Invitation letter",
      deletedRules: 2,
    });
    expect(store.catalog_document_type.map((row) => row.key)).toEqual(["bank_statement_6m"]);
    expect(store.catalog_document_requirement).toEqual([{ id: "r3", document_type: "bank_statement_6m" }]);
  });

  it("rejects a missing document", async () => {
    const store: TStore = { catalog_document_type: [], catalog_document_requirement: [] };
    await expect(deleteCatalogDocumentType(makeTx(store), "missing_doc")).rejects.toEqual({
      code: "DOCUMENT_TYPE_NOT_FOUND",
    });
  });
});

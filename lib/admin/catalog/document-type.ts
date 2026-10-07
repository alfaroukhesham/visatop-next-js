import { count, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  DEFAULT_DOCUMENT_ACCEPT_MIME,
  DOCUMENT_TYPE_KEY_RE,
  isReservedDocumentTypeKey,
  slugifyDocumentTypeLabel,
  type TCatalogDocumentType,
} from "@/lib/admin/catalog/document-type-helpers";

export {
  DEFAULT_DOCUMENT_ACCEPT_MIME,
  DOCUMENT_TYPE_KEY_RE,
  humanizeDocumentTypeKey,
  isReservedDocumentTypeKey,
  RESERVED_DOCUMENT_TYPE_KEYS,
  slugifyDocumentTypeLabel,
  type TCatalogDocumentType,
} from "@/lib/admin/catalog/document-type-helpers";

const uniqueKey = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
};

export const listCatalogDocumentTypes = async (
  tx: DbTransaction,
): Promise<TCatalogDocumentType[]> => {
  const [types, counts] = await Promise.all([
    tx
      .select({
        key: schema.catalogDocumentType.key,
        label: schema.catalogDocumentType.label,
        description: schema.catalogDocumentType.description,
        acceptMime: schema.catalogDocumentType.acceptMime,
      })
      .from(schema.catalogDocumentType)
      .orderBy(schema.catalogDocumentType.label),
    tx
      .select({
        documentType: schema.catalogDocumentRequirement.documentType,
        pairCount: count(),
      })
      .from(schema.catalogDocumentRequirement)
      .groupBy(schema.catalogDocumentRequirement.documentType),
  ]);
  const countByType = new Map(counts.map((row) => [row.documentType, Number(row.pairCount)]));
  return types.map((row) => ({
    key: row.key,
    label: row.label,
    description: row.description,
    acceptMime: row.acceptMime,
    pairCount: countByType.get(row.key) ?? 0,
  }));
};

export const getCatalogDocumentType = async (
  tx: DbTransaction,
  key: string,
): Promise<TCatalogDocumentType | null> => {
  const [row] = await tx
    .select({
      key: schema.catalogDocumentType.key,
      label: schema.catalogDocumentType.label,
      description: schema.catalogDocumentType.description,
      acceptMime: schema.catalogDocumentType.acceptMime,
    })
    .from(schema.catalogDocumentType)
    .where(eq(schema.catalogDocumentType.key, key))
    .limit(1);
  if (!row) return null;
  const [countRow] = await tx
    .select({ pairCount: count() })
    .from(schema.catalogDocumentRequirement)
    .where(eq(schema.catalogDocumentRequirement.documentType, key));
  return {
    ...row,
    pairCount: Number(countRow?.pairCount ?? 0),
  };
};

export const createCatalogDocumentType = async (
  tx: DbTransaction,
  input: { label: string; description?: string },
): Promise<TCatalogDocumentType> => {
  const label = input.label.trim();
  if (!label) {
    throw { code: "DOCUMENT_TYPE_LABEL_REQUIRED" };
  }
  const base = slugifyDocumentTypeLabel(label);
  if (!base || !DOCUMENT_TYPE_KEY_RE.test(base) || isReservedDocumentTypeKey(base)) {
    throw { code: "DOCUMENT_TYPE_KEY_INVALID" };
  }
  const existing = await tx
    .select({ key: schema.catalogDocumentType.key })
    .from(schema.catalogDocumentType);
  const key = uniqueKey(base, new Set(existing.map((row) => row.key)));
  const description = input.description?.trim() ?? "";
  await tx.insert(schema.catalogDocumentType).values({
    key,
    label,
    description,
    acceptMime: DEFAULT_DOCUMENT_ACCEPT_MIME,
  });
  return {
    key,
    label,
    description,
    acceptMime: DEFAULT_DOCUMENT_ACCEPT_MIME,
    pairCount: 0,
  };
};

export const deleteCatalogDocumentType = async (
  tx: DbTransaction,
  key: string,
): Promise<{ key: string; label: string; deletedRules: number }> => {
  const [row] = await tx
    .select({
      key: schema.catalogDocumentType.key,
      label: schema.catalogDocumentType.label,
    })
    .from(schema.catalogDocumentType)
    .where(eq(schema.catalogDocumentType.key, key))
    .limit(1);
  if (!row) {
    throw { code: "DOCUMENT_TYPE_NOT_FOUND" };
  }

  const deletedRules = await tx
    .delete(schema.catalogDocumentRequirement)
    .where(eq(schema.catalogDocumentRequirement.documentType, key))
    .returning({ id: schema.catalogDocumentRequirement.id });

  await tx.delete(schema.catalogDocumentType).where(eq(schema.catalogDocumentType.key, key));

  return {
    key: row.key,
    label: row.label,
    deletedRules: deletedRules.length,
  };
};

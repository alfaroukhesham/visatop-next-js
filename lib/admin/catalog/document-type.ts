import { count, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const DOCUMENT_TYPE_KEY_RE = /^[a-z][a-z0-9_]{1,62}$/;

export const DEFAULT_DOCUMENT_ACCEPT_MIME = "image/jpeg,image/png,application/pdf";

export const RESERVED_DOCUMENT_TYPE_KEYS = [
  "passport_copy",
  "personal_photo",
  "supporting",
  "admin_step_attachment",
  "outcome_approval",
  "outcome_authority_rejection",
] as const;

export type TCatalogDocumentType = {
  key: string;
  label: string;
  description: string;
  acceptMime: string;
  pairCount: number;
};

export const isReservedDocumentTypeKey = (key: string): boolean =>
  (RESERVED_DOCUMENT_TYPE_KEYS as readonly string[]).includes(key);

export const slugifyDocumentTypeLabel = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63);

export const humanizeDocumentTypeKey = (key: string): string => {
  const text = key.replace(/_/g, " ").trim();
  if (!text) return key;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

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

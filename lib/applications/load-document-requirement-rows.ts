import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { catalogDocumentRequirement, catalogDocumentType } from "@/lib/db/schema";
import {
  resolveDocumentRequirements,
  type TDocumentSlot,
  type TRequirementRow,
} from "@/lib/apply/document-requirements";

export type TRawDocumentRequirementRow = {
  documentType: string;
  role: string;
  label?: string | null;
  description?: string | null;
  acceptMime?: string | null;
};

export const mapDocumentRequirementRows = (
  rows: TRawDocumentRequirementRow[],
): TRequirementRow[] =>
  rows.map((r) => {
    const row: TRequirementRow = {
      documentType: r.documentType,
      role: r.role as TRequirementRow["role"],
    };
    if (r.label != null && r.label !== "") row.label = r.label;
    if (r.description != null && r.description !== "") row.description = r.description;
    if (r.acceptMime != null && r.acceptMime !== "") row.acceptMime = r.acceptMime;
    return row;
  });

export const loadDocumentRequirementRows = async (
  tx: DbTransaction,
  member: { serviceId: string; nationalityCode: string },
): Promise<TRequirementRow[]> => {
  const rows = await tx
    .select({
      documentType: catalogDocumentRequirement.documentType,
      role: catalogDocumentRequirement.role,
      label: catalogDocumentType.label,
      description: catalogDocumentType.description,
      acceptMime: catalogDocumentType.acceptMime,
    })
    .from(catalogDocumentRequirement)
    .leftJoin(
      catalogDocumentType,
      eq(catalogDocumentType.key, catalogDocumentRequirement.documentType),
    )
    .where(
      and(
        eq(catalogDocumentRequirement.serviceId, member.serviceId),
        eq(catalogDocumentRequirement.nationalityCode, member.nationalityCode),
      ),
    );
  return mapDocumentRequirementRows(rows);
};

export const loadMemberDocumentSlots = async (
  tx: DbTransaction,
  member: { serviceId: string; nationalityCode: string },
): Promise<TDocumentSlot[]> =>
  resolveDocumentRequirements(await loadDocumentRequirementRows(tx, member));

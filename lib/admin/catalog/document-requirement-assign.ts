import { inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  ASSIGNABLE_DOCUMENT_TYPE_KEYS,
  FLOOR_DOCUMENT_TYPE_KEYS,
} from "@/lib/apply/document-slot-catalog";

export const DOCUMENT_REQUIREMENT_PAIR_LIMIT = 2000;

export type TDocumentRequirementPair = {
  nationalityCode: string;
  serviceId: string;
};

export type TDocumentRequirementAssignInput = {
  documentType: string;
  role: "required" | "additional";
  pairs: TDocumentRequirementPair[];
};

export type TDocumentRequirementAssignPreview = {
  pairCount: number;
  alreadyEligible: number;
  willCreateEligibility: number;
  pairsWithoutPrice: number;
  alreadyHasDocument: number;
  willInsert: number;
  willUpdateRole: number;
};

export type TDocumentRequirementAssignResult = {
  pairCount: number;
  eligibilityCreated: number;
  upserted: number;
};

export type TDocumentRequirementDomainError = { code: string };

const pairKey = (nationalityCode: string, serviceId: string): string =>
  `${nationalityCode}:${serviceId}`;

const dedupePairs = (pairs: TDocumentRequirementPair[]): TDocumentRequirementPair[] => {
  const seen = new Map<string, TDocumentRequirementPair>();
  for (const pair of pairs) {
    const nationalityCode = pair.nationalityCode.toUpperCase();
    const key = pairKey(nationalityCode, pair.serviceId);
    if (!seen.has(key)) {
      seen.set(key, { nationalityCode, serviceId: pair.serviceId });
    }
  }
  return [...seen.values()];
};

const assertValidType = (documentType: string): void => {
  const assignable = ASSIGNABLE_DOCUMENT_TYPE_KEYS as readonly string[];
  const floor = FLOOR_DOCUMENT_TYPE_KEYS as readonly string[];
  if (!assignable.includes(documentType) || floor.includes(documentType)) {
    throw { code: "DOCUMENT_REQUIREMENTS_TYPE_INVALID" };
  }
};

const assertPairCount = (pairs: TDocumentRequirementPair[]): void => {
  if (pairs.length === 0) {
    throw { code: "DOCUMENT_REQUIREMENTS_PAIRS_EMPTY" };
  }
  if (pairs.length > DOCUMENT_REQUIREMENT_PAIR_LIMIT) {
    throw { code: "DOCUMENT_REQUIREMENTS_PAIR_LIMIT" };
  }
};

const assertRefsExist = async (
  tx: DbTransaction,
  pairs: TDocumentRequirementPair[],
): Promise<void> => {
  const nationalityCodes = [...new Set(pairs.map((p) => p.nationalityCode))];
  const serviceIds = [...new Set(pairs.map((p) => p.serviceId))];
  const nationalities = await tx
    .select({ code: schema.nationality.code })
    .from(schema.nationality)
    .where(inArray(schema.nationality.code, nationalityCodes));
  const services = await tx
    .select({ id: schema.visaService.id })
    .from(schema.visaService)
    .where(inArray(schema.visaService.id, serviceIds));
  const nationalitySet = new Set(nationalities.map((r) => r.code));
  const serviceSet = new Set(services.map((r) => r.id));
  const unknown = pairs.some(
    (p) => !nationalitySet.has(p.nationalityCode) || !serviceSet.has(p.serviceId),
  );
  if (unknown) {
    throw { code: "DOCUMENT_REQUIREMENTS_UNKNOWN_REF" };
  }
};

export const previewDocumentRequirementAssign = async (
  tx: DbTransaction,
  input: TDocumentRequirementAssignInput,
): Promise<TDocumentRequirementAssignPreview> => {
  const pairs = dedupePairs(input.pairs);
  assertValidType(input.documentType);
  assertPairCount(pairs);
  await assertRefsExist(tx, pairs);

  const serviceIds = [...new Set(pairs.map((p) => p.serviceId))];

  const eligibilityRows = await tx
    .select({
      serviceId: schema.visaServiceEligibility.serviceId,
      nationalityCode: schema.visaServiceEligibility.nationalityCode,
    })
    .from(schema.visaServiceEligibility)
    .where(inArray(schema.visaServiceEligibility.serviceId, serviceIds));
  const eligibleKeys = new Set(
    eligibilityRows.map((r) => pairKey(r.nationalityCode, r.serviceId)),
  );
  const alreadyEligible = pairs.filter((p) =>
    eligibleKeys.has(pairKey(p.nationalityCode, p.serviceId)),
  ).length;

  const priceRows = await tx
    .select({
      nationalityCode: schema.catalogCustomerPrice.nationalityCode,
      serviceId: schema.catalogCustomerPrice.serviceId,
    })
    .from(schema.catalogCustomerPrice)
    .where(inArray(schema.catalogCustomerPrice.serviceId, serviceIds));
  const priceKeys = new Set(priceRows.map((r) => pairKey(r.nationalityCode, r.serviceId)));
  const pairsWithoutPrice = pairs.filter(
    (p) => !priceKeys.has(pairKey(p.nationalityCode, p.serviceId)),
  ).length;

  const requirementRows = await tx
    .select({
      id: schema.catalogDocumentRequirement.id,
      nationalityCode: schema.catalogDocumentRequirement.nationalityCode,
      serviceId: schema.catalogDocumentRequirement.serviceId,
      documentType: schema.catalogDocumentRequirement.documentType,
      role: schema.catalogDocumentRequirement.role,
    })
    .from(schema.catalogDocumentRequirement)
    .where(inArray(schema.catalogDocumentRequirement.serviceId, serviceIds));
  const pairSet = new Set(pairs.map((p) => pairKey(p.nationalityCode, p.serviceId)));
  const existingForType = requirementRows.filter(
    (r) =>
      r.documentType === input.documentType &&
      pairSet.has(pairKey(r.nationalityCode, r.serviceId)),
  );
  const alreadyHasDocument = existingForType.length;
  const willUpdateRole = existingForType.filter((r) => r.role !== input.role).length;

  return {
    pairCount: pairs.length,
    alreadyEligible,
    willCreateEligibility: pairs.length - alreadyEligible,
    pairsWithoutPrice,
    alreadyHasDocument,
    willInsert: pairs.length - alreadyHasDocument,
    willUpdateRole,
  };
};

export const assignDocumentRequirements = async (
  tx: DbTransaction,
  input: TDocumentRequirementAssignInput,
): Promise<TDocumentRequirementAssignResult> => {
  const pairs = dedupePairs(input.pairs);
  assertValidType(input.documentType);
  assertPairCount(pairs);
  await assertRefsExist(tx, pairs);

  const eligibilityRows = pairs.map((p) => ({
    serviceId: p.serviceId,
    nationalityCode: p.nationalityCode,
  }));
  const inserted = await tx
    .insert(schema.visaServiceEligibility)
    .values(eligibilityRows)
    .onConflictDoNothing()
    .returning({ serviceId: schema.visaServiceEligibility.serviceId });

  const requirementRows = pairs.map((p) => ({
    nationalityCode: p.nationalityCode,
    serviceId: p.serviceId,
    documentType: input.documentType,
    role: input.role,
  }));
  await tx
    .insert(schema.catalogDocumentRequirement)
    .values(requirementRows)
    .onConflictDoUpdate({
      target: [
        schema.catalogDocumentRequirement.nationalityCode,
        schema.catalogDocumentRequirement.serviceId,
        schema.catalogDocumentRequirement.documentType,
      ],
      set: { role: input.role },
    });

  return {
    pairCount: pairs.length,
    eligibilityCreated: inserted.length,
    upserted: pairs.length,
  };
};

export const removeDocumentRequirements = async (
  tx: DbTransaction,
  input: { documentType: string; pairs: TDocumentRequirementPair[] },
): Promise<{ deleted: number }> => {
  const pairs = dedupePairs(input.pairs);
  const serviceIds = [...new Set(pairs.map((p) => p.serviceId))];
  const requirementRows = await tx
    .select({
      id: schema.catalogDocumentRequirement.id,
      nationalityCode: schema.catalogDocumentRequirement.nationalityCode,
      serviceId: schema.catalogDocumentRequirement.serviceId,
      documentType: schema.catalogDocumentRequirement.documentType,
    })
    .from(schema.catalogDocumentRequirement)
    .where(inArray(schema.catalogDocumentRequirement.serviceId, serviceIds));
  const pairSet = new Set(pairs.map((p) => pairKey(p.nationalityCode, p.serviceId)));
  const ids = requirementRows
    .filter(
      (r) =>
        r.documentType === input.documentType &&
        pairSet.has(pairKey(r.nationalityCode, r.serviceId)),
    )
    .map((r) => r.id);
  if (ids.length === 0) return { deleted: 0 };
  const deleted = await tx
    .delete(schema.catalogDocumentRequirement)
    .where(inArray(schema.catalogDocumentRequirement.id, ids))
    .returning({ id: schema.catalogDocumentRequirement.id });
  return { deleted: deleted.length };
};

export const removeOneDocumentRequirement = async (
  tx: DbTransaction,
  id: string,
): Promise<void> => {
  const deleted = await tx
    .delete(schema.catalogDocumentRequirement)
    .where(inArray(schema.catalogDocumentRequirement.id, [id]))
    .returning({ id: schema.catalogDocumentRequirement.id });
  if (deleted.length === 0) {
    throw { code: "DOCUMENT_REQUIREMENTS_NOT_FOUND" };
  }
};

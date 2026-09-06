import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

export type TDocumentRequirementPair = { nationalityCode: string; serviceId: string };

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

export const previewDocumentRequirements = async (input: TDocumentRequirementAssignInput) =>
  fetchApiEnvelope<TDocumentRequirementAssignPreview>(
    apiHref("/admin/catalog/document-requirements/preview"),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
  );

export const assignDocumentRequirements = async (input: TDocumentRequirementAssignInput) =>
  fetchApiEnvelope<{ pairCount: number; eligibilityCreated: number; upserted: number }>(
    apiHref("/admin/catalog/document-requirements"),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
  );

export const removeDocumentRequirements = async (input: {
  documentType: string;
  pairs: TDocumentRequirementPair[];
}) =>
  fetchApiEnvelope<{ deleted: number }>(
    apiHref("/admin/catalog/document-requirements"),
    { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
  );

export const removeOneDocumentRequirement = async (id: string) =>
  fetchApiEnvelope<{ deleted: number }>(
    apiHref("/admin/catalog/document-requirements"),
    { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) },
  );

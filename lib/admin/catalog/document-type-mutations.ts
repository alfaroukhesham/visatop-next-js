import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { TCatalogDocumentType } from "@/lib/admin/catalog/document-type";

export const listDocumentTypes = async () =>
  fetchApiEnvelope<{ documents: TCatalogDocumentType[] }>(apiHref("/admin/catalog/document-types"));

export const createDocumentType = async (input: { label: string; description?: string }) =>
  fetchApiEnvelope<{ document: TCatalogDocumentType }>(apiHref("/admin/catalog/document-types"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const deleteDocumentType = async (key: string) =>
  fetchApiEnvelope<{ key: string; label: string; deletedRules: number }>(
    apiHref(`/admin/catalog/document-types/${encodeURIComponent(key)}`),
    { method: "DELETE" },
  );

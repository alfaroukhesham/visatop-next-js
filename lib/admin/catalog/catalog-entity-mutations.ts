import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

export const deleteCatalogNationality = async (code: string) =>
  fetchApiEnvelope<{ deleted: { code: string } }>(
    apiHref(`/admin/catalog/nationalities/${encodeURIComponent(code)}`),
    { method: "DELETE" },
  );

export const deleteCatalogVisaService = async (id: string) =>
  fetchApiEnvelope<{ deleted: { id: string } }>(
    apiHref(`/admin/catalog/visa-services/${encodeURIComponent(id)}`),
    { method: "DELETE" },
  );

import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

export async function linkCatalogEligibility({
  serviceId,
  nationalityCode,
  flash,
}: {
  serviceId: string;
  nationalityCode: string;
  flash: (t: string, err?: boolean) => void;
}) {
  const res = await fetchApiEnvelope<{ eligibility: unknown }>(apiHref("/admin/catalog/eligibility"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId, nationalityCode }),
  });
  if (!res.ok) {
    flash(res.error.message, true);
    throw new Error("fail");
  }
  flash("Eligibility saved (or already existed).");
}

export const linkCatalogEligibilityPairs = async (
  pairs: Array<{ serviceId: string; nationalityCode: string }>,
) =>
  fetchApiEnvelope<{ createdCount: number; dedupedCount: number }>(
    apiHref("/admin/catalog/eligibility"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs }),
    },
  );

export async function removeCatalogEligibility({
  serviceId,
  nationalityCode,
  flash,
}: {
  serviceId: string;
  nationalityCode: string;
  flash: (t: string, err?: boolean) => void;
}) {
  const res = await fetchApiEnvelope<{ deleted: unknown }>(apiHref("/admin/catalog/eligibility"), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId, nationalityCode }),
  });
  if (!res.ok) {
    flash(res.error.message, true);
    throw new Error("fail");
  }
  flash("Removed link.");
}

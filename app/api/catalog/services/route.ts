import { headers } from "next/headers";
import { listPublicServicesForNationality } from "@/lib/catalog/queries";
import {
  firstLocalCurrencyCode,
  loadLocalPricedServiceIds,
  loadVisibleCatalogCurrencies,
} from "@/lib/catalog/load-visible-catalog-currencies";
import { resolvePublicCatalogCurrencyQuery } from "@/lib/catalog/local-currency";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALPHA2 = /^[A-Z]{2}$/;

export const GET = async (req: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  const nationality = url.searchParams.get("nationality")?.trim().toUpperCase();
  if (!nationality || !ALPHA2.test(nationality)) {
    return jsonError("VALIDATION_ERROR", "Query `nationality` (ISO 3166-1 alpha-2) is required.", {
      status: 400,
      requestId,
    });
  }
  const rawCurrency = url.searchParams.get("currency")?.trim().toUpperCase() || null;

  const payload = await withSystemDbActor(async (tx) => {
    const visible = await loadVisibleCatalogCurrencies(tx, nationality);
    const localCode = firstLocalCurrencyCode(visible);
    const localPricedServiceIds = localCode
      ? await loadLocalPricedServiceIds(tx, nationality, localCode)
      : [];
    const resolved = resolvePublicCatalogCurrencyQuery({
      requested: rawCurrency,
      visible,
      localPricedServiceIds,
    });
    if (!resolved.ok) return { kind: "invalid_currency" as const };
    const services = await listPublicServicesForNationality(tx, nationality, resolved.currency);
    return {
      kind: "ok" as const,
      nationality,
      currency: resolved.currency,
      currencies: visible,
      localPricedServiceIds,
      services,
    };
  });

  if (payload.kind === "invalid_currency") {
    return jsonError("VALIDATION_ERROR", "Query `currency` is not available for this nationality.", {
      status: 400,
      requestId,
    });
  }

  return jsonOk(
    {
      nationality: payload.nationality,
      currency: payload.currency,
      currencies: payload.currencies,
      localPricedServiceIds: payload.localPricedServiceIds,
      services: payload.services,
    },
    { requestId },
  );
};

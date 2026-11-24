"use client";

import { useEffect, useState, type FC } from "react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import {
  formatMinorAmount,
  quoteUsesCodeFormat,
  type TClientQuotePreview,
} from "@/lib/apply/checkout-extras-ui";
import {
  catalogCurrencyTab,
  formatDisplayMinor,
  sumCatalogServicesTotalMinor,
  type TCatalogPricedService,
} from "@/lib/catalog/format-catalog-price";

interface IApplyOrderTotalProps {
  nationalityCode: string;
  currency: string;
  serviceIds: string[];
  applicationId?: string;
}

export const ApplyOrderTotal: FC<IApplyOrderTotalProps> = ({
  nationalityCode,
  currency,
  serviceIds,
  applicationId,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const [total, setTotal] = useState<string | null>(null);
  const serviceKey = serviceIds.join("|");
  const tab = catalogCurrencyTab(currency);
  useEffect(() => {
    let cancelled = false;
    const ids = serviceKey.split("|").filter(Boolean);
    const run = async () => {
      const quotePromise = applicationId
        ? fetchApiEnvelope<TClientQuotePreview>(
            apiHref(`/applications/${encodeURIComponent(applicationId)}/quote-preview`),
            { cache: "no-store" },
          )
        : Promise.resolve(null);
      const [quoteRes, catalogRes] = await Promise.all([
        quotePromise,
        fetchApiEnvelope<{ services: TCatalogPricedService[] }>(
          apiHref(
            `/catalog/services?nationality=${encodeURIComponent(nationalityCode)}&currency=${encodeURIComponent(tab)}`,
          ),
        ),
      ]);
      if (cancelled) return;
      const quote = quoteRes && quoteRes.ok ? quoteRes.data : null;
      if (quote && (quote.extraLines.length > 0 || quote.availableExtras.length > 0)) {
        setTotal(
          formatMinorAmount(
            quote.totalAmountMinor,
            quote.currency,
            locale,
            quoteUsesCodeFormat(quote) ? "code" : "symbol",
          ),
        );
        return;
      }
      if (!catalogRes.ok) return;
      const sum = sumCatalogServicesTotalMinor(catalogRes.data.services, ids, tab);
      if (sum === null || cancelled) return;
      setTotal(formatDisplayMinor(sum.toString(), tab));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applicationId, locale, nationalityCode, serviceKey, tab]);
  if (!total) return null;
  return (
    <p className="text-muted-foreground text-center text-sm">
      {t("wizard.orderTotal", { total })}
    </p>
  );
};

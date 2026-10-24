"use client";

import { useEffect, useState, type FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
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
}

export const ApplyOrderTotal: FC<IApplyOrderTotalProps> = ({ nationalityCode, currency, serviceIds }) => {
  const t = useCustomerT();
  const [total, setTotal] = useState<string | null>(null);
  const serviceKey = serviceIds.join("|");
  const tab = catalogCurrencyTab(currency);
  useEffect(() => {
    let cancelled = false;
    const ids = serviceKey.split("|").filter(Boolean);
    const run = async () => {
      const res = await fetchApiEnvelope<{ services: TCatalogPricedService[] }>(
        apiHref(
          `/catalog/services?nationality=${encodeURIComponent(nationalityCode)}&currency=${encodeURIComponent(tab)}`,
        ),
      );
      if (cancelled || !res.ok) return;
      const sum = sumCatalogServicesTotalMinor(res.data.services, ids, tab);
      if (sum === null) return;
      if (cancelled) return;
      setTotal(formatDisplayMinor(sum.toString(), tab));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [nationalityCode, serviceKey, tab]);
  if (!total) return null;
  return (
    <p className="text-muted-foreground text-center text-sm">
      {t("wizard.orderTotal", { total })}
    </p>
  );
};

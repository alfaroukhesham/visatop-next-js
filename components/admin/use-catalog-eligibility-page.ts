"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CatalogEligibility } from "@/lib/admin/catalog/catalog-types";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type EligibilityPageResponse = {
  items: CatalogEligibility[];
  total: number;
  page: number;
  pageSize: number;
};

export type CatalogEligibilityFilters = {
  q: string;
  serviceId: string;
  nationalityCode: string;
};

export const EMPTY_CATALOG_ELIGIBILITY_FILTERS: CatalogEligibilityFilters = {
  q: "",
  serviceId: "",
  nationalityCode: "",
};

export function useCatalogEligibilityPage(
  initialPageSize = 10,
  filters: CatalogEligibilityFilters = EMPTY_CATALOG_ELIGIBILITY_FILTERS,
) {
  const [page, setPageState] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [refreshToken, setRefreshToken] = useState(0);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<CatalogEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setPage: Dispatch<SetStateAction<number>> = useCallback((next) => {
    setLoading(true);
    setPageState(next);
  }, []);

  const onPageSizeChange = useCallback((next: number) => {
    setLoading(true);
    setPageSizeState(next);
    setPageState(0);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setRefreshToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const q = filters.q.trim();
      if (q) qs.set("q", q);
      if (filters.serviceId) qs.set("serviceId", filters.serviceId);
      if (filters.nationalityCode) qs.set("nationalityCode", filters.nationalityCode);
      const res = await fetchApiEnvelope<EligibilityPageResponse>(
        apiHref(`/admin/catalog/eligibility?${qs}`),
      );
      if (!active) return;

      if (!res.ok) {
        setError(res.error.message);
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      setError(null);
      setItems(res.data.items);
      setTotal(res.data.total);
      const maxPage = Math.max(0, Math.ceil(res.data.total / pageSize) - 1);
      if (page > maxPage) {
        setLoading(true);
        setPageState(maxPage);
        return;
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [page, pageSize, refreshToken, filters.q, filters.serviceId, filters.nationalityCode]);

  return {
    page,
    setPage,
    pageSize,
    onPageSizeChange,
    items,
    total,
    loading,
    error,
    reload,
  };
}

"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

export type CatalogDocumentRequirementItem = {
  id: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  documentType: string;
  role: string;
};

type PageResponse = {
  items: CatalogDocumentRequirementItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CatalogDocumentRequirementFilters = {
  nationalityCode: string;
  serviceId: string;
  documentType: string;
};

export const EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS: CatalogDocumentRequirementFilters = {
  nationalityCode: "",
  serviceId: "",
  documentType: "",
};

export function useCatalogDocumentRequirementsPage(
  initialPageSize = 10,
  filters: CatalogDocumentRequirementFilters = EMPTY_CATALOG_DOCUMENT_REQUIREMENT_FILTERS,
  refreshKey = 0,
) {
  const [page, setPageState] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [refreshToken, setRefreshToken] = useState(0);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<CatalogDocumentRequirementItem[]>([]);
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
      if (filters.nationalityCode) qs.set("nationalityCode", filters.nationalityCode);
      if (filters.serviceId) qs.set("serviceId", filters.serviceId);
      if (filters.documentType) qs.set("documentType", filters.documentType);
      const res = await fetchApiEnvelope<PageResponse>(
        apiHref(`/admin/catalog/document-requirements?${qs}`),
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
  }, [page, pageSize, refreshToken, refreshKey, filters.nationalityCode, filters.serviceId, filters.documentType]);

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

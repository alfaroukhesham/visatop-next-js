"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { buildListQueryString } from "@/lib/admin/build-list-query-string";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import {
  EMPTY_APPLICATIONS_FILTERS,
  type AdminApplicationsListResponse,
  type ApplicationsListFilters,
} from "@/components/admin/admin-applications-list-types";

export function useAdminApplicationsList(initialPageSize = 20) {
  const [appliedFilters, setAppliedFilters] =
    useState<ApplicationsListFilters>(EMPTY_APPLICATIONS_FILTERS);
  const [page, setPageState] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [refreshToken, setRefreshToken] = useState(0);
  const [items, setItems] = useState<AdminApplicationsListResponse["items"]>([]);
  const [total, setTotal] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
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

  const applyFilters = useCallback((filters: ApplicationsListFilters) => {
    setLoading(true);
    setItems([]);
    setAppliedFilters(filters);
    setPageState(0);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setRefreshToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const query = buildListQueryString({
        q: appliedFilters.q.trim() || undefined,
        status: appliedFilters.status || undefined,
        payment: appliedFilters.payment || undefined,
        fulfillment: appliedFilters.fulfillment || undefined,
        attention: appliedFilters.attention || undefined,
        page,
        pageSize,
      });

      const res = await fetchApiEnvelope<AdminApplicationsListResponse>(
        apiHref(`/admin/applications${query}`),
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
      setAttentionCount(res.data.attentionCount);
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
  }, [appliedFilters, page, pageSize, refreshToken]);

  return {
    appliedFilters,
    applyFilters,
    page,
    setPage,
    pageSize,
    onPageSizeChange,
    items,
    total,
    attentionCount,
    loading,
    error,
    reload,
  };
}

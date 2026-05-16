"use client";

import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function usePaginatedList<T>(items: T[], defaultPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
  const safePage = Math.min(page, maxPage);

  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );

  function onPageSizeChange(next: number) {
    setPageSize(next);
    setPage(0);
  }

  return {
    page: safePage,
    setPage,
    pageSize,
    onPageSizeChange,
    pageItems,
    total: items.length,
  };
}

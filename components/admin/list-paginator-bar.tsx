"use client";

import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ADMIN_LIST_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type ListPaginatorBarProps = {
  selectId: string;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  total: number;
  disabled?: boolean;
  loading?: boolean;
};

export function ListPaginatorBar({
  selectId,
  page,
  setPage,
  pageSize,
  onPageSizeChange,
  total,
  disabled,
  loading,
}: ListPaginatorBarProps) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="border-border flex flex-col gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={selectId} className="text-xs whitespace-nowrap">
          Rows per page
        </Label>
        <select
          id={selectId}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
        >
          {ADMIN_LIST_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <span className="tabular-nums inline-flex items-center gap-2">
        {loading ? <Loader2 className="admin-loading-spin size-3.5 shrink-0" aria-hidden /> : null}
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || total === 0 || (page + 1) * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

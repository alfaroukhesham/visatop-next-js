"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ListPaginatorBarProps = {
  selectId: string;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  total: number;
  disabled?: boolean;
};

export function ListPaginatorBar({
  selectId,
  page,
  setPage,
  pageSize,
  onPageSizeChange,
  total,
  disabled,
}: ListPaginatorBarProps) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={selectId} className="text-xs whitespace-nowrap">
          Rows per page
        </Label>
        <select
          id={selectId}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <span className="tabular-nums">
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

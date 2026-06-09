"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm";

export type AdminListFilterField =
  | {
      kind: "search";
      key: string;
      label: string;
      placeholder?: string;
    }
  | {
      kind: "select";
      key: string;
      label: string;
      options: readonly string[] | readonly { value: string; label: string }[];
      allLabel?: string;
    };

export type AdminListFiltersProps = {
  fields: AdminListFilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  canClear?: boolean;
  applying?: boolean;
  applyLabel?: string;
  className?: string;
};

function formatOptionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function normalizeOptions(
  options: readonly string[] | readonly { value: string; label: string }[],
) {
  return options.map((option) =>
    typeof option === "string"
      ? { value: option, label: formatOptionLabel(option) }
      : option,
  );
}

export function AdminListFilters({
  fields,
  values,
  onChange,
  onApply,
  onClear,
  canClear = false,
  applying = false,
  applyLabel = "Apply filters",
  className,
}: AdminListFiltersProps) {
  return (
    <search className={cn("border border-border bg-card p-4", className)}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_repeat(auto-fit,minmax(10rem,1fr))] lg:items-end">
        {fields.map((field) => {
          if (field.kind === "search") {
            return (
              <div key={field.key} className="space-y-1.5">
                <Label
                  htmlFor={`admin-filter-${field.key}`}
                  className="text-xs uppercase tracking-wide text-muted-foreground"
                >
                  {field.label}
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id={`admin-filter-${field.key}`}
                    value={values[field.key] ?? ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onApply();
                      }
                    }}
                    placeholder={field.placeholder}
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
              </div>
            );
          }

          const options = normalizeOptions(field.options);
          return (
            <div key={field.key} className="space-y-1.5">
              <Label
                htmlFor={`admin-filter-${field.key}`}
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                {field.label}
              </Label>
              <select
                id={`admin-filter-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={selectClassName}
              >
                <option value="">{field.allLabel ?? "All"}</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            type="button"
            disabled={applying}
            onClick={onApply}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-none")}
          >
            {applyLabel}
          </button>
          {canClear ? (
            <button
              type="button"
              disabled={applying}
              onClick={onClear}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-none")}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </search>
  );
}

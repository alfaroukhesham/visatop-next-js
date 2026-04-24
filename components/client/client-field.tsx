"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  /** Merged onto the internal `Label` (e.g. `sr-only`). */
  labelClassName?: string;
};

export function ClientField({
  id,
  label,
  hint,
  error,
  children,
  className,
  labelClassName,
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
      {error ? (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

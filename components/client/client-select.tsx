"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ClientSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-background text-foreground focus-visible:ring-ring h-11 w-full rounded-[5px] border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

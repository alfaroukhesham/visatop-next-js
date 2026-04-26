"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Link> & {
  active?: boolean;
  /** Links sitting on the ink (`#012031`) marketing header. */
  onInk?: boolean;
};

/**
 * Nav / in-app link with a 3px brand-yellow bottom bar on hover and when active.
 */
export function ClientNavLink({ className, active, onInk, ...props }: Props) {
  return (
    <Link
      className={cn(
        "relative inline-flex pb-1 transition-colors duration-200 ease-linear",
        onInk
          ? "text-white/75 hover:text-white after:bg-[#FCCD64]"
          : "text-foreground hover:text-foreground after:bg-primary",
        "rounded-sm outline-offset-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:origin-bottom after:scale-y-0 after:transition-transform after:duration-200 after:ease-linear",
        "hover:after:scale-y-100",
        active && "after:scale-y-100 font-semibold text-foreground",
        onInk && active && "text-white",
        className,
      )}
      {...props}
    />
  );
}

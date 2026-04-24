"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Input> & {
  invalid?: boolean;
};

export function ClientInput({ className, invalid, "aria-invalid": ariaInvalid, ...props }: Props) {
  return (
    <Input
      aria-invalid={invalid ? true : ariaInvalid}
      className={cn(
        "rounded-[5px] md:text-base",
        invalid &&
          "border-[color:var(--error)] aria-invalid:border-[color:var(--error)] aria-invalid:ring-[color:var(--error)]/25",
        className,
      )}
      {...props}
    />
  );
}

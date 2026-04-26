"use client";

import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type ClientBrandButton = "none" | "cta" | "blue" | "white";

const cta =
  "h-[46px] min-w-[148px] rounded-[5px] px-4 text-base font-semibold uppercase tracking-wide transition-[colors,transform] duration-200 ease-linear hover:bg-[#FFE19F]";
const blue =
  "h-[50px] min-w-[200px] rounded-[5px] border-0 px-4 text-[15px] font-medium !bg-secondary !text-secondary-foreground transition-colors duration-200 ease-linear hover:!bg-[#7095A7]";
const white =
  "h-[50px] min-w-[200px] rounded-[5px] border border-border !bg-white px-4 text-[15px] font-medium text-foreground shadow-sm transition-colors duration-200 ease-linear hover:!border-secondary hover:!bg-secondary hover:!text-white";

function brandClass(brand: ClientBrandButton) {
  if (brand === "cta") return cn(cta, "!bg-primary !text-primary-foreground");
  if (brand === "blue") return blue;
  if (brand === "white") return white;
  return "";
}

type BtnProps = ComponentProps<typeof Button> & { brand?: ClientBrandButton };

export function ClientButton({ brand = "none", className, variant, ...props }: BtnProps) {
  const resolvedVariant =
    variant ??
    (brand === "blue" ? "secondary" : brand === "white" ? "outline" : "default");
  const isDestructive = variant === "destructive" || resolvedVariant === "destructive";
  return (
    <Button
      variant={resolvedVariant}
      className={cn(
        brandClass(brand),
        isDestructive && "!bg-destructive !text-destructive-foreground hover:!bg-[#dc2626]",
        className,
      )}
      {...props}
    />
  );
}

type LinkProps = Omit<ComponentProps<typeof Link>, "className"> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    brand?: ClientBrandButton;
  };

/** Link styled as a button; keeps `buttonVariants` inside the client boundary only. */
export function ClientButtonLink({
  href,
  brand = "none",
  className,
  variant,
  size,
  children,
  ...props
}: LinkProps) {
  const resolvedVariant =
    variant ??
    (brand === "blue" ? "secondary" : brand === "white" ? "outline" : "default");
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: resolvedVariant, size }),
        brandClass(brand),
        resolvedVariant === "destructive" &&
          "!bg-destructive !text-destructive-foreground hover:!bg-[#dc2626]",
        "inline-flex items-center justify-center",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

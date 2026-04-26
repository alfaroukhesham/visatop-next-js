"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const presets = {
  hero: "rounded-[100px_0_100px_0]",
  highlight: "rounded-[40px_0_40px_0]",
  panel: "rounded-[20px_0_20px_0]",
} as const;

export type ClientSurfacePreset = keyof typeof presets;

type DivProps = ComponentProps<"div"> & {
  preset?: ClientSurfacePreset;
};

export function ClientSurface({ preset = "panel", className, ...props }: DivProps) {
  return (
    <div
      className={cn("border border-border bg-card text-card-foreground", presets[preset], className)}
      {...props}
    />
  );
}

export function ClientHeroPanel({ className, ...props }: Omit<DivProps, "preset">) {
  return <ClientSurface preset="hero" className={className} {...props} />;
}

"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { ClientButton } from "@/components/client/client-button";
import { ClientNavLink } from "@/components/client/client-nav-link";
import { cn } from "@/lib/utils";

type Props = {
  signOutAction: NonNullable<ComponentProps<"form">["action"]>;
  className?: string;
};

export function ClientPortalHeader({ signOutAction, className }: Props) {
  const path = usePathname() ?? "";

  return (
    <header
      className={cn(
        "border-b border-white/10 bg-[#012031]/98 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-[#012031]/92",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#92C0D7]">
            Signed in
          </p>
          <p className="font-heading text-lg font-semibold tracking-tight text-white">My Visatop</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" aria-label="Portal">
          <ClientNavLink href="/" onInk active={path === "/"}>
            Home
          </ClientNavLink>
          <ClientNavLink href="/apply/start" onInk active={path.startsWith("/apply") && !path.startsWith("/apply/track")}>
            Apply
          </ClientNavLink>
          <ClientNavLink href="/apply/track" onInk active={path.startsWith("/apply/track")}>
            Track
          </ClientNavLink>
          <ClientNavLink href="/portal" onInk active={path === "/portal"}>
            Overview
          </ClientNavLink>
        </nav>
        <form action={signOutAction}>
          <ClientButton
            type="submit"
            variant="outline"
            size="sm"
            className="border-white/25 text-white hover:border-[#FCCD64]/60 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </ClientButton>
        </form>
      </div>
    </header>
  );
}

"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps, FC } from "react";
import { ClientButton } from "@/components/client/client-button";
import { ClientNavLink } from "@/components/client/client-nav-link";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";

interface IClientPortalHeaderProps {
  signOutAction: NonNullable<ComponentProps<"form">["action"]>;
  className?: string;
}

export const ClientPortalHeader: FC<IClientPortalHeaderProps> = ({ signOutAction, className }) => {
  const path = usePathname() ?? "";
  const t = useCustomerT();

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
            {t("portal.headerSignedIn")}
          </p>
          <p className="font-heading text-lg font-semibold tracking-tight text-white">{t("portal.headerTitle")}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" aria-label={t("portal.navAriaLabel")}>
          <ClientNavLink href="/" onInk active={path === "/"}>
            {t("portal.navHome")}
          </ClientNavLink>
          <ClientNavLink
            href="/apply"
            onInk
            active={path.startsWith("/apply") && !path.startsWith("/apply/track")}
          >
            {t("portal.navApply")}
          </ClientNavLink>
          <ClientNavLink href="/apply/track" onInk active={path.startsWith("/apply/track")}>
            {t("portal.navTrack")}
          </ClientNavLink>
          <ClientNavLink href="/portal/track" onInk active={path.startsWith("/portal/track")}>
            {t("portal.navOverview")}
          </ClientNavLink>
        </nav>
        <form action={signOutAction}>
          <ClientButton
            type="submit"
            variant="outline"
            size="sm"
            className="border-white/25 text-white hover:border-[#FCCD64]/60 hover:bg-white/10 hover:text-white"
          >
            {t("header.signOut")}
          </ClientButton>
        </form>
      </div>
    </header>
  );
};

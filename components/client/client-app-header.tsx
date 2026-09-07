"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { ClientHeaderAuthSkeleton } from "@/components/client/client-loading";
import { ClientButtonLink } from "@/components/client/client-button";
import { authClient } from "@/lib/auth-client";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { cn } from "@/lib/utils";

interface IClientAppHeaderProps {
  className?: string;
}

/**
 * Auth-only bar below the WP header (Apply / Track live in WP chrome).
 */
export const ClientAppHeader: FC<IClientAppHeaderProps> = ({ className }) => {
  const t = useCustomerT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const storeSession = useClientAuthStore((s) => s.session);
  const storePending = useClientAuthStore((s) => s.isPending);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onSignOut = async () => {
    try {
      const api = authClient as unknown as { signOut?: () => Promise<unknown> };
      await api.signOut?.();
    } finally {
      router.refresh();
      router.push("/");
    }
  };

  const welcomeName =
    storeSession?.user.name?.trim() ||
    storeSession?.user.email?.split("@")[0] ||
    t("header.welcomeFallback");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-white/10 bg-[#012031]/98 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-[#012031]/92",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] items-center justify-end gap-x-2 gap-y-1 px-3 py-4">
        {!mounted || storePending ? (
          <ClientHeaderAuthSkeleton />
        ) : storeSession ? (
          <>
            <span
              className="text-white/90 min-w-0 max-w-[10rem] truncate text-xs sm:max-w-[18rem] sm:text-sm"
              title={
                storeSession.user.name?.trim() ||
                storeSession.user.email ||
                undefined
              }
            >
              {t("header.welcome", { name: welcomeName })}
            </span>
            <ClientButtonLink
              href="/portal/track"
              brand="cta"
              className="h-9 shrink-0 px-3 text-xs font-bold"
            >
              {t("header.account")}
            </ClientButtonLink>
            <button
              type="button"
              onClick={onSignOut}
              className="h-9 shrink-0 rounded-md border border-white/15 bg-transparent px-3 text-xs font-medium text-white transition-colors hover:border-[#FCCD64]/50 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92C0D7]"
            >
              {t("header.signOut")}
            </button>
          </>
        ) : (
          <ClientButtonLink
            href="/sign-in"
            brand="cta"
            className="h-9 shrink-0 px-3 text-xs font-bold"
          >
            {t("header.loginRegister")}
          </ClientButtonLink>
        )}
      </div>
    </header>
  );
};

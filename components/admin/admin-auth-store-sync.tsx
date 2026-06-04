"use client";

import { useEffect } from "react";
import { adminAuthClient } from "@/lib/admin-auth-client";
import { toClientSession } from "@/lib/stores/client-auth-session";
import { shouldRestoreAfterNavigation } from "@/lib/client/bfcache-restore";
import { useAdminAuthStore } from "@/lib/stores/admin-auth-store";

/** Mirrors Better Auth admin session into Zustand (one client subscription for the admin tree). */
export function AdminAuthStoreSync() {
  const { data: session, isPending, refetch } = adminAuthClient.useSession();
  const setSession = useAdminAuthStore((s) => s.setSession);
  const setPending = useAdminAuthStore((s) => s.setPending);

  useEffect(() => {
    setPending(isPending);
    setSession(toClientSession(session));
  }, [isPending, session, setPending, setSession]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!shouldRestoreAfterNavigation(event)) return;
      void refetch();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refetch]);

  return null;
}

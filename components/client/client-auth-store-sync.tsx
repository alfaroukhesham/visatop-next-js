"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { toClientSession } from "@/lib/stores/client-auth-session";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";

/**
 * Subscribes to Better Auth and mirrors session + pending into Zustand once for the whole client tree.
 */
export function ClientAuthStoreSync() {
  const { data: session, isPending } = authClient.useSession();
  const setSession = useClientAuthStore((s) => s.setSession);
  const setPending = useClientAuthStore((s) => s.setPending);

  useEffect(() => {
    setPending(isPending);
    setSession(toClientSession(session));
  }, [isPending, session, setPending, setSession]);

  return null;
}

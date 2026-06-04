"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ensureBfcacheRestoreListeners, ROUTER_REFRESH_EVENT } from "@/lib/client/bfcache-restore-init";

/**
 * Wires Next.js router.refresh to module-level bfcache restore listeners.
 */
export function BfcacheRestoreSync() {
  const router = useRouter();

  useEffect(() => {
    ensureBfcacheRestoreListeners();
    const onRouterRefresh = () => {
      requestAnimationFrame(() => {
        router.refresh();
      });
    };
    window.addEventListener(ROUTER_REFRESH_EVENT, onRouterRefresh);
    return () => window.removeEventListener(ROUTER_REFRESH_EVENT, onRouterRefresh);
  }, [router]);

  return null;
}

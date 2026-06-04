"use client";

import { useEffect, useRef } from "react";
import { subscribeBfcacheRestore } from "@/lib/client/bfcache-restore";

/** Re-run data loaders after a bfcache restore (mount effects do not fire again). */
export function useOnBfcacheRestore(handler: () => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => subscribeBfcacheRestore(() => handlerRef.current()), []);
}

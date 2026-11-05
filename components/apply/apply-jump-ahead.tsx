"use client";

import { createContext, useCallback, useContext, useState, type FC, type ReactNode } from "react";

interface IApplyJumpAheadValue {
  pulseContinue: boolean;
  pulse: () => void;
  clearPulse: () => void;
}

/** Scroll the sticky Continue bar into view only when it is not already fully on screen. */
export const ensureApplyStickyCtaVisible = (): void => {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>("[data-apply-sticky-cta]");
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const fullyVisible = rect.height > 0 && rect.top >= -1 && rect.bottom <= viewportHeight + 1;
  if (fullyVisible) return;
  el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
};

const ApplyJumpAheadContext = createContext<IApplyJumpAheadValue | null>(null);

interface IApplyJumpAheadProviderProps {
  children: ReactNode;
}

export const ApplyJumpAheadProvider: FC<IApplyJumpAheadProviderProps> = ({ children }) => {
  const [pulseContinue, setPulseContinue] = useState(false);
  const pulse = useCallback(() => {
    ensureApplyStickyCtaVisible();
    setPulseContinue(false);
    queueMicrotask(() => setPulseContinue(true));
  }, []);
  const clearPulse = useCallback(() => setPulseContinue(false), []);
  return (
    <ApplyJumpAheadContext.Provider value={{ pulseContinue, pulse, clearPulse }}>
      {children}
    </ApplyJumpAheadContext.Provider>
  );
};

export const useApplyJumpAhead = (): IApplyJumpAheadValue => {
  const ctx = useContext(ApplyJumpAheadContext);
  if (!ctx) {
    return {
      pulseContinue: false,
      pulse: () => undefined,
      clearPulse: () => undefined,
    };
  }
  return ctx;
};

"use client";

import { useEffect, type RefObject } from "react";

/** Size the in-flow spacer from the fixed bar, at 1024px and narrower. */
export const useStickyCtaHeight = (
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): void => {
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.style.removeProperty("--apply-sticky-cta-height");
      return;
    }
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height <= 0) return;
      root.style.setProperty("--apply-sticky-cta-height", `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--apply-sticky-cta-height");
    };
  }, [enabled, ref]);
};

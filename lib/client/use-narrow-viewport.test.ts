/** @vitest-environment jsdom */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NARROW_VIEWPORT_MEDIA_QUERY, useNarrowViewport } from "./use-narrow-viewport";

const installMatchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches,
    media: NARROW_VIEWPORT_MEDIA_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: EventListener) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: (_type: string, listener: EventListener) => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  } as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => media,
  });
  return { media, listeners };
};

describe("useNarrowViewport", () => {
  afterEach(() => {
    cleanup();
  });

  it("is true when the viewport is 414px or narrower", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(true);
  });

  it("stays false when the viewport is wider than 414px", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(false);
  });
});

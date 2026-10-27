"use client";

import { useLayoutEffect, useState } from "react";

/** Phone portrait and 200% zoom of a 375px frame (~188px CSS viewport). */
export const NARROW_VIEWPORT_MAX_WIDTH_PX = 414;
export const NARROW_VIEWPORT_MEDIA_QUERY = `(max-width: ${NARROW_VIEWPORT_MAX_WIDTH_PX}px)`;

export const useNarrowViewport = (query: string = NARROW_VIEWPORT_MEDIA_QUERY): boolean => {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => {
      setMatches(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, [query]);

  return matches;
};

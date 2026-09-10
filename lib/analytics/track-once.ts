/** In-memory + sessionStorage claim so funnel events do not refire on remounts. */

const claimed = new Set<string>();

const storageKey = (dedupeKey: string): string => `vt_ga4_once:${dedupeKey}`;

export const resetAnalyticsOnceClaims = (): void => {
  claimed.clear();
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("vt_ga4_once:")) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
};

export const claimAnalyticsOnce = (dedupeKey: string): boolean => {
  const key = storageKey(dedupeKey);
  if (claimed.has(key)) return false;
  if (typeof sessionStorage !== "undefined") {
    try {
      if (sessionStorage.getItem(key)) {
        claimed.add(key);
        return false;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — memory still dedupes this JS context */
    }
  }
  claimed.add(key);
  return true;
};

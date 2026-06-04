/** Dispatched when the page is restored from the browser back-forward cache. */
export const BFCACHE_RESTORE_EVENT = "visatop:bfcache-restore";

const LEFT_PAGE_STORAGE_KEY = "visatop:left-page";

/** Set when the user leaves this document (pagehide / freeze). */
let returnedAfterPageHide = false;

/** Survives bfcache in the same JS heap; second+ pageshow means user returned. */
let pageShowCount = 0;

export function markDocumentHidden(): void {
  returnedAfterPageHide = true;
  try {
    sessionStorage.setItem(LEFT_PAGE_STORAGE_KEY, "1");
  } catch {
    /* private browsing / storage disabled */
  }
}

function hasReturnAfterPageHide(): boolean {
  if (returnedAfterPageHide) return true;
  try {
    return sessionStorage.getItem(LEFT_PAGE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function acknowledgeReturnAfterPageHide(): void {
  returnedAfterPageHide = false;
}

/** True when the user returned via Back/Forward (includes bfcache and full restoration). */
export function shouldRestoreAfterNavigation(event: PageTransitionEvent): boolean {
  pageShowCount += 1;
  if (event.persisted) return true;
  if (hasReturnAfterPageHide()) {
    acknowledgeReturnAfterPageHide();
    return true;
  }
  if (pageShowCount > 1) return true;
  const entry = performance.getEntriesByType("navigation")[0];
  if (entry && "type" in entry) {
    return (entry as PerformanceNavigationTiming).type === "back_forward";
  }
  return false;
}

export function getPageShowCount(): number {
  return pageShowCount;
}

export function dispatchBfcacheRestore(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BFCACHE_RESTORE_EVENT));
}

export function subscribeBfcacheRestore(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = () => handler();
  window.addEventListener(BFCACHE_RESTORE_EVENT, wrapped);
  return () => window.removeEventListener(BFCACHE_RESTORE_EVENT, wrapped);
}

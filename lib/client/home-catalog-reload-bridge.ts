"use client";

/** Latest home catalog reload callback (set by HomeNationalityStart). */
const reloadRef: { fn: (() => void) | null } = { fn: null };

let pendingRestore = false;
let retryScheduled = false;
let retryCount = 0;
const MAX_RELOAD_RETRIES = 120;

function clearLeftPageMarker(): void {
  try {
    sessionStorage.removeItem("visatop:left-page");
  } catch {
    /* ignore */
  }
}

function hasLeftPageMarker(): boolean {
  try {
    return sessionStorage.getItem("visatop:left-page") === "1";
  } catch {
    return false;
  }
}

function scheduleReloadRetry(): void {
  if (retryScheduled || retryCount >= MAX_RELOAD_RETRIES) return;
  retryScheduled = true;
  retryCount += 1;
  requestAnimationFrame(() => {
    retryScheduled = false;
    reloadHomeCatalogIfReturning();
  });
}

export function setHomeCatalogReload(fn: (() => void) | null): void {
  reloadRef.fn = fn;
  if (fn && pendingRestore) {
    reloadHomeCatalogIfReturning();
  }
}

/** Run home catalog reload when returning; leaves marker until fetch is triggered. */
export function reloadHomeCatalogIfReturning(): void {
  if (!hasLeftPageMarker()) {
    pendingRestore = false;
    return;
  }
  if (!reloadRef.fn) {
    pendingRestore = true;
    scheduleReloadRetry();
    return;
  }
  pendingRestore = false;
  retryCount = 0;
  reloadRef.fn();
}

export { clearLeftPageMarker };

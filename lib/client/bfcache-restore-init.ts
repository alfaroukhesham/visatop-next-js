"use client";

/**
 * Register navigation lifecycle listeners at module load (not in useEffect).
 * Survives bfcache restore with the same JS heap; React effects may not re-run.
 */
import {
  dispatchBfcacheRestore,
  markDocumentHidden,
  shouldRestoreAfterNavigation,
} from "@/lib/client/bfcache-restore";

export const ROUTER_REFRESH_EVENT = "visatop:router-refresh";

const LEAVING_STORAGE_KEY = "visatop:leaving";

let registered = false;
let restoreScheduled = false;

function runRestore(): void {
  dispatchBfcacheRestore();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(ROUTER_REFRESH_EVENT));
    });
  });
}

function scheduleRestore(_reason: string, _event?: PageTransitionEvent): void {
  if (restoreScheduled) return;
  restoreScheduled = true;
  queueMicrotask(() => {
    restoreScheduled = false;
    runRestore();
  });
}

function onPageShow(event: PageTransitionEvent): void {
  try {
    sessionStorage.removeItem(LEAVING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const should =
    shouldRestoreAfterNavigation(event) ||
    (() => {
      try {
        return sessionStorage.getItem("visatop:left-page") === "1";
      } catch {
        return false;
      }
    })();
  if (should) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scheduleRestore("pageshow", event));
    });
  }
}

function onPageHide(): void {
  markDocumentHidden();
  try {
    sessionStorage.setItem(LEAVING_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function onFreeze(): void {
  markDocumentHidden();
}

function onResume(): void {
  scheduleRestore("resume");
}

function shouldRestoreFromSessionMarker(): boolean {
  try {
    if (sessionStorage.getItem(LEAVING_STORAGE_KEY) === "1") return false;
    return sessionStorage.getItem("visatop:left-page") === "1";
  } catch {
    return false;
  }
}

function onVisibility(): void {
  if (document.visibilityState !== "visible") return;
  if (!shouldRestoreFromSessionMarker()) return;
  scheduleRestore("visibility");
}

/** Returning to this document often delivers `focus` before `pageshow` (Playwright + Safari). */
function onWindowFocus(): void {
  if (!shouldRestoreFromSessionMarker()) return;
  scheduleRestore("focus");
}

export function ensureBfcacheRestoreListeners(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;

  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("freeze", onFreeze);
  document.addEventListener("resume", onResume);
  document.addEventListener("visibilitychange", onVisibility);
}

if (typeof window !== "undefined") {
  ensureBfcacheRestoreListeners();
}

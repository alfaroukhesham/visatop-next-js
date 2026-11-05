"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { formatAdminRelativeTime } from "@/lib/applications/application-last-step";
import type { TAdminLastStepView } from "@/lib/applications/application-last-step";

/** Single poll interval for the admin last-step field (manual refresh restarts this). */
export const ADMIN_LAST_STEP_POLL_MS = 15_000;

export const ADMIN_LAST_STEP_LIVE_HINT = `Live applicants updates every ${ADMIN_LAST_STEP_POLL_MS / 1000} seconds`;

export const formatAdminLastStepStaleCue = (at: Date, now: Date = new Date()): string => {
  const diffMin = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (diffMin < 1) return "Last updated just now";
  if (diffMin < 60) return `Last updated ${diffMin} min ago`;
  return `Last updated ${formatAdminRelativeTime(at, now)}`;
};

const isLastStepView = (value: unknown): value is TAdminLastStepView => {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.fieldLabel === "string" &&
    typeof rec.value === "string" &&
    typeof rec.secondary === "string"
  );
};

export const useAdminApplicationLastStep = (input: {
  applicationId: string;
  initial: TAdminLastStepView;
}): {
  lastStep: TAdminLastStepView;
  fetching: boolean;
  stale: boolean;
  lastSuccessAt: Date;
  refresh: () => Promise<void>;
} => {
  const [lastStep, setLastStep] = useState<TAdminLastStepView>(input.initial);
  const [fetching, setFetching] = useState(false);
  const [stale, setStale] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState(() => new Date());
  const inFlightRef = useRef(false);
  const intervalIdRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const stop = useCallback(() => {
    if (intervalIdRef.current === null) return;
    window.clearInterval(intervalIdRef.current);
    intervalIdRef.current = null;
  }, []);

  const fetchLatest = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setFetching(true);
    try {
      const res = await fetchApiEnvelope<TAdminLastStepView>(
        apiHref(`/admin/applications/${encodeURIComponent(input.applicationId)}/last-step`),
        { method: "GET", cache: "no-store" },
      );
      if (cancelledRef.current) return;
      if (!res.ok || !isLastStepView(res.data)) {
        setStale(true);
        return;
      }
      setLastStep(res.data);
      setLastSuccessAt(new Date());
      setStale(false);
    } catch {
      if (!cancelledRef.current) setStale(true);
    } finally {
      inFlightRef.current = false;
      if (!cancelledRef.current) setFetching(false);
    }
  }, [input.applicationId]);

  const start = useCallback(() => {
    if (cancelledRef.current || intervalIdRef.current !== null) return;
    intervalIdRef.current = window.setInterval(() => {
      if (document.hidden) return;
      void fetchLatest();
    }, ADMIN_LAST_STEP_POLL_MS);
  }, [fetchLatest]);

  const restart = useCallback(() => {
    stop();
    start();
  }, [start, stop]);

  const refresh = useCallback(async () => {
    await fetchLatest();
    restart();
  }, [fetchLatest, restart]);

  useEffect(() => {
    cancelledRef.current = false;
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void fetchLatest();
      restart();
    };
    const onFocus = () => {
      if (document.hidden) return;
      void fetchLatest();
      restart();
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelledRef.current = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchLatest, restart, start, stop]);

  return { lastStep, fetching, stale, lastSuccessAt, refresh };
};

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import { UPLOAD_MAX_BYTES, type DocType, type ExtractResponse, type PublicDocument } from "./types";
import { latestByType } from "./utils";

export function useApplicationDraft(applicationId: string) {
  const router = useRouter();
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [docs, setDocs] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }): Promise<{
      application: PublicApplication;
      documents: PublicDocument[];
    } | null> => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      const [appRes, docsRes] = await Promise.all([
        fetchApiEnvelope<{ application: PublicApplication }>(apiHref(`/applications/${applicationId}`)),
        fetchApiEnvelope<{ documents: PublicDocument[] }>(apiHref(`/applications/${applicationId}/documents`)),
      ]);
      if (!silent) setLoading(false);
      if (!appRes.ok) {
        setApp(null);
        setError(appRes.error.message);
        return null;
      }
      const nextApp = appRes.data.application;
      setApp(nextApp);
      let nextDocs: PublicDocument[] = [];
      if (docsRes.ok) {
        nextDocs = docsRes.data.documents;
        setDocs(nextDocs);
      }
      return { application: nextApp, documents: nextDocs };
    },
    [applicationId],
  );

  const cancelCheckout = useCallback(async () => {
    setActionMsg(null);
    const res = await fetchApiEnvelope(apiHref(`/applications/${applicationId}/checkout-cancel`), {
      method: "POST",
    });
    if (!res.ok) {
      setActionMsg(res.error.message);
      return;
    }
    setCountdown(null);
    setActionMsg("Checkout cancelled.");
    await load({ silent: true });
  }, [applicationId, load]);

  const runExtract = useCallback(async () => {
    setExtracting(true);
    setActionMsg(null);
    const res = await fetchApiEnvelope<ExtractResponse>(apiHref(`/applications/${applicationId}/extract`), {
      method: "POST",
    });
    setExtracting(false);
    if (!res.ok) {
      setActionMsg(res.error.message);
      await load({ silent: true });
      return;
    }
    setExtractResult(res.data);
    const s = res.data.extraction.status;
    if (s === "succeeded") {
      setActionMsg("We filled in what we could. Review your details below.");
    } else if (s === "needs_manual") {
      setActionMsg("We couldn’t read everything. Please enter the remaining details manually.");
    } else {
      setActionMsg("We couldn’t read your passport. Please enter the details manually.");
    }
    await load({ silent: true });
  }, [applicationId, load]);

  const onUpload = useCallback(
    async (type: DocType, file: File) => {
      if (file.size > UPLOAD_MAX_BYTES) {
        setActionMsg("File exceeds 8MB limit.");
        return;
      }
      setActionMsg(null);
      setUploading(type);
      const form = new FormData();
      form.set("documentType", type);
      form.set("file", file);
      const res = await fetch(apiHref(`/applications/${applicationId}/documents/upload`), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      setUploading(null);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg =
          json?.error?.message ??
          (res.status === 413 ? "File exceeds 8MB limit." : `Upload failed (HTTP ${res.status})`);
        setActionMsg(msg);
        return;
      }
      setActionMsg(`${type.replace("_", " ")} uploaded.`);
      const data = await load({ silent: true });
      if (type === "passport_copy" && data && latestByType(data.documents, "passport_copy")) {
        void runExtract();
      }
    },
    [applicationId, load, runExtract],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (app?.paymentStatus === "checkout_created") {
      const interval = setInterval(() => void load({ silent: true }), 2000);
      return () => clearInterval(interval);
    }
  }, [app?.paymentStatus, load]);

  useEffect(() => {
    if (app?.paymentStatus !== "paid") return;
    router.replace(`/apply/applications/${encodeURIComponent(applicationId)}/submitted`);
  }, [app?.paymentStatus, applicationId, router]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0) {
      queueMicrotask(() => void cancelCheckout());
    }
  }, [countdown, cancelCheckout]);

  const passport = useMemo(() => latestByType(docs, "passport_copy"), [docs]);
  const photo = useMemo(() => latestByType(docs, "personal_photo"), [docs]);
  const attemptsUsed = extractResult?.extraction.attemptsUsed ?? 0;
  const attemptsLeft = Math.max(0, 2 - attemptsUsed);

  return {
    app,
    loading,
    error,
    actionMsg,
    setActionMsg,
    uploading,
    extracting,
    extractResult,
    countdown,
    setCountdown,
    load,
    cancelCheckout,
    onUpload,
    passport,
    photo,
    attemptsLeft,
  };
}

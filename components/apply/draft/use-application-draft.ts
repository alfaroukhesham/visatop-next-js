"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import { resolveDocumentRequirements, type TDocumentSlot } from "@/lib/apply/document-requirements";
import { nationalityDisplayName } from "@/lib/apply/display-names";
import { oversizedUploadMessage } from "@/lib/apply/customer-upload-copy";
import { UPLOAD_MAX_BYTES, type DocType, type ExtractResponse, type PublicDocument } from "./types";
import { latestByType } from "./utils";

type CatalogService = {
  id: string;
  name: string;
  durationDays: number | null;
  documentTypes?: Array<{ key: string; role: "required" | "additional" }>;
};

type CatalogNationality = {
  code: string;
  name: string;
};

export function useApplicationDraft(applicationId: string) {
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [docs, setDocs] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [service, setService] = useState<CatalogService | null>(null);
  const [nationalities, setNationalities] = useState<CatalogNationality[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const load = useCallback(
    async (opts?: { silent?: boolean }): Promise<{
      application: PublicApplication;
      documents: PublicDocument[];
    } | null> => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      let appRes: Awaited<ReturnType<typeof fetchApiEnvelope<{ application: PublicApplication }>>>;
      let docsRes: Awaited<ReturnType<typeof fetchApiEnvelope<{ documents: PublicDocument[] }>>>;
      try {
        [appRes, docsRes] = await Promise.all([
          fetchApiEnvelope<{ application: PublicApplication }>(apiHref(`/applications/${applicationId}`)),
          fetchApiEnvelope<{ documents: PublicDocument[] }>(apiHref(`/applications/${applicationId}/documents`)),
        ]);
      } finally {
        if (!silent) setLoading(false);
      }
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

  useEffect(() => {
    if (!app) return;
    let cancelled = false;
    setDocsLoading(true);
    const currency = app.catalogCurrency?.toUpperCase() === "AED" ? "AED" : "USD";
    queueMicrotask(() => {
      void (async () => {
        const [servicesRes, nationalitiesRes] = await Promise.all([
          fetchApiEnvelope<{ services: CatalogService[] }>(
            apiHref(
              `/catalog/services?nationality=${encodeURIComponent(app.nationalityCode)}&currency=${encodeURIComponent(currency)}`,
            ),
          ),
          fetchApiEnvelope<{ nationalities: CatalogNationality[] }>(
            apiHref("/catalog/nationalities"),
          ),
        ]);
        if (cancelled) return;
        if (servicesRes.ok) {
          setService(servicesRes.data.services.find((s) => s.id === app.serviceId) ?? null);
        }
        if (nationalitiesRes.ok) {
          setNationalities(nationalitiesRes.data.nationalities);
        }
        setDocsLoading(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [app?.nationalityCode, app?.serviceId, app?.catalogCurrency]);

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

  // slots follow the last catalog payload; a mid-session admin edit appears after remount or nationality / service / currency change.
  const slots = useMemo<TDocumentSlot[]>(
    () =>
      resolveDocumentRequirements(
        (service?.documentTypes ?? []).map((d) => ({
          documentType: d.key,
          role: d.role,
        })),
      ),
    [service],
  );

  const nationalityName = useMemo(
    () => nationalityDisplayName(app?.nationalityCode ?? "", nationalities),
    [app?.nationalityCode, nationalities],
  );

  const docsByType = useMemo(() => {
    const map: Partial<Record<DocType, PublicDocument | null>> = {};
    for (const slot of slots) {
      map[slot.key as DocType] = latestByType(docs, slot.key as DocType);
    }
    return map;
  }, [slots, docs]);

  const onUpload = useCallback(
    async (type: DocType, file: File) => {
      const tooLarge = oversizedUploadMessage(file.size, UPLOAD_MAX_BYTES);
      if (tooLarge) {
        setActionMsg(tooLarge);
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
      const slot = slots.find((s) => s.key === type);
      setActionMsg(slot ? `${slot.label} uploaded.` : "Document uploaded.");
      const data = await load({ silent: true });
      if (type === "passport_copy" && data && latestByType(data.documents, "passport_copy")) {
        void runExtract();
      }
    },
    [applicationId, load, runExtract, slots],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useOnBfcacheRestore(() => {
    void load();
  });

  useEffect(() => {
    if (app?.paymentStatus === "checkout_created") {
      const interval = setInterval(() => void load({ silent: true }), 2000);
      return () => clearInterval(interval);
    }
  }, [app?.paymentStatus, load]);

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
    slots,
    docsByType,
    docsLoading,
    passport,
    photo,
    nationalityName,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import {
  slotsForPartyMember,
  type TPublicPartyMember,
} from "@/lib/applications/load-party-members";
import {
  resolveDocumentRequirements,
  type TDocumentSlot,
} from "@/lib/apply/document-requirements";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { nationalityDisplayName } from "@/lib/apply/display-names";
import { oversizedUploadMessage } from "@/lib/apply/customer-upload-copy";
import { prepareClientUploadFile } from "@/lib/apply/client-image-prep";
import { translateDocumentSlot } from "@/lib/apply/document-slot-i18n";
import { uploadFormDataWithProgress } from "@/lib/apply/upload-xhr";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { trackDocumentUploadAnalytics, type TDocumentUploadSource } from "@/lib/analytics/document-upload-events";
import { trackEventOnce } from "@/lib/analytics/gtag-client";
import { buildOcrReviewParams } from "@/lib/analytics/ocr-review-params";
import { buildUploadErrorDataLayerPayload, pushUploadErrorDataLayer } from "@/lib/analytics/upload-error-datalayer";
import { uploadFailureReason } from "@/lib/analytics/upload-failure";
import {
  buildUploadPresence,
  memberUploadStateFromDraft,
} from "@/lib/apply/payment-upload-presence";
import {
  UPLOAD_MAX_BYTES,
  type DocType,
  type ExtractResponse,
  type PublicDocument,
  type TUploadSlotError,
} from "./types";
import { latestByType } from "./utils";

type CatalogNationality = {
  code: string;
  name: string;
  dialCode: string | null;
};

type TMemberState = {
  app: PublicApplication | null;
  docs: PublicDocument[];
  slots: TDocumentSlot[];
  docsByType: Partial<Record<DocType, PublicDocument | null>>;
  passport: PublicDocument | null;
  photo: PublicDocument | null;
  nationalityName: string;
  docsLoading: boolean;
  uploading: DocType | null;
  uploadPercent: number | null;
  lastUploadErrors: Partial<Record<DocType, TUploadSlotError | null>>;
  extracting: boolean;
  extractResult: ExtractResponse | null;
};

const emptyMemberState = (): TMemberState => ({
  app: null,
  docs: [],
  slots: resolveDocumentRequirements([]),
  docsByType: {},
  passport: null,
  photo: null,
  nationalityName: "",
  docsLoading: true,
  uploading: null,
  uploadPercent: null,
  lastUploadErrors: {},
  extracting: false,
  extractResult: null,
});

export function useApplicationDraft(applicationId: string) {
  const t = useCustomerT();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [members, setMembers] = useState<TPublicPartyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(applicationId);
  const [memberStates, setMemberStates] = useState<Record<string, TMemberState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nationalities, setNationalities] = useState<CatalogNationality[]>([]);

  const memberStatesRef = useRef<Record<string, TMemberState>>({});
  const nationalitiesRef = useRef<CatalogNationality[]>([]);

  const updateMemberState = useCallback((memberId: string, patch: Partial<TMemberState>) => {
    const next = { ...(memberStatesRef.current[memberId] ?? emptyMemberState()), ...patch };
    memberStatesRef.current = { ...memberStatesRef.current, [memberId]: next };
    setMemberStates(memberStatesRef.current);
  }, []);

  const loadMemberData = useCallback(
    async (memberId: string) => {
      const [appRes, docsRes] = await Promise.all([
        fetchApiEnvelope<{
          application: PublicApplication;
          members: TPublicPartyMember[];
        }>(apiHref(`/applications/${memberId}`)),
        fetchApiEnvelope<{ documents: PublicDocument[] }>(apiHref(`/applications/${memberId}/documents`)),
      ]);
      if (!appRes.ok) return;
      const memberApp = appRes.data.application;
      const docs = docsRes.ok ? docsRes.data.documents : [];
      const slots = slotsForPartyMember(appRes.data.members ?? [], memberId);
      const docsByType: Partial<Record<DocType, PublicDocument | null>> = {};
      for (const slot of slots) {
        docsByType[slot.key as DocType] = latestByType(docs, slot.key as DocType);
      }
      updateMemberState(memberId, {
        app: memberApp,
        docs,
        slots,
        docsByType,
        passport: latestByType(docs, "passport_copy"),
        photo: latestByType(docs, "personal_photo"),
        nationalityName: nationalityDisplayName(
          memberApp.nationalityCode ?? "",
          nationalitiesRef.current,
        ),
        docsLoading: false,
      });
    },
    [updateMemberState],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }): Promise<{
      application: PublicApplication;
      documents: PublicDocument[];
    } | null> => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      const appRes = await fetchApiEnvelope<{
        application: PublicApplication;
        members: TPublicPartyMember[];
      }>(apiHref(`/applications/${applicationId}`));
      if (!appRes.ok) {
        setApp(null);
        setError(appRes.error.message);
        if (!silent) setLoading(false);
        return null;
      }
      const nextApp = appRes.data.application;
      const nextMembers = appRes.data.members ?? [];
      setApp(nextApp);
      setMembers(nextMembers);
      setSelectedMemberId((prev) =>
        nextMembers.some((m) => m.applicationId === prev) ? prev : nextApp.id,
      );
      if (nationalitiesRef.current.length === 0) {
        const natRes = await fetchApiEnvelope<{ nationalities: CatalogNationality[] }>(
          apiHref("/catalog/nationalities"),
        );
        if (natRes.ok) {
          nationalitiesRef.current = natRes.data.nationalities;
          setNationalities(natRes.data.nationalities);
        }
      }
      await Promise.all(nextMembers.map((m) => loadMemberData(m.applicationId)));
      if (!silent) setLoading(false);
      return {
        application: nextApp,
        documents: memberStatesRef.current[nextApp.id]?.docs ?? [],
      };
    },
    [applicationId, loadMemberData],
  );

  const extractPromiseRef = useRef(Promise.resolve());
  const uploadAbortRef = useRef<AbortController | null>(null);

  const reportUploadFailure = useCallback(
    (
      type: DocType,
      memberId: string,
      file: File,
      source: TDocumentUploadSource,
      code: string,
      httpStatus?: number,
    ) => {
      const current = memberStatesRef.current[memberId] ?? emptyMemberState();
      updateMemberState(memberId, {
        uploading: null,
        uploadPercent: null,
        lastUploadErrors: { ...current.lastUploadErrors, [type]: { code } },
      });
      pushUploadErrorDataLayer(buildUploadErrorDataLayerPayload({ code, file }));
      trackDocumentUploadAnalytics({
        docType: type,
        applicationId: memberId,
        success: false,
        source,
        failureReason: uploadFailureReason({
          oversized: code === "FILE_TOO_LARGE",
          network: code === "NETWORK" || code === "TIMEOUT",
          httpStatus,
        }),
      });
    },
    [updateMemberState],
  );

  const runExtract = useCallback(async () => {
    const memberId = selectedMemberId;
    const work = (async () => {
      updateMemberState(memberId, { extracting: true });
      setActionMsg(null);
      const res = await fetchApiEnvelope<ExtractResponse>(
        apiHref(`/applications/${memberId}/extract`),
        { method: "POST" },
      );
      updateMemberState(memberId, { extracting: false });
      if (!res.ok) {
        setActionMsg(res.error.message);
        await load({ silent: true });
        return;
      }
      updateMemberState(memberId, { extractResult: res.data });
      const s = res.data.extraction.status;
      const review = buildOcrReviewParams({
        applicationId: memberId,
        documentId: res.data.extraction.documentId,
        status: s,
        missingFields: res.data.extraction.ocrMissingFields ?? [],
      });
      if (review) {
        trackEventOnce(
          APPLY_FUNNEL_EVENTS.ocrReviewRequired,
          review,
          `${APPLY_FUNNEL_EVENTS.ocrReviewRequired}:${memberId}:${res.data.extraction.documentId ?? s}`,
        );
      }
      if (s === "succeeded") {
        setActionMsg(tRef.current("draft.actionMessages.ocrPartial"));
      } else if (s === "needs_manual") {
        setActionMsg(tRef.current("draft.actionMessages.ocrManual"));
      } else {
        setActionMsg(tRef.current("draft.actionMessages.ocrFailed"));
      }
      await load({ silent: true });
    })();
    extractPromiseRef.current = work;
    await work;
  }, [selectedMemberId, load, updateMemberState]);

  const waitForPassportExtract = useCallback(async () => {
    await extractPromiseRef.current;
  }, []);

  const cancelInFlightUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
  }, []);

  const onUpload = useCallback(
    async (type: DocType, file: File, source: TDocumentUploadSource = "file") => {
      const memberId = selectedMemberId;
      const current = memberStatesRef.current[memberId] ?? emptyMemberState();
      const tooLarge = oversizedUploadMessage(file.size, UPLOAD_MAX_BYTES, tRef.current);
      if (tooLarge) {
        reportUploadFailure(type, memberId, file, source, "FILE_TOO_LARGE", 413);
        return;
      }

      uploadAbortRef.current?.abort();
      const abort = new AbortController();
      uploadAbortRef.current = abort;

      updateMemberState(memberId, {
        uploading: type,
        uploadPercent: 0,
        lastUploadErrors: { ...current.lastUploadErrors, [type]: null },
      });
      setActionMsg(null);

      let prepared = file;
      try {
        prepared = await prepareClientUploadFile(file);
      } catch {
        prepared = file;
      }
      if (abort.signal.aborted) {
        updateMemberState(memberId, { uploading: null, uploadPercent: null });
        return;
      }

      const stillTooLarge = oversizedUploadMessage(prepared.size, UPLOAD_MAX_BYTES, tRef.current);
      if (stillTooLarge) {
        reportUploadFailure(type, memberId, file, source, "FILE_TOO_LARGE", 413);
        return;
      }

      const form = new FormData();
      form.set("documentType", type);
      form.set("file", prepared);

      const result = await uploadFormDataWithProgress({
        url: apiHref(`/applications/${memberId}/documents/upload`),
        formData: form,
        signal: abort.signal,
        onProgress: (percent) => {
          updateMemberState(memberId, { uploadPercent: percent });
        },
      });

      if (result.kind !== "complete") {
        if (result.kind === "abort") {
          updateMemberState(memberId, { uploading: null, uploadPercent: null });
          return;
        }
        reportUploadFailure(
          type,
          memberId,
          file,
          source,
          result.kind === "timeout" ? "TIMEOUT" : "NETWORK",
        );
        return;
      }

      const json = result.json as { ok?: boolean; error?: { code?: string; message?: string } } | null;
      if (result.status < 200 || result.status >= 300 || !json?.ok) {
        const code =
          json?.error?.code ??
          (result.status === 413 ? "FILE_TOO_LARGE" : result.status >= 500 ? "UPLOAD_FAILED" : "UPLOAD_FAILED");
        reportUploadFailure(type, memberId, file, source, code, result.status);
        return;
      }

      const after = memberStatesRef.current[memberId] ?? emptyMemberState();
      updateMemberState(memberId, {
        uploading: null,
        uploadPercent: null,
        lastUploadErrors: { ...after.lastUploadErrors, [type]: null },
      });
      trackDocumentUploadAnalytics({
        docType: type,
        applicationId: memberId,
        success: true,
        source,
      });
      const slot = after.slots.find((s) => s.key === type);
      setActionMsg(
        slot
          ? tRef.current("draft.actionMessages.slotUploaded", {
              document: translateDocumentSlot(slot, tRef.current).label,
            })
          : tRef.current("draft.actionMessages.documentUploaded"),
      );
      if (type === "passport_copy") {
        updateMemberState(memberId, { extractResult: null, extracting: true });
        const pipeline = (async () => {
          await load({ silent: true });
          if (latestByType(memberStatesRef.current[memberId]?.docs ?? [], "passport_copy")) {
            await runExtract();
            return;
          }
          updateMemberState(memberId, { extracting: false });
        })();
        extractPromiseRef.current = pipeline;
        await pipeline;
        return;
      }
      await load({ silent: true });
    },
    [selectedMemberId, load, runExtract, updateMemberState, reportUploadFailure],
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
    setActionMsg(tRef.current("draft.actionMessages.checkoutCancelled"));
    await load({ silent: true });
  }, [applicationId, load]);

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

  const selectedBase = memberStates[selectedMemberId] ?? emptyMemberState();
  const selectedMember = members.find((m) => m.applicationId === selectedMemberId) ?? null;
  const selected = {
    ...selectedBase,
    slots:
      selectedMember && selectedMember.slots.length > 0
        ? selectedMember.slots
        : selectedBase.slots,
  };
  const primaryState = app ? memberStates[app.id] : undefined;

  const uploadPresence = buildUploadPresence(
    members.map((m) => {
      const state = memberStates[m.applicationId] ?? emptyMemberState();
      const slots = m.slots.length > 0 ? m.slots : state.slots;
      return memberUploadStateFromDraft(slots, state.docsByType);
    }),
  );

  return {
    app,
    loading,
    error,
    actionMsg,
    setActionMsg,
    countdown,
    setCountdown,
    load,
    cancelCheckout,
    members,
    selectedMemberId,
    setSelectedMemberId,
    selectedMember,
    selected,
    onUpload,
    cancelInFlightUpload,
    runExtract,
    waitForPassportExtract,
    passport: primaryState?.passport ?? null,
    photo: primaryState?.photo ?? null,
    nationalityName: primaryState?.nationalityName ?? "",
    nationalities,
    uploadPresence,
  };
}

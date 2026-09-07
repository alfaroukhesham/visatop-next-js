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
import { nationalityDisplayName } from "@/lib/apply/display-names";
import { oversizedUploadMessage } from "@/lib/apply/customer-upload-copy";
import {
  buildUploadPresence,
  memberUploadStateFromDraft,
} from "@/lib/apply/payment-upload-presence";
import { UPLOAD_MAX_BYTES, type DocType, type ExtractResponse, type PublicDocument } from "./types";
import { latestByType } from "./utils";

type CatalogNationality = {
  code: string;
  name: string;
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
  extracting: false,
  extractResult: null,
});

export function useApplicationDraft(applicationId: string) {
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [members, setMembers] = useState<TPublicPartyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(applicationId);
  const [memberStates, setMemberStates] = useState<Record<string, TMemberState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

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

  const runExtract = useCallback(async () => {
    const memberId = selectedMemberId;
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
    if (s === "succeeded") {
      setActionMsg("We filled in what we could. Review your details below.");
    } else if (s === "needs_manual") {
      setActionMsg("We couldn’t read everything. Please enter the remaining details manually.");
    } else {
      setActionMsg("We couldn’t read your passport. Please enter the details manually.");
    }
    await load({ silent: true });
  }, [selectedMemberId, load, updateMemberState]);

  const onUpload = useCallback(
    async (type: DocType, file: File) => {
      const memberId = selectedMemberId;
      const tooLarge = oversizedUploadMessage(file.size, UPLOAD_MAX_BYTES);
      if (tooLarge) {
        setActionMsg(tooLarge);
        return;
      }
      setActionMsg(null);
      updateMemberState(memberId, { uploading: type });
      const form = new FormData();
      form.set("documentType", type);
      form.set("file", file);
      const res = await fetch(apiHref(`/applications/${memberId}/documents/upload`), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      updateMemberState(memberId, { uploading: null });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg =
          json?.error?.message ??
          (res.status === 413 ? "File exceeds 8MB limit." : `Upload failed (HTTP ${res.status})`);
        setActionMsg(msg);
        return;
      }
      const slot = memberStatesRef.current[memberId]?.slots.find((s) => s.key === type);
      setActionMsg(slot ? `${slot.label} uploaded.` : "Document uploaded.");
      await load({ silent: true });
      if (
        type === "passport_copy" &&
        latestByType(memberStatesRef.current[memberId]?.docs ?? [], "passport_copy")
      ) {
        void runExtract();
      }
    },
    [selectedMemberId, load, runExtract, updateMemberState],
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
    runExtract,
    passport: primaryState?.passport ?? null,
    photo: primaryState?.photo ?? null,
    nationalityName: primaryState?.nationalityName ?? "",
    uploadPresence,
  };
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { apiHref } from "@/lib/app-href";
import { UPLOAD_MAX_BYTES } from "@/lib/applications/document-upload";
import type { AdminDocRow } from "@/components/admin/admin-application-ops-panel";

const TERMINAL = new Set(["completed", "rejection_by_uae_authorities", "cancelled"]);
const RETAINED = "retained";
const UPLOAD_TYPE = "outcome_approval";

type OpsPanelState = {
  nextStatus: string;
  selectedOutcomeDocId: string;
  selectedFile: File | null;
  msg: string | null;
  loading: boolean;
  showNewUpload: boolean;
};

type OpsPanelAction =
  | { type: "SET_NEXT_STATUS"; value: string }
  | { type: "SET_SELECTED_OUTCOME_DOC_ID"; value: string }
  | { type: "SET_SELECTED_FILE"; value: File | null }
  | { type: "SET_MSG"; value: string | null }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_SHOW_NEW_UPLOAD"; value: boolean }
  | { type: "RESET_AFTER_STATUS_APPLY" }
  | { type: "UPLOAD_SUCCESS"; docId: string };

const initialOpsPanelState: OpsPanelState = {
  nextStatus: "",
  selectedOutcomeDocId: "",
  selectedFile: null,
  msg: null,
  loading: false,
  showNewUpload: false,
};

function opsPanelReducer(state: OpsPanelState, action: OpsPanelAction): OpsPanelState {
  switch (action.type) {
    case "SET_NEXT_STATUS":
      return { ...state, nextStatus: action.value };
    case "SET_SELECTED_OUTCOME_DOC_ID":
      return { ...state, selectedOutcomeDocId: action.value };
    case "SET_SELECTED_FILE":
      return { ...state, selectedFile: action.value };
    case "SET_MSG":
      return { ...state, msg: action.value };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_SHOW_NEW_UPLOAD":
      return { ...state, showNewUpload: action.value };
    case "RESET_AFTER_STATUS_APPLY":
      return {
        ...state,
        nextStatus: "",
        selectedOutcomeDocId: "",
        showNewUpload: false,
        msg: null,
      };
    case "UPLOAD_SUCCESS":
      return {
        ...state,
        selectedOutcomeDocId: action.docId,
        showNewUpload: false,
        selectedFile: null,
        msg: "Document uploaded. You can now apply the status.",
      };
    default:
      return state;
  }
}

function requiredOutcomeDocType(status: string): "outcome_approval" | "outcome_authority_rejection" | null {
  if (status === "completed") return "outcome_approval";
  if (status === "rejection_by_uae_authorities") return "outcome_authority_rejection";
  return null;
}

function retainedOutcomeDocs(documents: AdminDocRow[], docType: string) {
  return documents.filter((d) => d.documentType === docType && d.status === RETAINED);
}

export function useAdminApplicationOps({
  applicationId,
  paymentStatus,
  applicationStatus,
  documents,
}: {
  applicationId: string;
  paymentStatus: string;
  applicationStatus: string;
  documents: AdminDocRow[];
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(opsPanelReducer, initialOpsPanelState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!state.selectedFile) return null;
    return URL.createObjectURL(state.selectedFile);
  }, [state.selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const requiredDocType = requiredOutcomeDocType(state.nextStatus);
  const matchingOutcomeDocs = requiredDocType ? retainedOutcomeDocs(documents, requiredDocType) : [];
  const resolvedOutcomeDocId =
    !requiredDocType
      ? ""
      : state.selectedOutcomeDocId && matchingOutcomeDocs.some((d) => d.id === state.selectedOutcomeDocId)
        ? state.selectedOutcomeDocId
        : (matchingOutcomeDocs[0]?.id ?? "");

  const effectiveUploadType = requiredDocType ?? UPLOAD_TYPE;
  const selectedOutcomeDoc = matchingOutcomeDocs.find((d) => d.id === resolvedOutcomeDocId) ?? null;
  const statusNeedsOutcome = requiredDocType !== null;
  const canApplyStatus = !statusNeedsOutcome || resolvedOutcomeDocId.length > 0;
  const showUploadPanel =
    statusNeedsOutcome && (matchingOutcomeDocs.length === 0 || state.showNewUpload);
  const opsLocked = paymentStatus !== "paid" || TERMINAL.has(applicationStatus);
  const opsLockedMessage =
    paymentStatus !== "paid"
      ? "Outcome uploads and status controls unlock after payment is received."
      : "This application is in a terminal status. Outcome controls are not available.";

  function clearSelectedFile() {
    dispatch({ type: "SET_SELECTED_FILE", value: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickAnotherFile() {
    clearSelectedFile();
    fileInputRef.current?.click();
  }

  function handleFileChosen(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0] ?? null;
    ev.target.value = "";
    if (!f) return;
    if (f.size > UPLOAD_MAX_BYTES) {
      dispatch({ type: "SET_MSG", value: "File exceeds 8 MB limit." });
      clearSelectedFile();
      return;
    }
    dispatch({ type: "SET_MSG", value: null });
    dispatch({ type: "SET_SELECTED_FILE", value: f });
  }

  async function uploadSelectedFile() {
    if (!state.selectedFile) {
      dispatch({ type: "SET_MSG", value: "Choose a file to upload." });
      return;
    }
    dispatch({ type: "SET_LOADING", value: true });
    dispatch({ type: "SET_MSG", value: null });
    try {
      const fd = new FormData();
      fd.set("documentType", effectiveUploadType);
      fd.set("file", state.selectedFile);
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/documents/upload`), {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatch({ type: "SET_MSG", value: data?.error?.message ?? "Upload failed." });
        return;
      }
      const id = data?.data?.document?.id as string | undefined;
      if (id) dispatch({ type: "UPLOAD_SUCCESS", docId: id });
      clearSelectedFile();
      router.refresh();
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  }

  async function applyStatus() {
    if (!state.nextStatus) {
      dispatch({ type: "SET_MSG", value: "Choose a target status." });
      return;
    }
    if (statusNeedsOutcome && !resolvedOutcomeDocId) {
      dispatch({
        type: "SET_MSG",
        value: "Upload the required outcome document before applying this status.",
      });
      return;
    }
    dispatch({ type: "SET_LOADING", value: true });
    dispatch({ type: "SET_MSG", value: null });
    try {
      const body: Record<string, unknown> = { applicationStatus: state.nextStatus };
      if (statusNeedsOutcome) body.outcomeDocumentId = resolvedOutcomeDocId;
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/ops`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatch({ type: "SET_MSG", value: data?.error?.message ?? "Status update failed." });
        return;
      }
      const te = data?.data?.transactionalEmail as string | null | undefined;
      if (te === "skipped_mailgun_not_configured") {
        dispatch({
          type: "SET_MSG",
          value:
            "Status saved. Email was not sent: add MAILGUN_API_KEY and MAILGUN_DOMAIN to server env, then restart dev server.",
        });
      } else if (te === "skipped_no_recipient") {
        dispatch({
          type: "SET_MSG",
          value: "Status saved. Email was not sent: application has no guest email and no linked user email.",
        });
      } else if (te === "queued") {
        dispatch({
          type: "SET_MSG",
          value: "Status saved. Outcome email queued (check Mailgun logs / inbox).",
        });
      } else {
        dispatch({ type: "SET_MSG", value: null });
      }
      dispatch({ type: "RESET_AFTER_STATUS_APPLY" });
      router.refresh();
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  }

  return {
    dispatch,
    fileInputRef,
    previewUrl,
    requiredDocType,
    matchingOutcomeDocs,
    resolvedOutcomeDocId,
    selectedOutcomeDoc,
    statusNeedsOutcome,
    canApplyStatus,
    showUploadPanel,
    opsLocked,
    opsLockedMessage,
    clearSelectedFile,
    pickAnotherFile,
    handleFileChosen,
    uploadSelectedFile,
    applyStatus,
    ...state,
  };
}

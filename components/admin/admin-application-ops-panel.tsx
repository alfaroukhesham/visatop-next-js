"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiHref } from "@/lib/app-href";
import { UPLOAD_MAX_BYTES } from "@/lib/applications/document-upload";
import { AdminApplicationCustomerExport } from "@/components/admin/admin-application-customer-export";
import { cn } from "@/lib/utils";

export type AdminDocRow = {
  id: string;
  documentType: string | null;
  status: string | null;
  createdAt: string;
  originalFilename: string | null;
  byteLength: number | null;
};

const TERMINAL = new Set(["completed", "rejection_by_uae_authorities", "cancelled"]);
const RETAINED = "retained";

function requiredOutcomeDocType(status: string): "outcome_approval" | "outcome_authority_rejection" | null {
  if (status === "completed") return "outcome_approval";
  if (status === "rejection_by_uae_authorities") return "outcome_authority_rejection";
  return null;
}

function retainedOutcomeDocs(documents: AdminDocRow[], docType: string) {
  return documents.filter((d) => d.documentType === docType && d.status === RETAINED);
}

function formatOutcomeDocType(docType: string | null) {
  switch (docType) {
    case "outcome_approval":
      return "Approval / visa pack";
    case "outcome_authority_rejection":
      return "UAE authority rejection proof";
    default:
      return docType ?? "Unknown";
  }
}

function formatBytes(n: number | null) {
  if (n == null || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function AdminApplicationOpsPanel({
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
  const [nextStatus, setNextStatus] = useState<string>("");
  const [selectedOutcomeDocId, setSelectedOutcomeDocId] = useState("");
  const uploadType = "outcome_approval";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewUpload, setShowNewUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredDocType = requiredOutcomeDocType(nextStatus);
  const matchingOutcomeDocs = requiredDocType ? retainedOutcomeDocs(documents, requiredDocType) : [];
  const resolvedOutcomeDocId =
    !requiredDocType
      ? ""
      : selectedOutcomeDocId && matchingOutcomeDocs.some((d) => d.id === selectedOutcomeDocId)
        ? selectedOutcomeDocId
        : (matchingOutcomeDocs[0]?.id ?? "");

  const effectiveUploadType = requiredDocType ?? uploadType;

  const selectedOutcomeDoc =
    matchingOutcomeDocs.find((d) => d.id === resolvedOutcomeDocId) ?? null;
  const statusNeedsOutcome = requiredDocType !== null;
  const canApplyStatus = !statusNeedsOutcome || resolvedOutcomeDocId.length > 0;
  const showUploadPanel =
    statusNeedsOutcome && (matchingOutcomeDocs.length === 0 || showNewUpload);

  const opsLocked =
    paymentStatus !== "paid" || TERMINAL.has(applicationStatus);
  const opsLockedMessage =
    paymentStatus !== "paid"
      ? "Outcome uploads and status controls unlock after payment is received."
      : "This application is in a terminal status. Outcome controls are not available.";

  function clearSelectedFile() {
    setSelectedFile(null);
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
      setMsg("File exceeds 8 MB limit.");
      clearSelectedFile();
      return;
    }
    setMsg(null);
    setSelectedFile(f);
  }

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function uploadSelectedFile() {
    if (!selectedFile) {
      setMsg("Choose a file to upload.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("documentType", effectiveUploadType);
      fd.set("file", selectedFile);
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/documents/upload`), {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error?.message ?? "Upload failed.");
        return;
      }
      const id = data?.data?.document?.id as string | undefined;
      if (id) {
        setSelectedOutcomeDocId(id);
        setShowNewUpload(false);
        setMsg("Document uploaded. You can now apply the status.");
      }
      clearSelectedFile();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function applyStatus() {
    if (!nextStatus) {
      setMsg("Choose a target status.");
      return;
    }
    if (statusNeedsOutcome && !resolvedOutcomeDocId) {
      setMsg("Upload the required outcome document before applying this status.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { applicationStatus: nextStatus };
      if (statusNeedsOutcome) body.outcomeDocumentId = resolvedOutcomeDocId;
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/ops`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error?.message ?? "Status update failed.");
        return;
      }
      const te = data?.data?.transactionalEmail as string | null | undefined;
      if (te === "skipped_mailgun_not_configured") {
        setMsg(
          "Status saved. Email was not sent: add MAILGUN_API_KEY and MAILGUN_DOMAIN to server env, then restart dev server.",
        );
      } else if (te === "skipped_no_recipient") {
        setMsg("Status saved. Email was not sent: application has no guest email and no linked user email.");
      } else if (te === "queued") {
        setMsg("Status saved. Outcome email queued (check Mailgun logs / inbox).");
      } else {
        setMsg(null);
      }
      setNextStatus("");
      setSelectedOutcomeDocId("");
      setShowNewUpload(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <AdminApplicationCustomerExport applicationId={applicationId} />
      {opsLocked ? (
        <p className="text-muted-foreground text-sm">{opsLockedMessage}</p>
      ) : (
        <>
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">1. Choose status</h3>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                className="border-border bg-background h-9 w-full max-w-md rounded-none border px-2 text-sm"
                aria-label="Target application status"
              >
                <option value="">Choose status…</option>
                <option value="awaiting_authority">Awaiting authority</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed (approval pack)</option>
                <option value="rejection_by_uae_authorities">Rejected by UAE authorities</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {nextStatus ? (
              <>
                {statusNeedsOutcome ? (
                  <div
                    key={requiredDocType ?? "none"}
                    className="space-y-4 border border-border bg-muted/10 p-4"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">2. Outcome document</h3>
                      <p className="text-muted-foreground text-xs">
                        Required:{" "}
                        <span className="font-medium">{formatOutcomeDocType(requiredDocType)}</span>. Max 8
                        MB; JPEG, PNG, or PDF.
                      </p>
                    </div>

                    {matchingOutcomeDocs.length > 0 && !showNewUpload ? (
                      <div className="space-y-3">
                        {matchingOutcomeDocs.length > 1 ? (
                          <fieldset className="space-y-2">
                            <legend className="text-muted-foreground text-xs font-medium">
                              Choose an existing upload
                            </legend>
                            <ul className="space-y-1">
                              {matchingOutcomeDocs.map((d) => (
                                <li key={d.id}>
                                  <label className="border-border hover:bg-muted/30 flex cursor-pointer items-start gap-2 border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                    <input
                                      type="radio"
                                      name="outcome-doc"
                                      className="mt-1"
                                      checked={resolvedOutcomeDocId === d.id}
                                      onChange={() => setSelectedOutcomeDocId(d.id)}
                                    />
                                    <OutcomeDocSummary doc={d} compact />
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </fieldset>
                        ) : selectedOutcomeDoc ? (
                          <OutcomeDocSummary doc={selectedOutcomeDoc} />
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-none"
                          onClick={() => {
                            setShowNewUpload(true);
                            clearSelectedFile();
                          }}
                        >
                          Upload a different document
                        </Button>
                      </div>
                    ) : null}

                    {showUploadPanel ? (
                      <div className="space-y-2">
                        {matchingOutcomeDocs.length > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-auto rounded-none px-0 text-xs"
                            onClick={() => {
                              setShowNewUpload(false);
                              clearSelectedFile();
                            }}
                          >
                            Use an existing upload instead
                          </Button>
                        ) : null}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={handleFileChosen}
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden
                        />
                        {!selectedFile ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-none"
                            disabled={loading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Choose file
                          </Button>
                        ) : (
                          <OutcomeFilePreview
                            file={selectedFile}
                            previewUrl={previewUrl}
                            loading={loading}
                            onChangeFile={pickAnotherFile}
                            onPreview={() => {
                              if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
                            }}
                            onUpload={() => void uploadSelectedFile()}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No outcome document is required for this status.
                  </p>
                )}

                <div className="space-y-2 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold">
                    {statusNeedsOutcome ? "3. Apply status" : "2. Apply status"}
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-none"
                    disabled={loading || !canApplyStatus}
                    onClick={() => void applyStatus()}
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Apply status"}
                  </Button>
                  {statusNeedsOutcome && !canApplyStatus ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Upload the required document before applying this status.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function OutcomeDocSummary({ doc, compact }: { doc: AdminDocRow; compact?: boolean }) {
  const size = formatBytes(doc.byteLength);
  const uploadedAt = new Date(doc.createdAt).toLocaleString();
  const filename = doc.originalFilename?.trim() || "Uploaded document";

  return (
    <div className={cn("min-w-0", compact ? "flex-1" : "border-border bg-background border p-3")}>
      <div className="flex gap-3">
        <div
          className="border-border bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center border"
          aria-hidden
        >
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className="text-muted-foreground text-xs">
            {formatOutcomeDocType(doc.documentType)}
            {size ? ` · ${size}` : ""}
            {!compact ? ` · Uploaded ${uploadedAt}` : ` · ${uploadedAt}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function OutcomeFilePreview({
  file,
  previewUrl,
  loading,
  onChangeFile,
  onPreview,
  onUpload,
}: {
  file: File;
  previewUrl: string | null;
  loading: boolean;
  onChangeFile: () => void;
  onPreview: () => void;
  onUpload: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const sizeKb = (file.size / 1024).toFixed(1);

  return (
    <div className="border-border bg-muted/20 max-w-md space-y-3 border p-3">
      <div className="flex gap-3">
        {isImage && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob preview of admin-selected file
          <img
            src={previewUrl}
            alt=""
            className="border-border size-14 shrink-0 border object-cover"
          />
        ) : (
          <div
            className="border-border bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center border"
            aria-hidden
          >
            <FileText className="size-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-muted-foreground text-xs">
            {sizeKb} KB · {isImage ? "Image" : "PDF"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none"
          disabled={!previewUrl}
          onClick={onPreview}
        >
          Preview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none"
          disabled={loading}
          onClick={onChangeFile}
        >
          Change file
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn("rounded-none", loading && "pointer-events-none")}
          disabled={loading}
          onClick={onUpload}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Upload"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminDocRow } from "@/components/admin/admin-application-ops-panel";
import {
  OutcomeDocSummary,
  OutcomeFilePreview,
} from "@/components/admin/admin-application-ops-outcome";
import { formatOutcomeDocType } from "@/lib/admin/application-ops-format";
import type { useAdminApplicationOps } from "@/components/admin/use-admin-application-ops";

type OpsControls = ReturnType<typeof useAdminApplicationOps>;

export function AdminApplicationOpsControls({
  ops,
}: {
  ops: OpsControls;
}) {
  const {
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
    clearSelectedFile,
    pickAnotherFile,
    handleFileChosen,
    uploadSelectedFile,
    applyStatus,
    nextStatus,
    selectedFile,
    msg,
    loading,
    showNewUpload,
  } = ops;

  return (
    <>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">1. Choose status</h3>
          <select
            value={nextStatus}
            onChange={(e) => dispatch({ type: "SET_NEXT_STATUS", value: e.target.value })}
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
              <OutcomeDocumentSection
                requiredDocType={requiredDocType}
                matchingOutcomeDocs={matchingOutcomeDocs}
                resolvedOutcomeDocId={resolvedOutcomeDocId}
                selectedOutcomeDoc={selectedOutcomeDoc}
                showNewUpload={showNewUpload}
                showUploadPanel={showUploadPanel}
                selectedFile={selectedFile}
                previewUrl={previewUrl}
                loading={loading}
                fileInputRef={fileInputRef}
                onSelectDoc={(id) => dispatch({ type: "SET_SELECTED_OUTCOME_DOC_ID", value: id })}
                onShowNewUpload={() => {
                  dispatch({ type: "SET_SHOW_NEW_UPLOAD", value: true });
                  clearSelectedFile();
                }}
                onUseExisting={() => {
                  dispatch({ type: "SET_SHOW_NEW_UPLOAD", value: false });
                  clearSelectedFile();
                }}
                onFileChosen={handleFileChosen}
                onPickFile={() => fileInputRef.current?.click()}
                onChangeFile={pickAnotherFile}
                onPreview={() => {
                  if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
                }}
                onUpload={() => void uploadSelectedFile()}
              />
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
  );
}

function OutcomeDocumentSection({
  requiredDocType,
  matchingOutcomeDocs,
  resolvedOutcomeDocId,
  selectedOutcomeDoc,
  showNewUpload,
  showUploadPanel,
  selectedFile,
  previewUrl,
  loading,
  fileInputRef,
  onSelectDoc,
  onShowNewUpload,
  onUseExisting,
  onFileChosen,
  onPickFile,
  onChangeFile,
  onPreview,
  onUpload,
}: {
  requiredDocType: "outcome_approval" | "outcome_authority_rejection" | null;
  matchingOutcomeDocs: AdminDocRow[];
  resolvedOutcomeDocId: string;
  selectedOutcomeDoc: AdminDocRow | null;
  showNewUpload: boolean;
  showUploadPanel: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  loading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectDoc: (id: string) => void;
  onShowNewUpload: () => void;
  onUseExisting: () => void;
  onFileChosen: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onPickFile: () => void;
  onChangeFile: () => void;
  onPreview: () => void;
  onUpload: () => void;
}) {
  return (
    <div
      key={requiredDocType ?? "none"}
      className="space-y-4 border border-border bg-muted/10 p-4"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">2. Outcome document</h3>
        <p className="text-muted-foreground text-xs">
          Required: <span className="font-medium">{formatOutcomeDocType(requiredDocType)}</span>. Max 8
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
                        onChange={() => onSelectDoc(d.id)}
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
          <Button type="button" size="sm" variant="outline" className="rounded-none" onClick={onShowNewUpload}>
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
              onClick={onUseExisting}
            >
              Use an existing upload instead
            </Button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={onFileChosen}
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
              onClick={onPickFile}
            >
              Choose file
            </Button>
          ) : (
            <OutcomeFilePreview
              file={selectedFile}
              previewUrl={previewUrl}
              loading={loading}
              onChangeFile={onChangeFile}
              onPreview={onPreview}
              onUpload={onUpload}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

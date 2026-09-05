"use client";

import type { FC } from "react";
import { AlertTriangle, CheckCircle2, FileStack, Loader2 } from "lucide-react";
import type { TDocumentSlot } from "@/lib/apply/document-requirements";
import { DocumentUploadSlot } from "./document-upload-slot";
import type { DocType, PublicDocument } from "./types";

export interface IDraftDocumentsSectionProps {
  applicationId: string;
  slots: TDocumentSlot[];
  docsByType: Partial<Record<DocType, PublicDocument | null>>;
  uploading: DocType | null;
  extracting: boolean;
  onUpload: (type: DocType, file: File) => void;
}

export const DraftDocumentsSection: FC<IDraftDocumentsSectionProps> = ({
  applicationId,
  slots,
  docsByType,
  uploading,
  extracting,
  onUpload,
}) => {
  const required = slots.filter((s) => s.role === "required");
  const additional = slots.filter((s) => s.role === "additional");
  const allRequiredUploaded = required.every((s) => docsByType[s.key as DocType]);
  const hasBank = slots.some((s) => s.key === "bank_statement_6m");

  const renderSlot = (slot: TDocumentSlot) => {
    const type = slot.key as DocType;
    return (
      <DocumentUploadSlot
        key={slot.key}
        label={slot.label}
        description={slot.description}
        currentDoc={docsByType[type] ?? null}
        docType={type}
        applicationId={applicationId}
        uploading={uploading === type}
        onUpload={(f) => onUpload(type, f)}
      />
    );
  };

  return (
    <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading flex items-center gap-2 text-base font-semibold tracking-tight">
          <FileStack className="text-primary size-5" aria-hidden />
          Documents
        </h2>
        {allRequiredUploaded ? (
          <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
            <CheckCircle2 className="size-4" aria-hidden />
            Documents uploaded
          </span>
        ) : (
          <span
            className="text-muted-foreground inline-flex items-center text-xs"
            aria-label="Passport and photo are required before we can submit to authorities; you can pay first."
          >
            <AlertTriangle className="size-4" aria-hidden />
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">{required.map(renderSlot)}</div>

      {additional.length > 0 ? (
        <>
          <h3 className="font-heading text-foreground text-sm font-semibold tracking-tight">
            Additional documents
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">{additional.map(renderSlot)}</div>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {extracting ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span>Reading passport…</span>
          </p>
        ) : !hasBank ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Additional documents may be required by VisaTop to finalize the application (e.g. bank
            statements, insurance). The VisaTop team will contact you once the passport has been
            submitted.
          </p>
        ) : null}
      </div>
    </section>
  );
};

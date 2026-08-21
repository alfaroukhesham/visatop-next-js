"use client";

import { AlertTriangle, CheckCircle2, FileStack, Loader2 } from "lucide-react";
import type { PublicApplication } from "@/lib/applications/public-application";
import { DocumentUploadSlot } from "./document-upload-slot";
import type { DocType, PublicDocument } from "./types";

export function DraftDocumentsSection({
  applicationId,
  passport,
  photo,
  gotBoth,
  uploading,
  extracting,
  passportExtractionStatus,
  attemptsLeft,
  onUpload,
}: {
  applicationId: string;
  passport: PublicDocument | null;
  photo: PublicDocument | null;
  gotBoth: boolean;
  uploading: DocType | null;
  extracting: boolean;
  passportExtractionStatus: PublicApplication["passportExtraction"]["status"];
  attemptsLeft: number;
  onUpload: (type: DocType, file: File) => void;
}) {
  return (
    <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading flex items-center gap-2 text-base font-semibold tracking-tight">
          <FileStack className="text-primary size-5" aria-hidden />
          Documents
        </h2>
        {gotBoth ? (
          <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
            <CheckCircle2 className="size-4" aria-hidden />
            Passport + photo present
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

      <div className="grid gap-4 sm:grid-cols-2">
        <DocumentUploadSlot
          label="Passport (bio page)"
          description="JPEG / PNG / single-page PDF · 8MB max"
          currentDoc={passport}
          docType="passport_copy"
          applicationId={applicationId}
          uploading={uploading === "passport_copy"}
          onUpload={(f) => onUpload("passport_copy", f)}
        />
        <DocumentUploadSlot
          label="Personal photo"
          description="JPEG or PNG · 8MB max"
          currentDoc={photo}
          docType="personal_photo"
          applicationId={applicationId}
          uploading={uploading === "personal_photo"}
          onUpload={(f) => onUpload("personal_photo", f)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {extracting ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span>Reading passport…</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Additional documents may be required by VisaTop to finalize the application (e.g. bank
            statements, insurance). The VisaTop team will contact you once the passport has been
            submitted.
          </p>
        )}
      </div>
      {attemptsLeft === 0 && passportExtractionStatus !== "succeeded" ? (
        <p className="text-muted-foreground text-sm">
          We’ve tried twice. Please enter your details manually below.
        </p>
      ) : null}
    </section>
  );
}

"use client";

import type { FC } from "react";
import { AlertTriangle, CheckCircle2, FileStack, Loader2 } from "lucide-react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import type { TDocumentSlot } from "@/lib/apply/document-requirements";
import { translateDocumentSlot } from "@/lib/apply/document-slot-i18n";
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
  const t = useCustomerT();
  const required = slots.filter((s) => s.role === "required");
  const additional = slots.filter((s) => s.role === "additional");
  const allRequiredUploaded = required.every((s) => docsByType[s.key as DocType]);
  const passportUploaded = Boolean(docsByType.passport_copy);
  const hasBank = slots.some((s) => s.key === "bank_statement_6m");

  const renderSlot = (slot: TDocumentSlot) => {
    const type = slot.key as DocType;
    const copy = translateDocumentSlot(slot, t);
    return (
      <DocumentUploadSlot
        key={slot.key}
        label={copy.label}
        description={copy.description}
        currentDoc={docsByType[type] ?? null}
        docType={type}
        applicationId={applicationId}
        uploading={uploading === type}
        onUpload={(f) => onUpload(type, f)}
      />
    );
  };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-[0_18px_48px_rgba(1,32,49,0.07)] sm:p-6 md:p-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FileStack className="text-primary size-5" aria-hidden />
            {t("documents.title")}
          </h2>
          {allRequiredUploaded ? (
            <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="size-4" aria-hidden />
              {t("documents.uploadedBadge")}
            </span>
          ) : null}
        </div>
        {allRequiredUploaded ? null : passportUploaded ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{t("documents.continueAfterUpload")}</p>
        ) : (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <AlertTriangle className="text-error size-3.5 shrink-0" aria-hidden />
            <span>{t("documents.uploadRequiredToPay")}</span>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">{required.map(renderSlot)}</div>

      {additional.length > 0 ? (
        <>
          <h3 className="font-heading text-foreground text-sm font-bold uppercase tracking-wide">
            {t("documents.additionalDocuments")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">{additional.map(renderSlot)}</div>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {extracting ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span>{t("documents.readingPassport")}</span>
          </p>
        ) : !hasBank ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{t("documents.additionalMayBeRequired")}</p>
        ) : null}
      </div>
    </section>
  );
};

"use client";

import { useRef, useState, type FC } from "react";
import { Camera, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { apiHref } from "@/lib/app-href";
import { customerUploadStateLabel, oversizedUploadMessage } from "@/lib/apply/customer-upload-copy";
import { MIME_BY_TYPE, UPLOAD_MAX_BYTES, type DocType, type PublicDocument } from "./types";

export interface IDocumentUploadSlotProps {
  label: string;
  description: string;
  currentDoc: PublicDocument | null;
  docType: DocType;
  applicationId: string;
  uploading: boolean;
  onUpload: (file: File) => void;
}

export const DocumentUploadSlot: FC<IDocumentUploadSlotProps> = ({
  label,
  description,
  currentDoc,
  docType,
  applicationId,
  uploading,
  onUpload,
}) => {
  const t = useCustomerT();
  const inputId = `file-${docType}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraFacing = docType === "personal_photo" ? "user" : "environment";
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    const tooLarge = oversizedUploadMessage(file.size, UPLOAD_MAX_BYTES, t);
    if (tooLarge) {
      setSizeError(tooLarge);
      return;
    }
    setSizeError(null);
    onUpload(file);
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-border bg-card p-5 shadow-[0_10px_28px_rgba(1,32,49,0.05)]">
      <div>
        <p className="text-foreground text-sm font-bold uppercase tracking-wide">{label}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
      </div>
      {currentDoc ? (
        <div className="border-secondary/20 bg-secondary/5 space-y-2 rounded-xl border px-3 py-3">
          <p className="text-success inline-flex items-center gap-1 text-sm font-semibold">
            <CheckCircle2 className="size-4" aria-hidden />
            {customerUploadStateLabel(true, t)}
          </p>
          <a
            href={apiHref(`/applications/${applicationId}/documents/${currentDoc.id}/preview`)}
            target="_blank"
            rel="noreferrer"
            className="text-link text-xs hover:underline"
          >
            {t("documents.preview")}
          </a>
        </div>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <FileUp className="text-secondary size-4" aria-hidden />
          {customerUploadStateLabel(false, t)}
        </p>
      )}

      <div className="border-secondary/30 bg-muted/30 rounded-xl border-2 border-dashed p-3">
        <ClientField id={inputId} label={label} labelClassName="sr-only">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture={cameraFacing}
            onChange={handleFileChosen}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={MIME_BY_TYPE[docType]}
            onChange={handleFileChosen}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          {sizeError ? (
            <p className="text-destructive text-xs" role="alert">
              {sizeError}
            </p>
          ) : null}
          {uploading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("documents.uploading")}
            </div>
          ) : (
            <div className="flex gap-2">
              <ClientButton
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl"
                onClick={() => cameraInputRef.current?.click()}
                aria-label={t("documents.takePhotoAria", { label })}
              >
                <Camera className="size-4" aria-hidden />
                {t("documents.takePhoto")}
              </ClientButton>
              <ClientButton
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("documents.chooseFileAria", { label })}
              >
                {currentDoc ? t("documents.replace") : t("documents.chooseFile")}
              </ClientButton>
            </div>
          )}
        </ClientField>
      </div>
    </div>
  );
};

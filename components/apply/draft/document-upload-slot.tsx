"use client";

import { useEffect, useRef, type FC } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { apiHref, publicAsset } from "@/lib/app-href";
import { customerUploadErrorMessage, customerUploadStateLabel } from "@/lib/apply/customer-upload-copy";
import type { TDocumentUploadSource } from "@/lib/analytics/document-upload-events";
import { MIME_BY_TYPE, type DocType, type PublicDocument, type TUploadSlotError } from "./types";

export interface IDocumentUploadSlotProps {
  label: string;
  description: string;
  currentDoc: PublicDocument | null;
  docType: DocType;
  applicationId: string;
  uploading: boolean;
  uploadPercent: number | null;
  lastError: TUploadSlotError | null;
  addLater?: boolean;
  showCaptureGuidance?: boolean;
  onUpload: (file: File, source: TDocumentUploadSource) => void;
  onCancelUpload: () => void;
}

export const DocumentUploadSlot: FC<IDocumentUploadSlotProps> = ({
  label,
  description,
  currentDoc,
  docType,
  applicationId,
  uploading,
  uploadPercent,
  lastError,
  addLater = false,
  showCaptureGuidance = false,
  onUpload,
  onCancelUpload,
}) => {
  const t = useCustomerT();
  const inputId = `file-${docType}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const lastSourceRef = useRef<TDocumentUploadSource>("file");
  const cameraFacing = docType === "personal_photo" ? "user" : "environment";
  const errorMessage = lastError ? customerUploadErrorMessage(lastError.code, t) : null;

  useEffect(() => {
    if (!lastError) return;
    rootRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [lastError]);

  const handleFileChosen = (source: TDocumentUploadSource) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    lastFileRef.current = file;
    lastSourceRef.current = source;
    onUpload(file, source);
  };

  const retryLastFile = () => {
    const file = lastFileRef.current;
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    onUpload(file, lastSourceRef.current);
  };

  return (
    <div
      ref={rootRef}
      className="scroll-mt-[130px] space-y-3 rounded-2xl border-2 border-border bg-card p-5 shadow-[0_10px_28px_rgba(1,32,49,0.05)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-bold uppercase tracking-wide">{label}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
        </div>
        {addLater ? (
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
            {t("documents.addLater")}
          </span>
        ) : null}
      </div>

      {showCaptureGuidance ? (
        <div className="border-secondary/20 bg-muted/40 space-y-3 rounded-xl border p-3">
          <Image
            src={publicAsset("/apply/passport-bio-specimen.svg")}
            alt={t("documents.examplePassportAlt")}
            width={640}
            height={420}
            className="mx-auto h-auto w-full max-w-sm rounded-lg border border-border"
            data-clarity-mask="true"
            unoptimized
          />
          <ul className="text-muted-foreground list-disc space-y-1 ps-4 text-xs leading-relaxed">
            <li>{t("documents.captureTip1")}</li>
            <li>{t("documents.captureTip2")}</li>
            <li>{t("documents.captureTip3")}</li>
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">{t("documents.privacyNote")}</p>
        </div>
      ) : null}

      {currentDoc ? (
        <div className="border-secondary/20 bg-secondary/5 space-y-2 rounded-xl border p-3" data-clarity-mask="true">
          <p
            className={`inline-flex items-center gap-1 text-sm font-semibold ${lastError ? "text-destructive" : "text-success"}`}
          >
            {lastError ? (
              <AlertTriangle className="size-4" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            {lastError ? t("documents.previousFileKept") : customerUploadStateLabel(true, t)}
          </p>
          <a
            href={apiHref(`/applications/${applicationId}/documents/${currentDoc.id}/preview`)}
            target="_blank"
            rel="noreferrer"
            className="text-link text-xs hover:underline"
            data-clarity-mask="true"
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
            onChange={handleFileChosen("camera")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={MIME_BY_TYPE[docType]}
            onChange={handleFileChosen("file")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          {errorMessage ? (
            <div
              className="text-destructive flex flex-col gap-2 py-1 text-sm"
              role="alert"
              aria-live="assertive"
            >
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{errorMessage}</span>
              </p>
              <ClientButton
                type="button"
                variant="outline"
                className="h-11 min-h-11 w-full rounded-xl sm:w-auto"
                onClick={retryLastFile}
              >
                {t("documents.retry")}
              </ClientButton>
            </div>
          ) : null}
          {uploading ? (
            <div className="space-y-3 py-1">
              <output className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {uploadPercent === null
                  ? t("documents.uploading")
                  : t("documents.uploadingPercent", { percent: uploadPercent })}
              </output>
              <progress
                className="bg-muted h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                max={100}
                value={uploadPercent ?? undefined}
              />
              <ClientButton
                type="button"
                variant="outline"
                className="h-11 min-h-11 w-full rounded-xl"
                onClick={onCancelUpload}
              >
                {t("documents.cancelUpload")}
              </ClientButton>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <ClientButton
                type="button"
                variant="default"
                className="h-11 min-h-11 w-full rounded-xl sm:flex-1"
                onClick={() => cameraInputRef.current?.click()}
                aria-label={t("documents.takePhotoAria", { label })}
              >
                <Camera className="size-4" aria-hidden />
                {t("documents.takePhoto")}
              </ClientButton>
              <ClientButton
                type="button"
                variant="outline"
                className="h-11 min-h-11 w-full rounded-xl sm:flex-1"
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

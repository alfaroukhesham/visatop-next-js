"use client";

import { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { apiHref } from "@/lib/app-href";
import { customerUploadStateLabel } from "@/lib/apply/customer-upload-copy";
import { MIME_BY_TYPE, UPLOAD_MAX_BYTES, type DocType, type PublicDocument } from "./types";

export function DocumentUploadSlot({
  label,
  description,
  currentDoc,
  docType,
  applicationId,
  uploading,
  onUpload,
}: {
  label: string;
  description: string;
  currentDoc: PublicDocument | null;
  docType: DocType;
  applicationId: string;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputId = `file-${docType}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraFacing = docType === "personal_photo" ? "user" : "environment";

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (file.size > UPLOAD_MAX_BYTES) return;
    onUpload(file);
  };

  return (
    <div className="space-y-3 rounded-[12px] border border-border bg-card/80 p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {currentDoc ? (
        <div className="space-y-2">
          <p className="text-success text-sm font-medium">{customerUploadStateLabel(true)}</p>
          <a
            href={apiHref(`/applications/${applicationId}/documents/${currentDoc.id}/preview`)}
            target="_blank"
            rel="noreferrer"
            className="text-link text-xs hover:underline"
          >
            Preview
          </a>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{customerUploadStateLabel(false)}</p>
      )}

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
        {uploading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Uploading…
          </div>
        ) : (
          <div className="flex gap-2">
            <ClientButton
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-none"
              onClick={() => cameraInputRef.current?.click()}
              aria-label={`Take a photo: ${label}`}
            >
              <Camera className="size-4" aria-hidden />
              Take photo
            </ClientButton>
            <ClientButton
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-none"
              onClick={() => fileInputRef.current?.click()}
              aria-label={`Choose a file: ${label}`}
            >
              {currentDoc ? "Replace" : "Choose file"}
            </ClientButton>
          </div>
        )}
      </ClientField>
    </div>
  );
}

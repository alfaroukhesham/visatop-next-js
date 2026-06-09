"use client";

import Image from "next/image";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminDocRow } from "@/components/admin/admin-application-ops-panel";
import { formatBytes, formatOutcomeDocType } from "@/lib/admin/application-ops-format";

export function OutcomeDocSummary({ doc, compact }: { doc: AdminDocRow; compact?: boolean }) {
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

export function OutcomeFilePreview({
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
          <Image
            src={previewUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
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

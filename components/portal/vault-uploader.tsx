"use client";

import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";

import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { apiHref } from "@/lib/app-href";

const SUPPORTING = [
  { id: "air_ticket", label: "Air ticket" },
  { id: "hotel_reservation", label: "Hotel reservation" },
  { id: "passport_additional_page", label: "Additional passport page" },
  { id: "other", label: "Other" },
] as const;

type DocType = "passport_copy" | "personal_photo" | "supporting";

type Ok = {
  ok: true;
  data: { document: { id: string }; idempotent: boolean };
};

type Err = {
  ok: false;
  error?: { message?: string };
};

export function VaultUploader() {
  const [documentType, setDocumentType] = useState<DocType>("passport_copy");
  const [supportingCategory, setSupportingCategory] = useState<(typeof SUPPORTING)[number]["id"]>("other");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [fileKey, setFileKey] = useState(0);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setBanner(null);
    try {
      const form = new FormData();
      form.set("documentType", documentType);
      if (documentType === "supporting") form.set("supportingCategory", supportingCategory);
      form.set("file", file);
      const res = await fetch(apiHref("/portal/documents/upload"), { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as Ok | Err | null;

      if (!res.ok) {
        const serverMsg =
          json && "ok" in json && json.ok === false ? (json.error?.message ?? null) : null;
        const statusMsg =
          res.status === 415
            ? "File type is not allowed for this document."
            : res.status === 413
              ? "File exceeds 8MB limit."
              : `Upload failed (HTTP ${res.status}).`;
        setBanner({ type: "err", text: serverMsg ?? statusMsg });
        return;
      }

      if (!json || json.ok !== true) {
        setBanner({ type: "err", text: "Upload failed. Try again." });
        return;
      }

      setBanner({
        type: "ok",
        text: json.data.idempotent ? "Already saved — you can reuse it." : "Saved to My documents.",
      });
      setFile(null);
      setFileKey((k) => k + 1);
    } catch {
      setBanner({ type: "err", text: "Network error. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold tracking-tight">Upload</p>
        <p className="text-muted-foreground text-xs">
          Passport and personal photo are normalized for consistency (size/format) before saving.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ClientField id="vault-type" label="Document type">
          <select
            id="vault-type"
            className="border-border bg-background h-10 w-full rounded-[5px] border px-3 text-sm"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocType)}
          >
            <option value="passport_copy">Passport (bio page)</option>
            <option value="personal_photo">Personal photo</option>
            <option value="supporting">Supporting document</option>
          </select>
        </ClientField>

        <ClientField id="vault-supporting" label="Supporting category">
          <select
            id="vault-supporting"
            className="border-border bg-background h-10 w-full rounded-[5px] border px-3 text-sm disabled:opacity-60"
            value={supportingCategory}
            disabled={documentType !== "supporting"}
            onChange={(e) => setSupportingCategory(e.target.value as (typeof SUPPORTING)[number]["id"])}
          >
            {SUPPORTING.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </ClientField>
      </div>

      <ClientField id="vault-file" label="File">
        <input
          id="vault-file"
          type="file"
          key={fileKey}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-muted-foreground block w-full text-xs file:mr-3 file:border file:border-border file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
      </ClientField>

      {banner ? (
        <p
          className={
            banner.type === "err"
              ? "border-error bg-error/5 text-error border-l-4 px-3 py-2 text-sm leading-relaxed"
              : "border-success bg-success/10 text-success border-l-4 px-3 py-2 text-sm leading-relaxed"
          }
          role={banner.type === "err" ? "alert" : "status"}
        >
          {banner.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <ClientButton
          type="button"
          brand="cta"
          disabled={!file || busy}
          onClick={() => void upload()}
          className="font-semibold"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Uploading…
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 size-4" aria-hidden />
              Upload to vault
            </>
          )}
        </ClientButton>
        <ClientButton
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => window.dispatchEvent(new Event("vault:refresh"))}
        >
          Refresh list
        </ClientButton>
      </div>
    </section>
  );
}


"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { apiHref } from "@/lib/app-href";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DocType = "passport_copy" | "personal_photo" | "supporting" | "";

type VaultRow = {
  id: string;
  documentType: string;
  supportingCategory: string | null;
  originalFilename: string | null;
  byteLength: number | null;
  contentType: string | null;
  sha256: string;
  createdAt: string;
  expiresAt: string | null;
};

type Ok = {
  ok: true;
  data: { items: VaultRow[]; nextCursor: string | null };
};

type Err = {
  ok: false;
  error?: { message?: string };
};

export function VaultList() {
  const [type, setType] = useState<DocType>("");
  const [items, setItems] = useState<VaultRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load(cursor: string | null, reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(apiHref("/portal/documents"));
      url.searchParams.set("limit", "5");
      if (type) url.searchParams.set("type", type);
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString());
      const json = (await res.json().catch(() => null)) as Ok | Err | null;
      if (!res.ok || !json?.ok) {
        setError(json && "ok" in json && json.ok === false ? (json.error?.message ?? "Unable to load documents.") : "Unable to load documents.");
        return;
      }
      setItems((prev) => (reset ? json.data.items : [...prev, ...json.data.items]));
      setNextCursor(json.data.nextCursor);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await fetch(apiHref(`/portal/documents/${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: { deleted: boolean } }
        | { ok: false; error?: { message?: string } }
        | null;

      if (!res.ok || !json?.ok) {
        const serverMsg =
          json && "ok" in json && json.ok === false ? (json.error?.message ?? null) : null;
        setBanner({
          type: "err",
          text: serverMsg ?? `Delete failed (HTTP ${res.status}).`,
        });
        return;
      }
      setBanner({ type: "ok", text: "Deleted." });
      setConfirmId(null);
      await load(null, true);
    } catch {
      setBanner({ type: "err", text: "Network error. Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    const handler = () => void load(null, true);
    window.addEventListener("vault:refresh", handler);
    return () => window.removeEventListener("vault:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const confirmDoc = confirmId ? items.find((x) => x.id === confirmId) ?? null : null;

  return (
    <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
      <Dialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
      >
        <DialogContent className="border-border bg-card text-foreground w-full max-w-[calc(100%-2rem)] rounded-[12px] border p-6 shadow-[0_18px_48px_rgba(1,32,49,0.18)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">Delete document?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This removes the file from <span className="font-semibold text-foreground">My documents</span>. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {confirmDoc ? (
            <div className="rounded-[12px] border border-border bg-muted/20 p-4 text-sm shadow-sm">
              <div className="text-foreground font-semibold">
                {confirmDoc.originalFilename ?? confirmDoc.id}
              </div>
              <div className="text-muted-foreground text-xs">
                {confirmDoc.documentType}
                {confirmDoc.supportingCategory ? ` · ${confirmDoc.supportingCategory}` : ""}
              </div>
            </div>
          ) : null}

          <DialogFooter className="bg-transparent border-t-0 p-0">
            <ClientButton
              type="button"
              variant="outline"
              disabled={busyId === confirmId}
              className="rounded-none"
              onClick={() => setConfirmId(null)}
            >
              Cancel
            </ClientButton>
            <ClientButton
              type="button"
              variant="destructive"
              disabled={!confirmId || busyId === confirmId}
              className="rounded-none font-semibold !text-white"
              onClick={() => confirmId && void onDelete(confirmId)}
            >
              {busyId === confirmId ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              <span>Delete document</span>
            </ClientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-heading text-base font-semibold tracking-tight">Saved documents</p>
          <p className="text-muted-foreground text-xs">Preview opens in a new tab.</p>
        </div>
        <ClientField id="vault-filter" label="Filter" labelClassName="sr-only">
          <select
            id="vault-filter"
            className="border-border bg-background h-10 rounded-[5px] border px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as DocType)}
          >
            <option value="">All types</option>
            <option value="passport_copy">Passport</option>
            <option value="personal_photo">Photo</option>
            <option value="supporting">Supporting</option>
          </select>
        </ClientField>
      </div>

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

      {error ? (
        <p className="text-error text-sm leading-relaxed" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !loading ? (
        <p className="text-muted-foreground rounded-[12px] border border-border bg-card/60 p-4 text-center text-sm">
          No documents saved yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li
              key={d.id}
              className="rounded-[10px] border border-border bg-card/70 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-foreground text-sm font-semibold">
                    {d.documentType}
                    {d.supportingCategory ? ` · ${d.supportingCategory}` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {d.originalFilename ?? d.id}
                    {" · "}
                    {d.byteLength ? `${(d.byteLength / 1024).toFixed(1)} KB` : "?"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Saved {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={apiHref(`/portal/documents/${encodeURIComponent(d.id)}/preview`)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link text-sm font-semibold hover:underline"
                    >
                      Preview
                    </a>
                    <ClientButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === d.id}
                      onClick={() => setConfirmId(d.id)}
                    >
                      {busyId === d.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                      <span className="sr-only">Delete</span>
                    </ClientButton>
                  </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading ? (
        <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading…
        </p>
      ) : null}

      {nextCursor && !loading ? (
        <div className="flex justify-center">
          <ClientButton
            type="button"
            variant="secondary"
            onClick={() => void load(nextCursor, false)}
            className="font-semibold"
          >
            Load more
          </ClientButton>
        </div>
      ) : null}
    </section>
  );
}


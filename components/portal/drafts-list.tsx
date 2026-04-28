"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ClientButton } from "@/components/client/client-button";
import { apiHref } from "@/lib/app-href";

type DraftRow = {
  id: string;
  referenceDisplay: string;
  serviceId: string;
  nationalityCode: string;
  createdAt: string;
  draftExpiresAt: string | null;
};

type Ok = {
  ok: true;
  data: { items: DraftRow[]; nextCursor: string | null };
};

type Err = {
  ok: false;
  error?: { message?: string; code?: string };
};

export function DraftsList() {
  const [items, setItems] = useState<DraftRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: string | null) {
    setError(null);
    setLoading(true);
    try {
      const url = new URL(apiHref("/portal/drafts"));
      url.searchParams.set("limit", "5");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString());
      const json = (await res.json()) as Ok | Err;
      if (!res.ok || !json.ok) {
        setError(
          json.ok === false
            ? (json.error?.message ?? "Unable to load drafts right now.")
            : "Unable to load drafts right now.",
        );
        return;
      }
      setItems((prev) => (cursor ? [...prev, ...json.data.items] : json.data.items));
      setNextCursor(json.data.nextCursor);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(null);
  }, []);

  return (
    <section className="space-y-6" aria-live="polite">
      {error ? (
        <p className="text-error text-sm leading-relaxed" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !loading ? (
        <p className="text-muted-foreground rounded-[12px] border border-border bg-card p-6 text-center text-sm leading-relaxed shadow-sm">
          No drafts found.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.id}>
              <Link
                href={`/apply/applications/${encodeURIComponent(d.id)}`}
                className="border-border bg-card block rounded-[10px] border p-4 shadow-sm transition-all duration-200 hover:border-secondary/30 hover:shadow-[0_8px_28px_rgba(1,32,49,0.08)]"
              >
                <p className="text-secondary text-xs font-bold uppercase tracking-wider">
                  {d.referenceDisplay}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Service {d.serviceId} · Nationality {d.nationalityCode}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Started {new Date(d.createdAt).toLocaleDateString()}
                  {d.draftExpiresAt ? ` · Expires ${new Date(d.draftExpiresAt).toLocaleDateString()}` : ""}
                </p>
              </Link>
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
            onClick={() => void load(nextCursor)}
            className="font-semibold"
          >
            Load more
          </ClientButton>
        </div>
      ) : null}
    </section>
  );
}


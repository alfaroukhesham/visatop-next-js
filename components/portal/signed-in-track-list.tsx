"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ClientButton } from "@/components/client/client-button";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";
import type { ClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { apiHref } from "@/lib/app-href";

type Row = {
  applicationId: string;
  referenceDisplay: string;
  nationalityCode: string;
  serviceId: string;
  clientTracking: ClientApplicationTracking;
};

type Ok = {
  ok: true;
  data: { items: Row[]; nextCursor: string | null };
};

type Err = {
  ok: false;
  error?: { message?: string; code?: string };
};

export function SignedInTrackList() {
  const [items, setItems] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: string | null) {
    setError(null);
    setLoading(true);
    try {
      const url = new URL(apiHref("/portal/track-applications"));
      url.searchParams.set("limit", "5");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString());
      const json = (await res.json()) as Ok | Err;
      if (!res.ok || !json.ok) {
        setError(
          json.ok === false
            ? (json.error?.message ?? "Unable to load applications right now.")
            : "Unable to load applications right now.",
        );
        return;
      }
      setItems((prev) =>
        cursor ? [...prev, ...json.data.items] : json.data.items,
      );
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
    <section className="space-y-8" aria-live="polite">
      {error ? (
        <p className="text-error text-sm leading-relaxed" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !loading ? (
        <div className="text-muted-foreground rounded-[12px] border border-border bg-card p-6 text-center text-sm leading-relaxed shadow-sm">
          <p>No paid or submitted applications found for this account.</p>
          <p className="mt-2">
            Looking for an unpaid draft? Visit{" "}
            <a href="/portal/drafts" className="text-link font-medium hover:underline">
              Draft applications
            </a>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-8">
          {items.map((row) => (
            <li
              key={row.applicationId}
              className="space-y-6 rounded-[12px] border border-border border-l-[3px] border-l-primary bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8"
            >
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Reference
                </p>
                <p className="font-mono text-sm text-foreground">{row.referenceDisplay}</p>
                <p className="text-muted-foreground text-xs">
                  Service {row.serviceId} · Nationality {row.nationalityCode}
                </p>
              </div>
              <ApplicationClientTracking tracking={row.clientTracking} />
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


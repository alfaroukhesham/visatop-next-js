"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClientInlineLoading, ClientTrackListSkeleton } from "@/components/client/client-loading";

import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";
import type { ClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { nationalityLabelWithFlag } from "@/lib/apply/display-names";
import { apiHref } from "@/lib/app-href";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";

type Row = {
  applicationId: string;
  referenceDisplay: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  nationalityName: string;
  paymentStatus: string;
  draftExpiresAt: string | null;
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

function isContinueDraft(row: Row): boolean {
  return row.paymentStatus === "unpaid";
}

export function SignedInTrackList() {
  const [items, setItems] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: string | null) {
    setError(null);
    setLoading(true);
    try {
      const href = apiHref("/portal/track-applications");
      const url = new URL(
        href,
        typeof window !== "undefined" ? window.location.origin : "http://localhost",
      );
      url.searchParams.set("limit", "5");
      if (cursor) url.searchParams.set("cursor", cursor);

      const urlString = url.toString();
      const res = await fetch(urlString);
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

  useOnBfcacheRestore(() => {
    void load(null);
  });

  return (
    <section className="space-y-8" aria-live="polite">
      {error ? (
        <p className="text-error text-sm leading-relaxed" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <ClientTrackListSkeleton count={2} />
      ) : items.length === 0 ? (
        <div className="text-muted-foreground rounded-[12px] border border-border bg-card p-6 text-center text-sm leading-relaxed shadow-sm">
          <p>No applications found for this account yet.</p>
          <p className="mt-3">
            <Link href="/" className="text-link font-medium hover:underline">
              Start a new application
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-8">
          {items.map((row) => (
            <li
              key={row.applicationId}
              className="space-y-6 rounded-[12px] border border-border border-l-[3px] border-l-primary bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Reference
                  </p>
                  <p className="font-mono text-sm text-foreground">{row.referenceDisplay}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.serviceName} · {nationalityLabelWithFlag(row.nationalityCode, row.nationalityName)}
                  </p>
                  {row.paymentStatus === "unpaid" && row.draftExpiresAt ? (
                    <p className="text-muted-foreground text-xs">
                      Draft expires {new Date(row.draftExpiresAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0">
                  {isContinueDraft(row) ? (
                    <ClientButtonLink
                      href={`/apply/applications/${encodeURIComponent(row.applicationId)}`}
                      brand="cta"
                      size="sm"
                      className="h-9 px-4 text-xs font-bold"
                    >
                      Continue
                    </ClientButtonLink>
                  ) : (
                    <ClientButtonLink
                      href={`/apply/applications/${encodeURIComponent(row.applicationId)}`}
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-xs font-semibold"
                    >
                      Open
                    </ClientButtonLink>
                  )}
                </div>
              </div>
              <ApplicationClientTracking tracking={row.clientTracking} />
            </li>
          ))}
        </ul>
      )}

      {loading && items.length > 0 ? (
        <ClientInlineLoading label="Loading more applications…" />
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

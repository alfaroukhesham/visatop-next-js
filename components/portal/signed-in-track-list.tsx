"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClientInlineLoading, ClientTrackListSkeleton } from "@/components/client/client-loading";
import { useCustomerT } from "@/components/client/customer-i18n-provider";

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
  const t = useCustomerT();
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
            ? (json.error?.message ?? t("track.signedInLoadError"))
            : t("track.signedInLoadError"),
        );
        return;
      }
      setItems((prev) =>
        cursor ? [...prev, ...json.data.items] : json.data.items,
      );
      setNextCursor(json.data.nextCursor);
    } catch {
      setError(t("track.networkError"));
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
          <p>{t("track.signedInEmpty")}</p>
          <p className="mt-3">
            <Link href="/" className="text-link font-medium hover:underline">
              {t("track.startNewApplication")}
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
                    {t("track.referenceLabel")}
                  </p>
                  <p className="font-mono text-sm text-foreground">{row.referenceDisplay}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.serviceName} · {nationalityLabelWithFlag(row.nationalityCode, row.nationalityName)}
                  </p>
                  {row.paymentStatus === "unpaid" && row.draftExpiresAt ? (
                    <p className="text-muted-foreground text-xs">
                      {t("track.draftExpires", {
                        date: new Date(row.draftExpiresAt).toLocaleString(),
                      })}
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
                      {t("track.continue")}
                    </ClientButtonLink>
                  ) : (
                    <ClientButtonLink
                      href={`/apply/applications/${encodeURIComponent(row.applicationId)}`}
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-xs font-semibold"
                    >
                      {t("track.open")}
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
        <ClientInlineLoading label={t("track.loadingMore")} />
      ) : null}

      {nextCursor && !loading ? (
        <div className="flex justify-center">
          <ClientButton
            type="button"
            variant="secondary"
            onClick={() => void load(nextCursor)}
            className="font-semibold"
          >
            {t("track.loadMore")}
          </ClientButton>
        </div>
      ) : null}
    </section>
  );
}

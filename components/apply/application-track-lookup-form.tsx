"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { nationalityLabelWithFlag } from "@/lib/apply/display-names";
import { apiHref } from "@/lib/app-href";
import type { ClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";
import { ClientInlineLoading, ClientTrackListSkeleton } from "@/components/client/client-loading";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";

type TrackApplicationRow = {
  applicationId: string;
  referenceDisplay: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  nationalityName: string;
  paymentStatus: string;
  clientTracking: ClientApplicationTracking;
  canContinue: boolean;
  continueHref: string | null;
};

type TrackOk = {
  ok: true;
  data: { applications: TrackApplicationRow[]; nextCursor: string | null };
};

type TrackErr = {
  ok: false;
  error?: { message?: string; code?: string };
};

export function ApplicationTrackLookupForm() {
  const t = useCustomerT();
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackApplicationRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const hadResultsRef = useRef(false);

  async function runLookup(opts: { reset: boolean; cursor: string | null }) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiHref("/applications/track-lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: contact.trim(),
          limit: 5,
          cursor: opts.cursor,
        }),
      });
      const json = (await res.json()) as TrackOk | TrackErr;
      if (!res.ok || !json.ok) {
        const msg =
          json.ok === false
            ? (json.error?.message ?? t("track.genericError"))
            : t("track.genericError");
        setError(msg);
        return;
      }
      setNextCursor(json.data.nextCursor);
      setResults((prev) =>
        opts.reset ? json.data.applications : [...(prev ?? []), ...json.data.applications],
      );
      hadResultsRef.current = true;
    } catch {
      setError(t("track.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResults(null);
    setNextCursor(null);
    await runLookup({ reset: true, cursor: null });
  }

  useOnBfcacheRestore(() => {
    if (!hadResultsRef.current || !contact.trim()) return;
    void runLookup({ reset: true, cursor: null });
  });

  return (
    <div className="space-y-10">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-6 rounded-[12px] border border-border bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8"
      >
        <ClientField
          id="contact"
          label={t("track.contactLabel")}
          hint={t("track.contactHint")}
        >
          <ClientInput
            id="contact"
            name="contact"
            autoComplete="username"
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="rounded-[5px] border-border"
            placeholder={t("track.contactPlaceholder")}
          />
        </ClientField>
        {error ? (
          <p className="text-error text-sm leading-relaxed" role="alert">
            {error}
          </p>
        ) : null}
        <ClientButton type="submit" brand="cta" disabled={loading} className="font-semibold">
            {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              {t("track.lookingUp")}
            </>
          ) : (
            t("track.showApplications")
          )}
        </ClientButton>
      </form>

      {loading && results === null ? (
        <ClientTrackListSkeleton count={2} />
      ) : results !== null ? (
        <section className="space-y-8" aria-live="polite">
          {results.length === 0 ? (
            <p className="text-muted-foreground rounded-[12px] border border-border bg-card p-6 text-center text-sm leading-relaxed shadow-sm">
              {t("track.noResultsGuest")}
            </p>
          ) : (
            <ul className="space-y-8">
              {results.map((row) => (
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
                    </div>
                    <div className="shrink-0">
                      {row.canContinue && row.continueHref ? (
                        <ClientButtonLink
                          href={row.continueHref}
                          brand="cta"
                          size="sm"
                          className="h-9 px-4 text-xs font-bold"
                        >
                          {t("track.continue")}
                        </ClientButtonLink>
                      ) : row.paymentStatus === "paid" ? (
                        <ClientButtonLink
                          href={`/apply/applications/${encodeURIComponent(row.applicationId)}/submitted`}
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 text-xs font-semibold"
                        >
                          {t("track.viewStatus")}
                        </ClientButtonLink>
                      ) : null}
                    </div>
                  </div>
                  <ApplicationClientTracking tracking={row.clientTracking} />
                </li>
              ))}
            </ul>
          )}
          {loading && results.length > 0 ? (
            <ClientInlineLoading label={t("track.loadingMore")} />
          ) : null}
          {nextCursor && !loading ? (
            <div className="flex justify-center">
              <ClientButton
                type="button"
                variant="secondary"
                onClick={() => void runLookup({ reset: false, cursor: nextCursor })}
                className="font-semibold"
              >
                {t("track.loadMore")}
              </ClientButton>
            </div>
          ) : null}
          <p className="text-muted-foreground border-t border-border pt-4 text-xs leading-relaxed">
            {t("track.guestLookupFooter")}
          </p>
        </section>
      ) : null}
    </div>
  );
}

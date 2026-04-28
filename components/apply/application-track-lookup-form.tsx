"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { apiHref } from "@/lib/app-href";
import type { ClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";

type TrackApplicationRow = {
  applicationId: string;
  referenceDisplay: string;
  nationalityCode: string;
  serviceId: string;
  clientTracking: ClientApplicationTracking;
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
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackApplicationRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

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
            ? (json.error?.message ?? "Something went wrong. Try again later.")
            : "Something went wrong. Try again later.";
        setError(msg);
        return;
      }
      setNextCursor(json.data.nextCursor);
      setResults((prev) =>
        opts.reset ? json.data.applications : [...(prev ?? []), ...json.data.applications],
      );
    } catch {
      setError("Network error. Check your connection and try again.");
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

  return (
    <div className="space-y-10">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-6 rounded-[12px] border border-border bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8"
      >
        <ClientField
          id="contact"
          label="Email or phone"
          hint="We list every application where this guest email, your account email (if linked), or this phone number on the application profile matches."
        >
          <ClientInput
            id="contact"
            name="contact"
            autoComplete="username"
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="rounded-[5px] border-border"
            placeholder="you@example.com or +971…"
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
              Looking up…
            </>
          ) : (
            "Show applications"
          )}
        </ClientButton>
      </form>

      {results !== null ? (
        <section className="space-y-8" aria-live="polite">
          {results.length === 0 ? (
            <p className="text-muted-foreground rounded-[12px] border border-border bg-card p-6 text-center text-sm leading-relaxed shadow-sm">
              No applications found for that email or phone. Check for typos, or use the same email you entered when
              you started as a guest.
            </p>
          ) : (
            <ul className="space-y-8">
              {results.map((row) => (
                <li
                  key={row.applicationId}
                  className="space-y-6 rounded-[12px] border border-border border-l-[3px] border-l-primary bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8"
                >
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Reference</p>
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
          {nextCursor ? (
            <div className="flex justify-center">
              <ClientButton
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => void runLookup({ reset: false, cursor: nextCursor })}
                className="font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </ClientButton>
            </div>
          ) : null}
          <p className="text-muted-foreground border-t border-border pt-4 text-xs leading-relaxed">
            To upload documents or pay, open the application from the same browser you started with, or sign in if you
            linked it to your account.
          </p>
        </section>
      ) : null}
    </div>
  );
}

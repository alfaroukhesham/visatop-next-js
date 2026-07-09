"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClientServiceCardsSkeleton,
  ClientStartStepSkeleton,
} from "@/components/client/client-loading";
import { ChevronDown, Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { convertMinorBetweenUsdAed, parsePublicDisplayFxAedPerUsd } from "@/lib/catalog/display-price";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { trackEvent } from "@/lib/analytics/gtag-client";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { cn } from "@/lib/utils";

type Nationality = { code: string; name: string };
type Service = {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
  displayPriceMinor: string | null;
  currency: string | null;
};

type DisplayCurrency = "USD" | "AED";

function formatDisplayMinor(minor: string | null, currency: string | null): string | null {
  if (minor === null || currency === null) return null;
  const n = Number(minor);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
}

function formatPriceForDisplay(
  s: Service,
  tab: DisplayCurrency,
): { text: string; isEstimate: boolean } | null {
  const minorStr = s.displayPriceMinor;
  const cur = s.currency;
  if (minorStr === null || cur === null) return null;
  const n = Number(minorStr);
  if (!Number.isFinite(n)) return null;
  const minor = BigInt(Math.trunc(n));
  if (cur === tab) {
    const text = formatDisplayMinor(minorStr, cur);
    return text ? { text, isEstimate: false } : null;
  }
  const fx = parsePublicDisplayFxAedPerUsd();
  if (!fx) return null;
  const converted = convertMinorBetweenUsdAed(minor, cur, tab, fx);
  if (!converted) return null;
  const text = formatDisplayMinor(converted.toString(), tab);
  return text ? { text, isEstimate: true } : null;
}

function entriesLabel(entries: string | null): string | null {
  if (!entries) return null;
  const e = entries.toLowerCase();
  if (e.includes("multi")) return "Multiple entry";
  if (e.includes("single")) return "Single entry";
  return entries;
}

type StartApplicationFormProps = {
  /** Set on home; this page is only reachable as `/apply/start?nationality=XX`. */
  initialNationalityCode: string;
};

export function StartApplicationForm({ initialNationalityCode }: StartApplicationFormProps) {
  const router = useRouter();
  const sessionEmail = useClientAuthStore((s) => s.session?.user?.email);
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [nationality, setNationality] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [email, setEmail] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogReloadEpoch, setCatalogReloadEpoch] = useState(0);

  const reloadCatalog = useCallback(() => {
    setCatalogReloadEpoch((n) => n + 1);
  }, [nationality]);

  useOnBfcacheRestore(reloadCatalog);

  useEffect(() => {
    const fromSession = sessionEmail?.trim();
    if (!fromSession) return;
    queueMicrotask(() => {
      setEmail((current) => (current.trim() ? current : fromSession));
    });
  }, [sessionEmail]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoadingList(true);
        try {
          const res = await fetchApiEnvelope<{ nationalities: Nationality[] }>(
            apiHref("/catalog/nationalities"),
          );
          if (cancelled) return;
          if (!res.ok) {
            setError(res.error.message);
            setNationalities([]);
          } else {
            const list = res.data.nationalities;
            setNationalities(list);
            setError(null);
            const upper =
              initialNationalityCode && initialNationalityCode.length === 2
                ? initialNationalityCode.toUpperCase()
                : null;
            if (upper && list.some((n) => n.code === upper)) {
              setNationality(upper);
            }
          }
        } finally {
          if (!cancelled) setLoadingList(false);
        }
      })();
    });
    return () => {
      cancelled = true;
      setLoadingList(false);
    };
  }, [initialNationalityCode, catalogReloadEpoch]);

  const nationalityCode = initialNationalityCode.trim().toUpperCase();
  const nationalityUnavailable =
    !loadingList &&
    (nationalityCode.length !== 2 ||
      nationalities.length === 0 ||
      !nationalities.some((n) => n.code === nationalityCode));

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!nationality || nationality.length !== 2) {
        setServices([]);
        setServiceId("");
        return;
      }
      void (async () => {
        setLoadingServices(true);
        try {
          const res = await fetchApiEnvelope<{ services: Service[] }>(
            apiHref(
              `/catalog/services?nationality=${encodeURIComponent(nationality)}&currency=${encodeURIComponent(displayCurrency)}`,
            ),
          );
          if (cancelled) return;
          if (!res.ok) {
            setError(res.error.message);
            setServices([]);
          } else {
            setServices(res.data.services);
            setServiceId("");
            setError(null);
          }
        } finally {
          if (!cancelled) setLoadingServices(false);
        }
      })();
    });
    return () => {
      cancelled = true;
      setLoadingServices(false);
    };
  }, [nationality, displayCurrency, catalogReloadEpoch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!nationality || !serviceId) {
      setError("Choose a service.");
      return;
    }
    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      nationalityCode: nationality,
      serviceId,
      catalogCurrency: displayCurrency,
      guestEmail: trimmedEmail.toLowerCase(),
    };
    const res = await fetchApiEnvelope<{ application: { id: string; isGuest: boolean } }>(
      apiHref("/applications"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    trackEvent(APPLY_FUNNEL_EVENTS.applicationCreated, {
      nationality,
      service_id: serviceId,
      currency: displayCurrency,
      application_id: res.data.application.id,
      is_guest: res.data.application.isGuest,
    });
    router.push(`/apply/applications/${res.data.application.id}`);
  }

  if (loadingList) {
    return (
      <div className="pb-24" aria-busy="true">
        <ClientStartStepSkeleton />
      </div>
    );
  }

  if (nationalityUnavailable) {
    return (
      <div className="space-y-4 pb-24">
        <p className="text-muted-foreground text-sm leading-relaxed" role="alert">
          We could not load visa options for nationality{" "}
          <span className="text-foreground font-semibold">{nationalityCode || "—"}</span>. Return to the
          home page and choose your nationality again.
        </p>
        <ClientButton type="button" brand="cta" onClick={() => router.push("/")}>
          Back to home
        </ClientButton>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10 pb-24">
      {error ? (
        <p className="text-error border-error/30 bg-error/5 text-sm leading-relaxed border-b-2 pl-3">
          {error}
        </p>
      ) : null}

      {nationality ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-heading text-foreground text-lg font-semibold tracking-tight">Show prices in</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Prices follow the currency you select. If we show an estimate in the other currency, we confirm the exact
              total at checkout.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["USD", "AED"] as const).map((c) => {
              const active = displayCurrency === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDisplayCurrency(c)}
                  className={cn(
                    "border-border bg-card flex flex-col items-center justify-center gap-2 rounded-[12px] border-2 px-4 py-8 text-center transition-shadow",
                    active
                      ? "border-primary shadow-[0_8px_28px_rgba(1,32,49,0.12)] ring-2 ring-[color:var(--ring)] ring-offset-2 ring-offset-background"
                      : "hover:border-secondary hover:shadow-sm",
                  )}
                >
                  <span className="text-4xl leading-none" aria-hidden>
                    {c === "USD" ? "🇺🇸" : "🇦🇪"}
                  </span>
                  <span className="text-foreground text-sm font-semibold">
                    {c === "USD" ? "United States (US) dollar" : "United Arab Emirates dirham"}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <h2 className="font-heading text-foreground text-lg font-semibold tracking-tight">Visa type</h2>
            <p className="text-muted-foreground mt-1 text-sm">Choose duration and entry ,  tap a card to select.</p>
          </div>

          {!nationality ? null : loadingServices ? (
            <ClientServiceCardsSkeleton />
          ) : services.length === 0 ? (
            <p className="text-muted-foreground text-sm">No services for this nationality.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((s) => {
                const price = formatPriceForDisplay(s, displayCurrency);
                const entry = entriesLabel(s.entries);
                const selected = serviceId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={cn(
                      "border-border bg-card group flex flex-col rounded-[12px] border-2 text-left transition-colors",
                      selected
                        ? "border-primary bg-accent/25 shadow-[0_10px_32px_rgba(1,32,49,0.12)]"
                        : "hover:border-secondary",
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-1 flex-col gap-2 px-4 pb-3 pt-5",
                        selected && "text-foreground",
                      )}
                    >
                      {s.durationDays != null ? (
                        <p className="font-heading text-center text-xl font-bold uppercase tracking-tight sm:text-2xl">
                          {s.durationDays} days
                        </p>
                      ) : null}
                      {entry ? (
                        <p className="text-muted-foreground text-center text-[11px] font-bold uppercase tracking-widest">
                          {entry}
                        </p>
                      ) : null}
                      <div className="border-border my-1 border-t" />
                      <p className="text-foreground line-clamp-2 text-center text-sm font-semibold leading-snug">
                        {s.name}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "text-primary px-4 py-4 text-center",
                        selected && "bg-primary/10",
                      )}
                    >
                      {price ? (
                        <>
                          <p className="font-heading text-xl font-bold tabular-nums sm:text-2xl">{price.text}</p>
                          {price.isEstimate ? (
                            <p className="text-muted-foreground mt-1 text-[10px] font-medium uppercase tracking-wide">
                              Estimated at checkout
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-muted-foreground text-sm">Price at checkout</p>
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-primary flex flex-col items-center gap-1 px-4 pb-4 pt-1 text-xs font-bold uppercase tracking-widest",
                        selected && "text-accent-foreground bg-accent",
                      )}
                    >
                      <span>{selected ? "Selected" : "Choose"}</span>
                      <ChevronDown className="size-4 shrink-0 opacity-80" aria-hidden />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <ClientField id="apply-email" label="Email *">
            <ClientInput
              id="apply-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-[5px]"
            />
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              We’ll send application updates and your receipt to this address.
            </p>
          </ClientField>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ClientButton
          type="submit"
          brand="cta"
          onClick={() => router.push("/")}
          className="justify-center font-semibold"
        >
          Previous
        </ClientButton>
        <ClientButton
          type="submit"
          brand="cta"
          disabled={submitting || loadingList}
          className="justify-center font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Loading…
            </>
          ) : (
            "Next"
          )}
        </ClientButton>
        {/* <ClientNavLink href="/portal" className="text-muted-foreground hover:text-foreground text-sm pb-1">
          My applications
        </ClientNavLink>
        <ClientNavLink href="/apply/track" className="text-muted-foreground hover:text-foreground text-sm pb-1">
          Track an application →
        </ClientNavLink> */}
      </div>
    </form>
  );
}

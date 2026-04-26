"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { ClientNavLink } from "@/components/client/client-nav-link";
import { NationalityCombobox } from "@/components/client/nationality-combobox";
import { convertMinorBetweenUsdAed, parsePublicDisplayFxAedPerUsd } from "@/lib/catalog/display-price";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { authClient } from "@/lib/auth-client";
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
  /** Prefill when opened from home via `/apply/start?nationality=XX`. */
  initialNationalityCode?: string;
};

export function StartApplicationForm({ initialNationalityCode }: StartApplicationFormProps = {}) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [nationality, setNationality] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("USD");
  const [guestEmail, setGuestEmail] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoadingList(true);
        const res = await fetchApiEnvelope<{ nationalities: Nationality[] }>("/api/catalog/nationalities");
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
        setLoadingList(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [initialNationalityCode]);

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
        const res = await fetchApiEnvelope<{ services: Service[] }>(
          `/api/catalog/services?nationality=${encodeURIComponent(nationality)}&currency=${encodeURIComponent(displayCurrency)}`,
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
        setLoadingServices(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [nationality, displayCurrency]);

  const selectedNat = useMemo(
    () => nationalities.find((n) => n.code === nationality),
    [nationalities, nationality],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nationality || !serviceId) {
      setError("Choose a nationality and a service.");
      return;
    }
    if (!session?.user) {
      const ge = guestEmail.trim();
      if (!ge) {
        setError("Email is required when you are not signed in.");
        return;
      }
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      nationalityCode: nationality,
      serviceId,
      catalogCurrency: displayCurrency,
    };
    if (guestEmail.trim()) body.guestEmail = guestEmail.trim();
    const res = await fetchApiEnvelope<{ application: { id: string; isGuest: boolean } }>(
      "/api/applications",
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
    router.push(`/apply/applications/${res.data.application.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10 pb-24">
      {error ? (
        <p className="text-error border-error/30 bg-error/5 text-sm leading-relaxed border-l-4 pl-3">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-foreground text-lg font-semibold tracking-tight">Nationality</h2>
          {nationality ? (
            <button
              type="button"
              className="text-link text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => {
                setNationality("");
                setServiceId("");
                setServices([]);
              }}
            >
              Change
            </button>
          ) : null}
        </div>
        {loadingList ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading countries…
          </p>
        ) : (
          <NationalityCombobox
            id="apply-start-nationality"
            nationalities={nationalities}
            valueCode={nationality || null}
            onSelectCode={(code) => {
              setNationality(code);
              setServiceId("");
            }}
            placeholder="Type country name or ISO code…"
            size="hero"
          />
        )}
        {selectedNat ? (
          <p className="text-muted-foreground text-xs">
            We double-check eligibility when your application file is created.
          </p>
        ) : null}
      </section>

      {nationality ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-heading text-foreground text-lg font-semibold tracking-tight">Pay in</h2>
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
            <p className="text-muted-foreground mt-1 text-sm">Choose duration and entry — tap a card to select.</p>
          </div>

          {!nationality ? null : loadingServices ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading services…
            </p>
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
        </section>
      ) : null}

      <ClientField
        id="email"
        label={session?.user ? "Contact email (optional)" : "Email"}
        hint={
          session?.user
            ? "Leave blank to use your account email for updates."
            : "Required. We send status and payment updates here. Continue on this device until you pay, or sign in to sync across devices."
        }
      >
        <ClientInput
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          required={!session?.user}
          className="max-w-xl rounded-[5px] border-border"
        />
      </ClientField>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ClientButton
          type="submit"
          brand="cta"
          disabled={submitting || loadingList}
          className="justify-center font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create draft"
          )}
        </ClientButton>
        <ClientNavLink href="/portal" className="text-muted-foreground hover:text-foreground text-sm pb-1">
          My applications
        </ClientNavLink>
        <ClientNavLink href="/apply/track" className="text-muted-foreground hover:text-foreground text-sm pb-1">
          Track an application →
        </ClientNavLink>
      </div>
    </form>
  );
}

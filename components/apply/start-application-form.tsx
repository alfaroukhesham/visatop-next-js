"use client";

import { useCallback, useEffect, useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ClientServiceCardsSkeleton,
  ClientStartStepSkeleton,
} from "@/components/client/client-loading";
import { Loader2 } from "lucide-react";
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
import { nationalityDisplayName } from "@/lib/apply/display-names";
import { DEFAULT_APPLY_PRICE_BADGES, DEFAULT_PARTY_ENABLED, DEFAULT_PARTY_MAX_TRAVELERS, type TApplyPriceBadges } from "@/lib/apply/apply-config";
import { assertTravelersReady, canAddTraveler, type TPartyTravelerDraft } from "@/lib/apply/party-travelers";
import { filterGuidedServices } from "@/lib/apply/guided-visa-filter";
import type { TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";
import { AllInPriceBadges } from "@/components/apply/all-in-price-badges";
import { GuidedVisaChooser, type IService } from "@/components/apply/guided-visa-chooser";
import { cn } from "@/lib/utils";

type Nationality = { code: string; name: string };
type Service = IService;

type DisplayCurrency = "USD" | "AED";

const formatDisplayMinor = (minor: string | null, currency: string | null): string | null => {
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

const formatPriceForDisplay = (
  s: Service,
  tab: DisplayCurrency,
): { text: string; isEstimate: boolean } | null => {
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

const toDisplayMinor = (s: Service, tab: DisplayCurrency): number | null => {
  const minorStr = s.displayPriceMinor;
  const cur = s.currency;
  if (minorStr === null || cur === null) return null;
  const n = Number(minorStr);
  if (!Number.isFinite(n)) return null;
  const minor = BigInt(Math.trunc(n));
  if (cur === tab) return Number(minor);
  const fx = parsePublicDisplayFxAedPerUsd();
  if (!fx) return null;
  const converted = convertMinorBetweenUsdAed(minor, cur, tab, fx);
  if (converted === null) return null;
  return Number(converted);
}

interface IStartApplicationFormProps {
  /** Set on home; this page is only reachable as `/apply/start?nationality=XX`. */
  initialNationalityCode: string;
}

export const StartApplicationForm: FC<IStartApplicationFormProps> = ({ initialNationalityCode }) => {
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
  const [badges, setBadges] = useState<TApplyPriceBadges>(DEFAULT_APPLY_PRICE_BADGES);
  const [partyEnabled, setPartyEnabled] = useState(DEFAULT_PARTY_ENABLED);
  const [partyMaxTravelers, setPartyMaxTravelers] = useState(DEFAULT_PARTY_MAX_TRAVELERS);
  const [answers, setAnswers] = useState<{
    stay: TStayBucket | null;
    entry: "single" | "multiple";
    kind: TTravelerKind;
  }>({ stay: null, entry: "single", kind: "adult" });
  const [additionalTravelers, setAdditionalTravelers] = useState<TPartyTravelerDraft[]>([]);

  const reloadCatalog = useCallback(() => {
    setCatalogReloadEpoch((n) => n + 1);
  }, []);

  useOnBfcacheRestore(reloadCatalog);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchApiEnvelope<{
          badges: TApplyPriceBadges;
          partyEnabled: boolean;
          partyMaxTravelers: number;
        }>(apiHref("/catalog/apply-config"));
        if (cancelled) return;
        if (res.ok) {
          setBadges(res.data.badges);
          setPartyEnabled(res.data.partyEnabled);
          setPartyMaxTravelers(res.data.partyMaxTravelers);
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogReloadEpoch]);

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!nationality) {
      setError("Choose a service.");
      return;
    }
    const travelers: TPartyTravelerDraft[] = [
      { key: "primary", kind: answers.kind, serviceId },
      ...additionalTravelers,
    ];
    const ready = assertTravelersReady(travelers, partyMaxTravelers);
    if (!ready.ok) {
      setError(ready.message);
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
      travelers: travelers.map((t) => ({ serviceId: t.serviceId, kind: t.kind })),
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

  const addTraveler = () => {
    setAdditionalTravelers((prev) => [
      ...prev,
      { key: crypto.randomUUID(), kind: "adult", serviceId: "" },
    ]);
  }

  const removeTraveler = (key: string) => {
    setAdditionalTravelers((prev) => prev.filter((t) => t.key !== key));
  }

  const updateTraveler = (key: string, patch: Partial<TPartyTravelerDraft>) => {
    setAdditionalTravelers((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  const primaryService = services.find((s) => s.id === serviceId) ?? null;
  const selectedServices = [
    primaryService,
    ...additionalTravelers.map((t) => services.find((s) => s.id === t.serviceId) ?? null),
  ].filter((s): s is Service => s !== null);
  const totalMinor = (() => {
    let sum = 0;
    for (const s of selectedServices) {
      const m = toDisplayMinor(s, displayCurrency);
      if (m === null) return null;
      sum += m;
    }
    return sum;
  })();
  const totalText =
    totalMinor === null ? null : formatDisplayMinor(totalMinor.toString(), displayCurrency);

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
          We could not load visa options for{" "}
          <span className="text-foreground font-semibold">
            {nationalityDisplayName(nationalityCode, nationalities)}
          </span>
          . Return to the home page and choose your nationality again.
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-foreground text-lg font-semibold tracking-tight">
                Find your visa
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Answer one question at a time. We only show visas that match.
              </p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Show prices in">
              {(["USD", "AED"] as const).map((c) => {
                const active = displayCurrency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDisplayCurrency(c)}
                    className={cn(
                      "rounded-[5px] border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-secondary",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <AllInPriceBadges badges={badges} />

          {!nationality ? null : loadingServices ? (
            <ClientServiceCardsSkeleton />
          ) : (
            <GuidedVisaChooser
              services={services}
              formatPrice={(s) => formatPriceForDisplay(s, displayCurrency)}
              selectedServiceId={serviceId}
              onSelectService={setServiceId}
              partyEnabled={partyEnabled}
              canAddTraveler={canAddTraveler(additionalTravelers.length + 1, partyMaxTravelers)}
              onAddTraveler={addTraveler}
              onAnswersChange={setAnswers}
            />
          )}

          {partyEnabled && additionalTravelers.length > 0 ? (
            <div className="space-y-4">
              {additionalTravelers.map((t, idx) => {
                const shortlist = answers.stay
                  ? (() => {
                      const ids = new Set(
                        filterGuidedServices(services, {
                          stay: answers.stay,
                          entry: answers.entry,
                          kind: t.kind,
                        }).map((s) => s.id),
                      );
                      return services.filter((s) => ids.has(s.id));
                    })()
                  : [];
                return (
                  <div
                    key={t.key}
                    className="border-border bg-card space-y-3 rounded-[12px] border-2 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-foreground text-sm font-semibold">
                        Traveller {idx + 2}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeTraveler(t.key)}
                        className="text-muted-foreground hover:text-error text-xs font-semibold uppercase tracking-widest"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["adult", "child"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => updateTraveler(t.key, { kind: k, serviceId: "" })}
                          className={cn(
                            "border-border bg-card text-foreground rounded-[12px] border-2 px-4 py-2 text-sm font-semibold transition-colors",
                            t.kind === k ? "border-primary bg-accent/25" : "hover:border-secondary",
                          )}
                        >
                          {k === "adult" ? "Adult" : "Child"}
                        </button>
                      ))}
                    </div>
                    <select
                      value={t.serviceId}
                      onChange={(e) => updateTraveler(t.key, { serviceId: e.target.value })}
                      className="border-border bg-card text-foreground w-full rounded-[5px] border-2 px-3 py-2 text-sm"
                    >
                      <option value="">Choose a visa</option>
                      {shortlist.map((s) => {
                        const price = formatPriceForDisplay(s, displayCurrency);
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {price ? ` — ${price.text}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          ) : null}

          <p className="text-muted-foreground text-xs leading-relaxed">
            Please note that prices do not include insurance, which may be mandatory in some cases.
          </p>

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

      {totalText ? (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 px-4 py-3">
          <p className="text-foreground text-sm font-semibold">Checkout total</p>
          <p className="font-heading text-foreground text-xl font-bold tabular-nums">{totalText}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ClientButton
          type="button"
          brand="cta"
          onClick={() => router.push("/")}
          className="justify-center font-semibold"
        >
          Previous
        </ClientButton>
        <ClientButton
          type="submit"
          brand="cta"
          disabled={submitting || loadingList || !serviceId}
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

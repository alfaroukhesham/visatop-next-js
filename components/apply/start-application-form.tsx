"use client";

import { useCallback, useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ClientServiceCardsSkeleton,
  ClientStartStepSkeleton,
} from "@/components/client/client-loading";
import { Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
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
import { filterPartyVisaOptions, stayOptionsForChooser, needsEntryQuestion, needsKindQuestion, type TChooserPhase } from "@/lib/apply/guided-visa-filter";
import type { TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";
import { AllInPriceBadges } from "@/components/apply/all-in-price-badges";
import { ApplyStepsRail } from "@/components/apply/apply-steps-rail";
import { GuidedVisaChooser, type IService } from "@/components/apply/guided-visa-chooser";
import { readChooserDraft, writeChooserDraft } from "@/lib/apply/chooser-draft-storage";
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

interface ISelectedVisaSummaryProps {
  service: Service;
  answers: { stay: TStayBucket | null; entry: "single" | "multiple"; kind: TTravelerKind };
  travelerCount: number;
  totalText: string | null;
  price: { text: string; isEstimate: boolean } | null;
  badges: TApplyPriceBadges;
}

const SelectedVisaSummary: FC<ISelectedVisaSummaryProps> = ({
  service,
  answers,
  travelerCount,
  totalText,
  price,
  badges,
}) => {
  const t = useCustomerT();
  return (
    <aside className="border-secondary/25 bg-card h-fit space-y-4 rounded-2xl border p-4 shadow-[0_12px_30px_rgba(1,32,49,0.08)] lg:sticky lg:top-24">
      <div>
        <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em]">{t("start.yourVisaEyebrow")}</p>
        <h2 className="font-heading text-foreground mt-1 text-lg font-bold leading-snug">{service.name}</h2>
      </div>
      <dl className="text-muted-foreground space-y-1.5 text-xs">
        {service.durationDays != null ? (
          <div className="flex justify-between gap-3">
            <dt>{t("start.stayLabel")}</dt>
            <dd className="text-foreground font-semibold">{t("start.stayDays", { count: service.durationDays })}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt>{t("start.travelersLabel")}</dt>
          <dd className="text-foreground font-semibold">{travelerCount}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t("start.entryLabel")}</dt>
          <dd className="text-foreground font-semibold">
            {answers.entry === "multiple" ? t("start.entryMultiple") : t("start.entrySingle")}
          </dd>
        </div>
        {answers.kind === "child" ? (
          <div className="flex justify-between gap-3">
            <dt>{t("start.travellerLabel")}</dt>
            <dd className="text-foreground font-semibold">{t("start.travellerChild")}</dd>
          </div>
        ) : null}
      </dl>
      <div className="border-border border-t pt-3">
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">{t("start.totalLabel")}</p>
        <p className="font-heading text-foreground mt-0.5 text-xl font-bold tabular-nums">
          {totalText ?? price?.text ?? t("start.atCheckout")}
        </p>
        {price?.isEstimate ? <p className="text-muted-foreground mt-1 text-[10px]">{t("start.estimatedTotal")}</p> : null}
      </div>
      <AllInPriceBadges badges={badges} />
    </aside>
  );
};

interface IChooserCardHeaderProps {
  nationalityName: string;
}

const ChooserCardHeader: FC<IChooserCardHeaderProps> = ({ nationalityName }) => {
  const t = useCustomerT();
  return (
    <header className="min-w-0 space-y-1">
      <h1 className="font-heading text-foreground text-xl! font-semibold leading-snug tracking-tight md:text-[1.75rem]!">
        {t("start.chooseVisaTitle")}
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("start.passportLabel")} <span className="text-foreground font-semibold">{nationalityName}</span>
      </p>
    </header>
  );
};

interface IStartApplicationFormProps {
  /** Set on home; this page is only reachable as `/apply/start?nationality=XX`. */
  initialNationalityCode: string;
  nationalityName: string;
}

export const StartApplicationForm: FC<IStartApplicationFormProps> = ({
  initialNationalityCode,
  nationalityName,
}) => {
  const t = useCustomerT();
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
  const [chooserPhase, setChooserPhase] = useState<TChooserPhase>("stay");
  const [draftRestored, setDraftRestored] = useState(false);
  const servicesRef = useRef<Service[]>([]);
  servicesRef.current = services;

  useEffect(() => {
    const restored = readChooserDraft(initialNationalityCode);
    if (restored) {
      setDisplayCurrency(restored.displayCurrency);
      setServiceId(restored.serviceId);
      setEmail(restored.email);
      setAnswers({ stay: restored.stay, entry: restored.entry, kind: restored.kind });
      setAdditionalTravelers(restored.additionalTravelers);
      setChooserPhase(restored.phase);
    }
    setDraftRestored(true);
  }, [initialNationalityCode]);

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
        const hadServices = servicesRef.current.length > 0;
        if (!hadServices) setLoadingServices(true);
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
            setError(null);
          }
        } finally {
          if (!cancelled) setLoadingServices(false);
        }
      })();
    });
    return () => {
      cancelled = true;
      if (servicesRef.current.length === 0) setLoadingServices(false);
    };
  }, [nationality, displayCurrency, catalogReloadEpoch]);

  useEffect(() => {
    if (!draftRestored || !nationality) return;
    writeChooserDraft(nationality, {
      displayCurrency,
      serviceId,
      stay: answers.stay,
      entry: answers.entry,
      kind: answers.kind,
      phase: chooserPhase,
      additionalTravelers,
      email,
    });
  }, [draftRestored, nationality, displayCurrency, serviceId, answers, chooserPhase, additionalTravelers, email]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!nationality) {
      setError(t("start.chooseServiceError"));
      return;
    }
    const travelers: TPartyTravelerDraft[] = [
      { key: "primary", kind: answers.kind, serviceId },
      ...additionalTravelers,
    ];
    const ready = assertTravelersReady(travelers, partyMaxTravelers);
    if (!ready.ok) {
      setError(
        ready.code === "maxTravelers"
          ? t("start.party.maxTravelers", { count: partyMaxTravelers })
          : t(`start.party.${ready.code}`),
      );
      return;
    }
    if (!trimmedEmail) {
      setError(t("start.enterEmailError"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t("start.enterValidEmailError"));
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

  const stayCount = stayOptionsForChooser(services).length;
  const chooserHasBack =
    chooserPhase === "kind" ||
    (chooserPhase === "entry" && stayCount > 1) ||
    (chooserPhase === "results" &&
      (stayCount > 1 ||
        Boolean(answers.stay && needsEntryQuestion(services, answers.stay)) ||
        Boolean(answers.stay && needsKindQuestion(services, answers.stay, answers.entry))));
  const showHomePrevious = !chooserHasBack;

  useEffect(() => {
    if (!answers.stay) return;
    setAdditionalTravelers((prev) => {
      let changed = false;
      const next = prev.map((traveler) => {
        const shortlist = filterPartyVisaOptions(services, {
          stay: answers.stay!,
          kind: traveler.kind,
        });
        if (shortlist.length === 1 && traveler.serviceId !== shortlist[0].id) {
          changed = true;
          return { ...traveler, serviceId: shortlist[0].id };
        }
        if (traveler.serviceId && !shortlist.some((s) => s.id === traveler.serviceId)) {
          changed = true;
          return { ...traveler, serviceId: shortlist.length === 1 ? shortlist[0].id : "" };
        }
        return traveler;
      });
      return changed ? next : prev;
    });
  }, [services, answers.stay, additionalTravelers]);

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
      <div className="space-y-6 pb-24" aria-busy="true">
        <ChooserCardHeader nationalityName={nationalityName} />
        <ClientStartStepSkeleton />
      </div>
    );
  }

  if (nationalityUnavailable) {
    return (
      <div className="space-y-4 pb-24">
        <ChooserCardHeader nationalityName={nationalityName} />
        <p className="text-muted-foreground text-sm leading-relaxed" role="alert">
          {t("start.nationalityUnavailable", {
            nationality: nationalityDisplayName(nationalityCode, nationalities),
          })}
        </p>
        <ClientButton type="button" brand="cta" onClick={() => router.push("/")}>
          {t("start.backToHome")}
        </ClientButton>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8 pb-24">
      {error ? (
        <p className="text-error border-error/30 bg-error/5 rounded-2xl border px-4 py-3 text-sm leading-relaxed">
          {error}
        </p>
      ) : null}

      {serviceId ? <ApplyStepsRail currentStep={2} /> : null}

      <div className={serviceId ? "lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-6" : undefined}>
        <div className={serviceId ? "order-2 min-w-0 lg:order-1" : undefined}>
      {nationality ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <ChooserCardHeader nationalityName={nationalityName} />
            <div className="flex items-center gap-1 sm:pt-1" role="group" aria-label={t("start.showPricesIn")}>
              {(["USD", "AED"] as const).map((c) => {
                const active = displayCurrency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDisplayCurrency(c)}
                    className={cn(
                      "rounded-xl border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest",
                      active ? "border-secondary bg-secondary text-white"
                        : "border-border bg-card text-foreground hover:border-secondary",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {!nationality ? null : !draftRestored || (loadingServices && services.length === 0) ? (
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
              onPhaseChange={setChooserPhase}
              initialPhase={chooserPhase}
              initialStay={answers.stay}
              initialEntry={answers.entry}
              initialKind={answers.kind}
            />
          )}

          {serviceId && partyEnabled && additionalTravelers.length > 0 ? (
            <div className="space-y-4">
              {additionalTravelers.map((traveler, idx) => {
                const shortlist = answers.stay
                  ? filterPartyVisaOptions(services, {
                      stay: answers.stay,
                      kind: traveler.kind,
                    }).flatMap((opt) => services.filter((s) => s.id === opt.id))
                  : [];
                return (
                  <div
                    key={traveler.key}
                    className="border-border bg-muted/30 space-y-4 rounded-2xl border-2 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-foreground text-sm font-semibold">
                        {t("start.party.travellerNumber", { number: idx + 2 })}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeTraveler(traveler.key)}
                        className="text-muted-foreground hover:text-error text-xs font-semibold uppercase tracking-widest"
                      >
                        {t("start.party.remove")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["adult", "child"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => updateTraveler(traveler.key, { kind: k, serviceId: "" })}
                          className={cn(
                            "border-border bg-card text-foreground rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-colors",
                            traveler.kind === k ? "border-primary bg-accent/25" : "hover:border-secondary",
                          )}
                        >
                          {k === "adult" ? t("start.party.adult") : t("start.party.child")}
                        </button>
                      ))}
                    </div>
                    {shortlist.length === 1 ? (
                      <p className="border-secondary/30 bg-card text-foreground rounded-xl border-2 px-3 py-3 text-sm font-semibold">
                        {shortlist[0].name}
                        {(() => {
                          const price = formatPriceForDisplay(shortlist[0], displayCurrency);
                          return price ? ` — ${price.text}` : "";
                        })()}
                      </p>
                    ) : (
                      <select
                        value={traveler.serviceId}
                        onChange={(e) => updateTraveler(traveler.key, { serviceId: e.target.value })}
                        className="border-border bg-card text-foreground w-full rounded-xl border-2 px-3 py-3 text-sm"
                      >
                        <option value="">{t("start.party.chooseVisaOption")}</option>
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
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {serviceId ? (
            <>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("start.priceIncludesNote")}
              </p>

              <div className="border-t border-border/80 pt-6">
                <ClientField id="apply-email" label={t("start.emailLabel")}>
                  <ClientInput
                    id="apply-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("start.emailPlaceholder")}
                    className="rounded-xl"
                  />
                  <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                    {t("start.emailHelper")}
                  </p>
                </ClientField>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {serviceId && totalText ? (
        <div className="border-secondary/20 bg-secondary/5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4">
          <p className="text-foreground text-sm font-semibold">{t("start.checkoutTotal")}</p>
          <p className="font-heading text-foreground text-xl font-bold tabular-nums">{totalText}</p>
        </div>
      ) : null}
        </div>
        {serviceId && primaryService ? <div className="order-1 lg:order-2"><SelectedVisaSummary service={primaryService} answers={answers} travelerCount={1 + additionalTravelers.length} totalText={totalText} price={formatPriceForDisplay(primaryService, displayCurrency)} badges={badges} /></div> : null}
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end">
        {showHomePrevious ? (
          <ClientButton
            type="button"
            brand="white"
            onClick={() => router.push("/")}
            className="w-full justify-center rounded-xl font-semibold sm:w-auto"
          >
            {t("start.previousButton")}
          </ClientButton>
        ) : null}
        {serviceId ? (
          <ClientButton
            type="submit"
            brand="cta"
            disabled={submitting || loadingList}
            className="w-full justify-center rounded-xl font-semibold sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t("start.loading")}
              </>
            ) : (
              t("start.continueWithVisa")
            )}
          </ClientButton>
        ) : null}
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

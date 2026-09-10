"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientOrderRecapSkeleton } from "@/components/client/client-loading";
import { AllInPriceBadges } from "@/components/apply/all-in-price-badges";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { convertMinorBetweenUsdAed, parsePublicDisplayFxAedPerUsd } from "@/lib/catalog/display-price";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import type { TPublicPartyMember } from "@/lib/applications/load-party-members";
import { DEFAULT_APPLY_PRICE_BADGES, type TApplyPriceBadges } from "@/lib/apply/apply-config";
import { formatIsoDateAsDdMmYyyy } from "@/lib/documents/validation-readiness";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

type CatalogService = {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
  displayPriceMinor: string | null;
  currency: string | null;
};

type DisplayCurrency = "USD" | "AED";

type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

const displayCurrencyFormatters = new Map<string, Intl.NumberFormat>();

function displayCurrencyFormatter(currency: string): Intl.NumberFormat {
  let fmt = displayCurrencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
    displayCurrencyFormatters.set(currency, fmt);
  }
  return fmt;
}

function formatDisplayMinor(minor: string | null, currency: string | null): string | null {
  if (minor === null || currency === null) return null;
  const n = Number(minor);
  if (!Number.isFinite(n)) return null;
  try {
    return displayCurrencyFormatter(currency).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
}

function priceMinorForDisplay(s: CatalogService, tab: DisplayCurrency): bigint | null {
  const minorStr = s.displayPriceMinor;
  const cur = s.currency;
  if (minorStr === null || cur === null) return null;
  const n = Number(minorStr);
  if (!Number.isFinite(n)) return null;
  const minor = BigInt(Math.trunc(n));
  if (cur === tab) return minor;
  const fx = parsePublicDisplayFxAedPerUsd();
  if (!fx) return null;
  return convertMinorBetweenUsdAed(minor, cur, tab, fx);
}

function formatPriceForDisplay(
  s: CatalogService,
  tab: DisplayCurrency,
): { text: string; isEstimate: boolean } | null {
  const minor = priceMinorForDisplay(s, tab);
  if (minor === null) return null;
  const text = formatDisplayMinor(minor.toString(), tab);
  return text ? { text, isEstimate: s.currency !== tab } : null;
}

const entriesLabel = (entries: string | null, t: TTranslate): string | null => {
  if (!entries) return null;
  const e = entries.toLowerCase();
  if (e.includes("multi")) return t("chooser.entryLabels.multiple");
  if (e.includes("single")) return t("chooser.entryLabels.single");
  return entries;
};

function serviceTitle(s: CatalogService, t: TTranslate): string {
  const parts: string[] = [];
  if (s.durationDays != null) parts.push(t("chooser.durationDays", { count: s.durationDays }));
  const ent = entriesLabel(s.entries, t);
  if (ent) parts.push(ent);
  parts.push(s.name);
  return parts.join(" · ");
}

const badgesAreDefault = (badges: TApplyPriceBadges): boolean =>
  badges.allFeesIncluded === DEFAULT_APPLY_PRICE_BADGES.allFeesIncluded &&
  badges.noHiddenCharges === DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges;

export const applicantForPaymentRecap = (
  ssr: PublicApplication["applicant"],
  live: PublicApplication["applicant"] | null,
): PublicApplication["applicant"] => live ?? ssr;

export function CheckoutOrderRecap({
  application,
  members = [],
}: {
  application: PublicApplication;
  members?: TPublicPartyMember[];
}) {
  const t = useCustomerT();
  const [services, setServices] = useState<CatalogService[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [badges, setBadges] = useState<TApplyPriceBadges>(DEFAULT_APPLY_PRICE_BADGES);
  const [liveApplicant, setLiveApplicant] = useState<PublicApplication["applicant"] | null>(null);
  const [liveApplicantResolved, setLiveApplicantResolved] = useState(false);

  const displayBadges = useMemo((): TApplyPriceBadges => {
    if (!badgesAreDefault(badges)) return badges;
    return {
      allFeesIncluded: t("payment.badges.allFeesIncluded"),
      noHiddenCharges: t("payment.badges.noHiddenCharges"),
    };
  }, [badges, t]);

  const currency = (application.catalogCurrency?.toUpperCase() === "AED" ? "AED" : "USD") as DisplayCurrency;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        const res = await fetchApiEnvelope<{ application: PublicApplication }>(
          apiHref(`/applications/${application.id}`),
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.ok) setLiveApplicant(res.data.application.applicant);
        setLiveApplicantResolved(true);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [application.id]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        const [res, cfg] = await Promise.all([
          fetchApiEnvelope<{
            services: CatalogService[];
          }>(
            apiHref(
              `/catalog/services?nationality=${encodeURIComponent(application.nationalityCode)}&currency=${encodeURIComponent(currency)}`,
            ),
          ),
          fetchApiEnvelope<{ badges: TApplyPriceBadges }>(apiHref("/catalog/apply-config")),
        ]);
        if (cancelled) return;
        if (cfg.ok) setBadges(cfg.data.badges);
        if (!res.ok) {
          setLoadError(res.error.message);
          setServices([]);
          return;
        }
        setLoadError(null);
        setServices(res.data.services);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [application.nationalityCode, currency]);

  const service = useMemo(
    () => services?.find((s) => s.id === application.serviceId) ?? null,
    [services, application.serviceId],
  );

  const price = useMemo(() => (service ? formatPriceForDisplay(service, currency) : null), [service, currency]);

  const memberLines = useMemo(() => {
    if (!services || members.length <= 1) return [];
    return members
      .slice()
      .sort((a, b) => a.travelerIndex - b.travelerIndex)
      .map((m) => {
        const s = services.find((x) => x.id === m.serviceId) ?? null;
        return {
          member: m,
          service: s,
          price: s ? formatPriceForDisplay(s, currency) : null,
        };
      });
  }, [services, members, currency]);

  const totalMinor = useMemo(() => {
    if (!services) return null;
    if (members.length <= 1) {
      return service ? priceMinorForDisplay(service, currency) : null;
    }
    let sum = BigInt(0);
    for (const line of memberLines) {
      const minor = line.service ? priceMinorForDisplay(line.service, currency) : null;
      if (minor === null) return null;
      sum += minor;
    }
    return sum;
  }, [services, members, memberLines, service, currency]);

  const totalText = totalMinor === null ? null : formatDisplayMinor(totalMinor.toString(), currency);

  const recapApplicant = applicantForPaymentRecap(application.applicant, liveApplicant);
  const fullName = recapApplicant.fullName?.trim() ?? "";
  const passportNo = recapApplicant.passportNumber?.trim() ?? "";
  const dob = formatIsoDateAsDdMmYyyy(recapApplicant.dateOfBirth ?? null) ?? "";
  const recapFieldsPending =
    !liveApplicantResolved && !fullName && !passportNo && !dob;

  const notAddedYet = <span className="text-muted-foreground">{t("payment.notAddedYet")}</span>;
  const recapPending = <span className="text-muted-foreground">{t("documents.readingPassport")}</span>;

  const recapValue = (value: string) => {
    if (value) return value;
    if (recapFieldsPending) return recapPending;
    return notAddedYet;
  };

  const contactEmailContent = () => {
    const em = application.guestEmail?.trim();
    if (em) return em;
    if (!application.isGuest) return t("payment.signInEmailForUpdates");
    return notAddedYet;
  };

  const subtotalText = price?.text ?? null;

  if (services === null) {
    return <ClientOrderRecapSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h3 className="font-heading text-foreground text-lg font-bold tracking-tight">{t("payment.orderTitle")}</h3>
      </div>

      <AllInPriceBadges badges={displayBadges} />

      <div className="text-muted-foreground flex justify-between gap-4 text-[10px] font-bold uppercase tracking-widest">
        <span>{t("payment.productColumn")}</span>
        <span>{t("payment.subtotalColumn")}</span>
      </div>

      {members.length > 1 ? (
        <div className="border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.06)] rounded-[12px] border p-4 sm:p-5">
          {loadError ? (
            <p className="text-error text-sm">{loadError}</p>
          ) : (
            <div className="space-y-4">
              {memberLines.map((line) => (
                <div key={line.member.applicationId} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-heading text-foreground text-sm font-bold leading-snug">
                      {t("payment.travellerLine", {
                        number: line.member.travelerIndex + 1,
                        service: line.member.serviceName,
                      })}
                    </p>
                    {line.service ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">{serviceTitle(line.service, t)}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    {line.price ? (
                      <p className="text-foreground font-heading text-base font-bold tabular-nums">{line.price.text}</p>
                    ) : (
                      <p className="text-muted-foreground text-sm">{t("payment.totalAtCheckout")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.06)] rounded-[12px] border p-4 sm:p-5">
          {loadError ? (
            <p className="text-error text-sm">{loadError}</p>
          ) : service ? (
            <>
              <p className="font-heading text-foreground text-base font-bold leading-snug">{serviceTitle(service, t)}</p>
              <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <dt className="sr-only">{t("payment.nameLabel")}</dt>
                  <dd>
                    <span className="font-medium text-foreground/80">{t("payment.nameLabel")}</span>{" "}
                    {recapValue(fullName)}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <dt className="sr-only">{t("payment.emailLabel")}</dt>
                  <dd>
                    <span className="font-medium text-foreground/80">{t("payment.emailLabel")}</span> {contactEmailContent()}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <dt className="sr-only">{t("payment.dateOfBirthLabel")}</dt>
                  <dd>
                    <span className="font-medium text-foreground/80">{t("payment.dateOfBirthLabel")}</span>{" "}
                    {recapValue(dob)}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <dt className="sr-only">{t("payment.passportLabel")}</dt>
                  <dd>
                    <span className="font-medium text-foreground/80">{t("payment.passportLabel")}</span>{" "}
                    {passportNo ? (
                      <span className="font-mono tabular-nums">{passportNo}</span>
                    ) : recapFieldsPending ? (
                      recapPending
                    ) : (
                      notAddedYet
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
                <p className="text-muted-foreground text-sm tabular-nums">{t("payment.quantityOne")}</p>
                <div className="text-right">
                  {subtotalText ? (
                    <p className="text-foreground font-heading text-lg font-bold tabular-nums">{subtotalText}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm">{t("payment.totalAtCheckout")}</p>
                  )}
                </div>
              </div>
              {price?.isEstimate ? (
                <p className="text-muted-foreground mt-2 text-[10px] font-medium uppercase tracking-wide">
                  {t("payment.estimatedCheckoutNote")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("payment.catalogUnavailable", { serviceId: application.serviceId })}
            </p>
          )}
        </div>
      )}

      {totalText ? (
        <div className="text-muted-foreground flex justify-between gap-4 text-sm">
          <span>{t("payment.total")}</span>
          <span className="text-foreground font-heading text-base font-bold tabular-nums">{totalText}</span>
        </div>
      ) : null}
    </div>
  );
}

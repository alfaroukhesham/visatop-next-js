"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { ClientOrderRecapSkeleton } from "@/components/client/client-loading";
import { AllInPriceBadges } from "@/components/apply/all-in-price-badges";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { useCheckoutQuoteOptional } from "@/components/apply/checkout-quote-provider";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import {
  catalogCurrencyTab,
  formatDisplayMinor,
  formatPriceForDisplay,
  priceMinorForDisplay,
} from "@/lib/catalog/format-catalog-price";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import type { TPublicPartyMember } from "@/lib/applications/load-party-members";
import { DEFAULT_APPLY_PRICE_BADGES, type TApplyPriceBadges } from "@/lib/apply/apply-config";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { rememberCheckoutRecapTotal } from "@/lib/analytics/checkout-recap-total";
import { trackEventOnce } from "@/lib/analytics/gtag-client";
import { setMetaAdvancedMatchingPhone } from "@/lib/analytics/meta-pixel-advanced-matching";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { formatIsoDateAsDdMmYyyy } from "@/lib/documents/validation-readiness";
import {
  extraByKey,
  formatMinorAmount,
  groupedExtraLines,
  localizedExtraCopy,
  quoteUsesCodeFormat,
  type TCheckoutExtraKey,
} from "@/lib/apply/checkout-extras-ui";
import { ProcessingSpeedLine } from "@/components/apply/processing-speed-line";
import type { TSettledRecap } from "@/lib/apply/charged-recap";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";
import { customerFacingServiceName } from "@/lib/apply/customer-service-name";

type CatalogService = {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
  displayPriceMinor: string | null;
  currency: string | null;
};

type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

const entriesLabel = (entries: string | null, t: TTranslate): string | null => {
  if (!entries) return null;
  const e = entries.toLowerCase();
  if (e.includes("multi")) return t("chooser.entryLabels.multiple");
  if (e.includes("single")) return t("chooser.entryLabels.single");
  return entries;
};

const compactFact = (value: string): string => value.toLowerCase().replace(/[\s\-–—·]/g, "");

const NAME_SAYS_MULTI_ENTRY = /\bmulti(ple)?[\s-]*entry\b/i;
const NAME_SAYS_SINGLE_ENTRY = /\bsingle[\s-]*entry\b/i;

/** Catalog name already states the entry kind, in any locale's translation of the fact. */
const catalogNameCoversEntry = (name: string, entries: string | null): boolean => {
  const kind = (entries ?? "").toLowerCase();
  if (kind.includes("multi")) return NAME_SAYS_MULTI_ENTRY.test(name);
  if (kind.includes("single")) return NAME_SAYS_SINGLE_ENTRY.test(name);
  return false;
};

/** Skip duration/entry already written in the catalog name ("14 Days - Single Entry"). */
const visaTitleLead = (service: CatalogService, t: TTranslate): string => {
  const normalizedName = compactFact(service.name);
  const parts: string[] = [];
  if (service.durationDays != null) {
    const dayLabel = t("chooser.durationDays", { count: service.durationDays });
    if (!normalizedName.includes(compactFact(dayLabel))) parts.push(dayLabel);
  }
  const ent = entriesLabel(service.entries, t);
  if (ent && !catalogNameCoversEntry(service.name, service.entries)) {
    const entryFact = compactFact(ent);
    const entryStem = entryFact.replace(/entry$/, "");
    if (!normalizedName.includes(entryFact) && !(entryStem && normalizedName.includes(entryStem))) {
      parts.push(ent);
    }
  }
  return parts.join(" · ");
};

export const CatalogVisaTitle: FC<{ service: CatalogService; t: TTranslate; locale?: string }> = ({
  service,
  t,
  locale = "en",
}) => {
  const localized = customerFacingServiceName(service.name, locale, t, {
    durationDays: service.durationDays,
    entries: service.entries,
  });
  if (localized !== service.name) {
    return (
      <bdi className="break-words" title={localized}>
        {localized}
      </bdi>
    );
  }
  const lead = visaTitleLead(service, t);
  return (
    <>
      {lead ? <>{lead} · </> : null}
      <bdi className="break-words" title={service.name}>
        {service.name}
      </bdi>
    </>
  );
};

export const PartyMemberLine: FC<{ template: string; serviceName: string }> = ({
  template,
  serviceName,
}) => {
  const [before, after = ""] = template.split("\u0000");
  return (
    <>
      {before}
      <bdi>{serviceName}</bdi>
      {after}
    </>
  );
};

const badgesAreDefault = (badges: TApplyPriceBadges): boolean =>
  badges.allFeesIncluded === DEFAULT_APPLY_PRICE_BADGES.allFeesIncluded &&
  badges.noHiddenCharges === DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges;

export const applicantForPaymentRecap = (
  ssr: PublicApplication["applicant"],
  live: PublicApplication["applicant"] | null,
): PublicApplication["applicant"] => live ?? ssr;

interface ICheckoutOrderRecapProps {
  application: PublicApplication;
  members?: TPublicPartyMember[];
  /** Payment page only — documents/thank-you recaps also reuse this UI. */
  trackCheckoutViewed?: boolean;
  /** Server quote or the charged payment. When set, the total is not computed in the browser. */
  settled?: TSettledRecap | null;
  /** Pay renders the speed line inside "Your order". Documents keeps it on this card. */
  showProcessingSpeed?: boolean;
  /** Pay already titles the in-flow order card. Hide this copy of the same heading. */
  showTitle?: boolean;
}

export const CheckoutOrderRecap: FC<ICheckoutOrderRecapProps> = ({
  application,
  members = [],
  trackCheckoutViewed = false,
  settled = null,
  showProcessingSpeed = true,
  showTitle = true,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const quoteState = useCheckoutQuoteOptional();
  const signedInUserId = useClientAuthStore((s) => s.session?.user?.id);
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

  const currency = catalogCurrencyTab(
    application.checkoutOffer?.currency || application.catalogCurrency || "USD",
  );

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
    if (settled || quoteState) return null;
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
  }, [settled, quoteState, services, members, memberLines, service, currency]);

  const serverPreview = quoteState?.preview ?? null;
  const usingServerQuote = settled !== null || quoteState !== null;
  const amountCurrency = serverPreview?.currency ?? settled?.currency ?? currency;
  const resolvedTotalMinor = usingServerQuote
    ? serverPreview
      ? BigInt(serverPreview.totalAmountMinor)
      : settled
        ? BigInt(settled.totalAmountMinor)
        : null
    : totalMinor;
  const quoteFormat = serverPreview
    ? quoteUsesCodeFormat(serverPreview)
      ? "code"
      : "symbol"
    : settled !== null
      ? settled.extraLines.length > 0
        ? "code"
        : "symbol"
      : "symbol";
  const formatQuote = (minor: string): string =>
    usingServerQuote
      ? formatMinorAmount(minor, amountCurrency, locale, quoteFormat)
      : (formatDisplayMinor(minor, currency) ?? "");
  const visaAmountText = (applicationId: string, fallback: string | null): string | null => {
    if (!usingServerQuote) return fallback;
    const lines = serverPreview?.visaLines ?? settled?.visaLines ?? null;
    if (!lines) return null;
    const minor = lines.find((line) => line.applicationId === applicationId)?.amountMinor ?? null;
    return minor ? formatQuote(minor) : fallback;
  };
  const extraLineLabel = (key: TCheckoutExtraKey): string =>
    key === "fast_track" ? t("extras.recap.fastTrack") : t("extras.recap.insurance");
  const extraRows = groupedExtraLines({
    extraLines: serverPreview?.extraLines ?? settled?.extraLines ?? [],
  });

  const totalText =
    resolvedTotalMinor === null ? null : formatQuote(resolvedTotalMinor.toString());

  useEffect(() => {
    if (resolvedTotalMinor === null) return;
    rememberCheckoutRecapTotal({
      applicationId: application.id,
      value: Number(resolvedTotalMinor) / 100,
      currency: amountCurrency,
      nationality: application.nationalityCode,
      serviceId: application.serviceId,
    });
    if (!trackCheckoutViewed) return;
    trackEventOnce(
      APPLY_FUNNEL_EVENTS.checkoutViewed,
      {
        application_id: application.id,
        nationality: application.nationalityCode,
        service_id: application.serviceId,
        currency: amountCurrency,
        value: Number(resolvedTotalMinor) / 100,
        traveler_count: Math.max(members.length, 1),
      },
      `${APPLY_FUNNEL_EVENTS.checkoutViewed}:${application.id}`,
    );
  }, [
    trackCheckoutViewed,
    resolvedTotalMinor,
    serverPreview?.currency,
    amountCurrency,
    application.id,
    application.nationalityCode,
    application.serviceId,
    currency,
    members.length,
  ]);

  const recapApplicant = applicantForPaymentRecap(application.applicant, liveApplicant);

  useEffect(() => {
    if (!signedInUserId) return;
    setMetaAdvancedMatchingPhone(recapApplicant.phone);
  }, [signedInUserId, recapApplicant.phone]);
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

  if (services === null || (quoteState?.loading && !serverPreview && !settled)) {
    return <ClientOrderRecapSkeleton />;
  }

  return (
    <div className="space-y-4" data-clarity-mask="true">
      {showTitle ? (
        <div className="flex items-end justify-between gap-4">
          <h3 className="font-heading text-foreground text-lg font-bold tracking-tight">{t("payment.orderTitle")}</h3>
        </div>
      ) : null}

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
                  <div className="min-w-0">
                    <p className="font-heading text-foreground min-w-0 break-words text-pretty text-sm font-bold leading-snug">
                      <PartyMemberLine
                        template={t("payment.travellerLine", {
                          number: line.member.travelerIndex + 1,
                          service: "\u0000",
                        })}
                        serviceName={customerFacingServiceName(line.member.serviceName, locale, t, {
                          durationDays: line.service?.durationDays,
                          entries: line.service?.entries,
                        })}
                      />
                    </p>
                    {line.service ? (
                      <p className="text-muted-foreground mt-0.5 min-w-0 break-words text-pretty text-xs">
                        <CatalogVisaTitle service={line.service} t={t} locale={locale} />
                      </p>
                    ) : null}
                  </div>
                  <div className="text-end">
                    {visaAmountText(line.member.applicationId, line.price?.text ?? null) ? (
                      <p className="text-foreground font-heading text-base font-bold tabular-nums">
                        <bdi>{visaAmountText(line.member.applicationId, line.price?.text ?? null)}</bdi>
                      </p>
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
              <p className="font-heading text-foreground min-w-0 break-words text-pretty text-base font-bold leading-snug">
                <CatalogVisaTitle service={service} t={t} locale={locale} />
              </p>
              <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm" data-clarity-mask="true">
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
                <div className="text-end">
                  {visaAmountText(application.id, subtotalText) ? (
                    <p className="text-foreground font-heading text-lg font-bold tabular-nums">
                      <bdi>{visaAmountText(application.id, subtotalText)}</bdi>
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">{t("payment.totalAtCheckout")}</p>
                  )}
                </div>
              </div>
              {price?.isEstimate && quoteFormat === "symbol" ? (
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

      {extraRows.length > 0 ? (
        <div className="space-y-3">
          {extraRows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4 text-sm">
              <div>
                <p className="text-foreground font-medium">{extraLineLabel(row.key)}</p>
                <p className="text-muted-foreground text-xs">
                  <bdi>× {row.count}</bdi>
                </p>
              </div>
              <p className="text-foreground font-heading text-end font-bold tabular-nums">
                <bdi>{formatQuote(row.amountMinor)}</bdi>
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {quoteState?.loadError && !serverPreview && !settled ? (
        <p className="text-foreground text-sm" role="alert">
          {quoteState.loadError}
        </p>
      ) : null}

      {totalText || quoteState?.updating ? (
        <div
          className="text-muted-foreground flex justify-between gap-4 text-sm"
          aria-busy={quoteState?.updating || undefined}
        >
          <span className="inline-flex items-center gap-2">
            {t("payment.total")}
            {quoteState?.updating ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                <span id="extras-recap-updating">{t("extras.recap.updating")}</span>
              </>
            ) : null}
          </span>
          <span className="text-foreground font-heading text-end text-base font-bold tabular-nums">
            {totalText ? <bdi>{totalText}</bdi> : null}
          </span>
        </div>
      ) : null}
      {showProcessingSpeed && serverPreview?.processingSpeed ? (
        <ProcessingSpeedLine
          speed={serverPreview.processingSpeed}
          fastTrackPromise={
            localizedExtraCopy(extraByKey(serverPreview, "fast_track")?.promiseI18n ?? null, locale, "") ||
            null
          }
        />
      ) : null}
      {quoteState?.announcement ? (
        <p className="sr-only" role="status">
          {quoteState.announcement}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientOrderRecapSkeleton } from "@/components/client/client-loading";
import { convertMinorBetweenUsdAed, parsePublicDisplayFxAedPerUsd } from "@/lib/catalog/display-price";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import { formatIsoDateAsDdMmYyyy } from "@/lib/documents/validation-readiness";

type CatalogService = {
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
  s: CatalogService,
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

function serviceTitle(s: CatalogService): string {
  const parts: string[] = [];
  if (s.durationDays != null) parts.push(`${s.durationDays} days`);
  const ent = entriesLabel(s.entries);
  if (ent) parts.push(ent);
  parts.push(s.name);
  return parts.join(" · ");
}

function contactEmailLine(app: PublicApplication): string {
  const em = app.guestEmail?.trim();
  if (em) return em;
  if (!app.isGuest) return "Your sign-in email (for updates)";
  return "—";
}

export function CheckoutOrderRecap({ application }: { application: PublicApplication }) {
  const [services, setServices] = useState<CatalogService[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currency = (application.catalogCurrency?.toUpperCase() === "AED" ? "AED" : "USD") as DisplayCurrency;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        const res = await fetchApiEnvelope<{
          services: CatalogService[];
        }>(
          apiHref(
            `/catalog/services?nationality=${encodeURIComponent(application.nationalityCode)}&currency=${encodeURIComponent(currency)}`,
          ),
        );
        if (cancelled) return;
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

  const fullName = application.applicant.fullName?.trim() || "—";
  const passportNo = application.applicant.passportNumber?.trim() || "—";
  const dob = formatIsoDateAsDdMmYyyy(application.applicant.dateOfBirth ?? null) || "—";

  const subtotalText = price?.text ?? null;

  if (services === null) {
    return <ClientOrderRecapSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h3 className="font-heading text-foreground text-lg font-bold tracking-tight">Your order</h3>
      </div>

      <div className="text-muted-foreground flex justify-between gap-4 text-[10px] font-bold uppercase tracking-widest">
        <span>Product</span>
        <span>Subtotal</span>
      </div>

      <div className="border-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.06)] rounded-[12px] border p-4 sm:p-5">
        {loadError ? (
          <p className="text-error text-sm">{loadError}</p>
        ) : service ? (
          <>
            <p className="font-heading text-foreground text-base font-bold leading-snug">{serviceTitle(service)}</p>
            <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="sr-only">Name</dt>
                <dd>
                  <span className="font-medium text-foreground/80">Name</span> {fullName}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="sr-only">Email</dt>
                <dd>
                  <span className="font-medium text-foreground/80">Email</span> {contactEmailLine(application)}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="sr-only">Date of birth</dt>
                <dd>
                  <span className="font-medium text-foreground/80">Date of birth</span> {dob}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="sr-only">Passport</dt>
                <dd>
                  <span className="font-medium text-foreground/80">Passport</span>{" "}
                  <span className="font-mono tabular-nums">{passportNo}</span>
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
              <p className="text-muted-foreground text-sm tabular-nums">× 1</p>
              <div className="text-right">
                {subtotalText ? (
                  <p className="text-primary font-heading text-lg font-bold tabular-nums">{subtotalText}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">Total at checkout</p>
                )}
              </div>
            </div>
            {price?.isEstimate ? (
              <p className="text-muted-foreground mt-2 text-[10px] font-medium uppercase tracking-wide">
                Estimated — exact total confirmed when you pay
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Visa service{" "}
            <span className="font-mono text-xs break-all">{application.serviceId}</span> — catalog details unavailable.
          </p>
        )}
      </div>

      {subtotalText ? (
        <div className="space-y-2 text-sm">
          <div className="text-muted-foreground flex justify-between gap-4">
            <span>Subtotal</span>
            <span className="text-primary font-heading font-bold tabular-nums">{subtotalText}</span>
          </div>
          <div className="text-muted-foreground flex justify-between gap-4">
            <span>Total</span>
            <span className="text-primary font-heading text-base font-bold tabular-nums">{subtotalText}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

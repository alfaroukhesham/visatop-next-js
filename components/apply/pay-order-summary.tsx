"use client";

import Link from "next/link";
import type { FC } from "react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { ExtrasBreakdown } from "@/components/apply/extras-breakdown";
import { ProcessingSpeedLine } from "@/components/apply/processing-speed-line";
import { useCheckoutQuoteOptional } from "@/components/apply/checkout-quote-provider";
import {
  extraByKey,
  formatArrivalDate,
  localizedExtraCopy,
  type TClientQuotePreview,
} from "@/lib/apply/checkout-extras-ui";
import { insuranceStepOffered } from "@/lib/checkout-extras/party-insurance";

interface IPayOrderSummaryProps {
  applicationId: string;
  visaNames: readonly string[];
  /** Screenshot fixture. The payment page leaves this unset and uses the live quote. */
  previewOverride?: TClientQuotePreview | null;
}

export const PayOrderSummary: FC<IPayOrderSummaryProps> = ({
  applicationId,
  visaNames,
  previewOverride,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const quote = useCheckoutQuoteOptional();
  const preview = previewOverride ?? quote?.preview ?? null;
  if (!preview) return null;
  const offered = insuranceStepOffered(preview);
  const locked = Boolean(quote?.locked || quote?.paying);
  const extrasHref = `/apply/applications/${encodeURIComponent(applicationId)}/extras`;
  const fastPromise = localizedExtraCopy(
    extraByKey(preview, "fast_track")?.promiseI18n ?? null,
    locale,
    "",
  );
  const hasInsurance = preview.extraLines.some((line) => line.key === "travel_insurance");
  const dateLabel = preview.travelDate
    ? formatArrivalDate(preview.travelDate, locale)
    : t("extras.notSet");
  const arrivalLabel = `${t("extras.arrivalLabel")}${locale === "fr" ? "\u00a0:" : ":"}`;
  const changeExtras = offered ? <ChangeExtras href={extrasHref} locked={locked} /> : null;

  return (
    <section aria-labelledby="pay-order-title" className="space-y-4" data-testid="pay-order">
      <h2 id="pay-order-title" className="font-heading text-foreground text-base font-semibold md:text-lg">
        <span className="lg:hidden">{t("payment.orderTitle")}</span>
        <span className="hidden lg:inline">{t("payment.tripDetailsTitle")}</span>
      </h2>
      {preview.insuranceRemoved ? (
        <p className="border-secondary/30 bg-accent text-foreground rounded-[12px] border p-3 text-sm" role="status">
          {t("extras.removed")}
        </p>
      ) : null}
      <div className="border-border bg-card rounded-[12px] border p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 text-sm lg:max-w-md lg:grid-cols-[auto_1fr] lg:gap-x-3">
          <div className="col-span-2 lg:hidden" data-testid="pay-order-lines">
            <ExtrasBreakdown
              preview={preview}
              visaNames={visaNames}
              updating={Boolean(quote?.updating)}
              updatingMode="when-updating"
              insuranceMode="when-added"
              announcement={null}
              live={false}
            />
          </div>
          {offered ? (
            <div
              className="col-span-2 space-y-2 lg:grid lg:grid-cols-[auto_auto_auto] lg:items-center lg:justify-start lg:gap-x-3 lg:space-y-0"
              data-testid="pay-order-extras"
            >
              <span className="text-muted-foreground hidden lg:block">{t("extras.recap.insurance")}</span>
              <span className="text-foreground hidden lg:block">
                {hasInsurance ? t("extras.recap.added") : t("extras.recap.notAdded")}
              </span>
              {!hasInsurance ? <p className="text-muted-foreground lg:hidden">{t("extras.noExtras")}</p> : null}
              {changeExtras ? <div className="flex justify-end lg:justify-start">{changeExtras}</div> : null}
            </div>
          ) : null}
          <ProcessingSpeedLine
            speed={preview.processingSpeed}
            fastTrackPromise={fastPromise || null}
            layout="pair"
          />
          <span className="text-muted-foreground">{arrivalLabel}</span>
          <span className="text-foreground text-end lg:text-start">
            <bdi>{dateLabel}</bdi>
          </span>
        </div>
        {locked ? <p className="text-muted-foreground mt-2 text-sm">{t("extras.locked")}</p> : null}
      </div>
    </section>
  );
};

const ChangeExtras: FC<{ href: string; locked: boolean }> = ({ href, locked }) => {
  const t = useCustomerT();
  if (locked) {
    return (
      <span className="text-muted-foreground inline-flex min-h-11 items-center text-sm" aria-disabled="true">
        {t("extras.changeExtras")}
      </span>
    );
  }
  return (
    <Link href={href} className="text-secondary inline-flex min-h-11 items-center text-sm underline">
      {t("extras.changeExtras")}
    </Link>
  );
};

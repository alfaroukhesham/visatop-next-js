import { AlertTriangle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { ExtrasBreakdown, type TExtrasVisaNameInput } from "@/components/apply/extras-breakdown";
import { APPLY_STEP_PREVIOUS_CLASS } from "@/components/apply/apply-primary-cta";
import { ExtrasContinueButton } from "@/components/apply/extras-continue-button";
import { MessageWithAmounts } from "@/components/apply/message-with-amounts";
import {
  extraByKey,
  formatMinorAmount,
  localizedExtraCopy,
  visibleInsuranceTermsUrl,
  type TClientQuotePreview,
} from "@/lib/apply/checkout-extras-ui";

interface IExtrasStepPanelProps {
  preview: TClientQuotePreview | null;
  visaNames: readonly TExtrasVisaNameInput[];
  loading: boolean;
  updating: boolean;
  updateError: string | null;
  priceChanged: boolean;
  locked: boolean;
  announcement: string | null;
  backHref: string;
  onInsurance: (selected: boolean) => void;
  onContinue: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onCancelCheckout: () => void;
}

const coverText = (value: string): string => (value.length > 140 ? `${value.slice(0, 140)}…` : value);

export const ExtrasStepPanel: FC<IExtrasStepPanelProps> = ({
  preview,
  visaNames,
  loading,
  updating,
  updateError,
  priceChanged,
  locked,
  announcement,
  backHref,
  onInsurance,
  onContinue,
  onSkip,
  onRetry,
  onCancelCheckout,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const pricesReady = Boolean(preview && !loading);
  const ctaDisabled = !pricesReady || updating || locked;
  const insurance = preview ? extraByKey(preview, "travel_insurance") : null;
  const count = preview ? Math.max(preview.travellerCount, 1) : 1;
  const selected = Boolean(insurance?.selected);

  const money = (minor: string) =>
    preview ? formatMinorAmount(minor, preview.currency, locale, "code") : "";
  const unit = insurance ? money(insurance.unitAmountMinor) : "";
  const sum = insurance ? money(insurance.sumAmountMinor) : "";
  const priceTemplate =
    count <= 1 ? t("extras.insurance.priceOne") : t("extras.insurance.priceMany");
  const label = count <= 1 ? t("extras.insurance.addOne") : t("extras.insurance.addAll");
  const cover = insurance
    ? coverText(localizedExtraCopy(insurance.descriptionI18n, locale, ""))
    : "";
  const termsHref = visibleInsuranceTermsUrl(insurance?.termsUrl) ?? "";
  const totalText = preview ? money(preview.totalAmountMinor) : "";

  const toggle = (next: boolean) => {
    if (!pricesReady || locked) return;
    onInsurance(next);
  };

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="text-secondary inline-flex min-h-11 items-center gap-1 text-sm font-semibold min-[1025px]:hidden"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("common.previous")}
      </Link>
      <h1 className="font-heading text-foreground text-[22px] font-semibold leading-snug md:text-[28px]">
        {t("extras.title")}
      </h1>
      <section className="border-border bg-card rounded-[12px] border p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
        <div className="space-y-4">
          <label
            className={
              selected
                ? "border-secondary bg-accent/70 has-[:focus-visible]:outline-secondary flex min-h-11 cursor-pointer gap-3 rounded-[12px] border-2 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                : "border-border bg-card has-[:focus-visible]:outline-secondary flex min-h-11 cursor-pointer gap-3 rounded-[12px] border-2 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            }
          >
            <input
              type="checkbox"
              className="accent-secondary mt-0.5 size-5 shrink-0"
              checked={selected}
              disabled={!pricesReady || locked}
              aria-busy={!pricesReady || undefined}
              onChange={(event) => toggle(event.target.checked)}
            />
            <span className="min-w-0 space-y-1">
              <span className="text-foreground block text-base font-semibold">{label}</span>
              {pricesReady && insurance ? (
                <span className="text-foreground block text-sm">
                  <MessageWithAmounts
                    template={priceTemplate}
                    amounts={{ unit, sum, n: String(count) }}
                  />
                </span>
              ) : (
                <span className="bg-muted mt-1 block h-4 w-48 max-w-full animate-pulse rounded motion-reduce:animate-none" />
              )}
              {cover ? <span className="text-muted-foreground block text-sm">{cover}</span> : null}
            </span>
          </label>
          {termsHref ? (
            <a
              href={termsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary relative inline-flex min-h-11 items-center underline"
            >
              {t("extras.insurance.terms")}
              <span className="absolute size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
                {t("common.opensNewTab")}
              </span>
            </a>
          ) : null}
          <div className="min-[1025px]:hidden">
            {preview ? (
              <ExtrasBreakdown
                preview={preview}
                visaNames={visaNames}
                updating={updating}
                announcement={null}
                live={false}
              />
            ) : (
              <div className="space-y-3" aria-busy="true">
                <div className="bg-muted h-6 animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-muted h-6 animate-pulse rounded motion-reduce:animate-none" />
              </div>
            )}
          </div>
        </div>
      </section>
      {priceChanged ? (
        <p
          className="border-primary bg-primary/15 text-foreground flex items-start gap-2 rounded-[12px] border p-3 text-sm"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("extras.priceChanged")}</span>
        </p>
      ) : null}
      {updateError ? (
        <div className="text-foreground flex flex-wrap items-center gap-3 text-sm" role="alert">
          <span>{updateError}</span>
          <button type="button" className="text-secondary min-h-11 underline" onClick={onRetry}>
            {t("extras.error.retry")}
          </button>
        </div>
      ) : null}
      {locked ? (
        <div className="border-primary bg-primary/15 text-foreground space-y-2 rounded-[12px] border p-3 text-sm" role="status">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("extras.locked")}</span>
          </p>
          <ClientButton type="button" brand="white" className="h-11 min-w-0 px-4" onClick={onCancelCheckout}>
            {t("payment.cancelAndReset")}
          </ClientButton>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement ?? ""}
      </p>
      <div
        className="hidden min-[1025px]:flex min-[1025px]:flex-row min-[1025px]:items-center min-[1025px]:justify-end min-[1025px]:gap-3"
        data-testid="extras-inline-cta"
      >
        <BackToDetails href={backHref} />
        <ExtrasContinueButton disabled={ctaDisabled} onClick={onContinue} />
      </div>
      <div className="hidden min-[1025px]:flex min-[1025px]:justify-end">
        <SkipExtras disabled={ctaDisabled} onClick={onSkip} />
      </div>
      <div aria-hidden className="min-[1025px]:hidden h-[calc(9rem+env(safe-area-inset-bottom,0px))]" />
      <div
        data-extras-sticky=""
        data-testid="extras-sticky-bar"
        className="min-[1025px]:hidden"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-1">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-bold">{t("extras.recap.total")}</p>
              <p className="text-foreground truncate text-base font-bold tabular-nums">
                <bdi>{totalText}</bdi>
              </p>
            </div>
            <ExtrasContinueButton compact disabled={ctaDisabled} onClick={onContinue} />
          </div>
          <div className="flex justify-end">
            <SkipExtras disabled={ctaDisabled} onClick={onSkip} />
          </div>
        </div>
      </div>
    </div>
  );
};

const BackToDetails: FC<{ href: string }> = ({ href }) => {
  const t = useCustomerT();
  return (
    <ClientButtonLink href={href} brand="white" className={APPLY_STEP_PREVIOUS_CLASS}>
      {t("common.previous")}
    </ClientButtonLink>
  );
};

const SkipExtras: FC<{ disabled: boolean; onClick: () => void }> = ({ disabled, onClick }) => {
  const t = useCustomerT();
  return (
    <button
      type="button"
      className="text-secondary inline-flex min-h-11 items-center text-sm underline disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {t("extras.skip")}
    </button>
  );
};

"use client";

import { useState, type FC } from "react";
import { CheckCircle2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import type { PublicApplication } from "@/lib/applications/public-application";
import { customerLooksCompleteForPayCopy } from "@/lib/apply/payment-copy";
import type { Readiness } from "@/lib/documents/validation-readiness";
import { CheckoutErrorAlert } from "../checkout-error-alert";
import {
  CHECKOUT_TERMS_CHECKBOX_ID,
  CHECKOUT_TERMS_ERROR_ID,
  CheckoutTermsCheckbox,
} from "../checkout-terms-checkbox";
import { PaddleCheckoutButton } from "../paddle-checkout-button";
import {
  APPLY_PRIMARY_CTA_ROW_CLASS,
  APPLY_STEP_PREVIOUS_CLASS,
} from "@/components/apply/apply-primary-cta";
import { FincraInlineCheckout } from "../fincra-inline-checkout";
import { ZiinaEmbeddedCheckout } from "../ziina-embedded-checkout";
import { PaymentWhatsAppHelp } from "../payment-whatsapp-help";
import type { TFincraInlineCheckoutData } from "@/lib/payments/fincra-inline";
import { formatLocalCheckoutCurrencyName } from "@/lib/payments/local-checkout-config";
import { cn } from "@/lib/utils";

type CheckoutHandlers = {
  onZiinaEmbedded: (embeddedUrl: string) => void;
  onFincraInline: (checkout: TFincraInlineCheckoutData) => void;
  onFincraRedirect: (redirectUrl: string) => void;
  onFincraCompleted: () => void;
  onFincraClosed: () => void;
  onZiinaCompleted: () => void;
  onZiinaFailed: () => void;
  onZiinaCanceled: () => void;
  onOverlayClosed: () => void;
  onSuccess: () => void;
  onStartCheckoutTimer: () => void;
  onError: (msg: string) => void;
};

interface IDraftPaymentSectionProps {
  applicationId: string;
  app: PublicApplication;
  paymentReadiness: Readiness;
  requiredSlotKeys: string[];
  uploadedTypes: string[];
  countdown: number | null;
  checkoutError: string | null;
  onDismissCheckoutError: () => void;
  onCancelCheckout: () => void;
  checkout: CheckoutHandlers;
  embeddedUrl: string | null;
  fincraInline: TFincraInlineCheckoutData | null;
  confirming: boolean;
  sessionLoading: boolean;
  showPaddleRetry: boolean;
  payBlocked?: boolean;
  payDescribedBy?: string | null;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
  termsError: string | null;
  onTermsError: (message: string | null) => void;
  onPayingChange?: (paying: boolean) => void;
  onCheckoutStarted?: () => void;
  onPrevious?: () => void;
}

export const DraftPaymentSection: FC<IDraftPaymentSectionProps> = ({
  applicationId,
  app,
  paymentReadiness,
  requiredSlotKeys,
  uploadedTypes,
  countdown,
  checkoutError,
  onDismissCheckoutError,
  onCancelCheckout,
  checkout,
  embeddedUrl,
  fincraInline,
  confirming,
  sessionLoading,
  showPaddleRetry,
  payBlocked = false,
  payDescribedBy = null,
  termsAccepted,
  onTermsAcceptedChange,
  termsError,
  onTermsError,
  onPayingChange,
  onCheckoutStarted,
  onPrevious,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const [termsErrorNonce, setTermsErrorNonce] = useState(0);
  const payCopyComplete = customerLooksCompleteForPayCopy({
    requiredSlotKeys,
    uploadedTypes,
    hasFullName: Boolean(app.applicant.fullName?.trim()),
    hasDateOfBirth: Boolean(app.applicant.dateOfBirth?.trim()),
    hasPassportNumber: Boolean(app.applicant.passportNumber?.trim()),
  });

  const showUnpaidPay =
    paymentReadiness === "ready" && app.paymentStatus === "unpaid" && !embeddedUrl && !fincraInline;
  const showCheckoutCard =
    app.paymentStatus !== "paid" &&
    (app.paymentStatus === "checkout_created" || Boolean(embeddedUrl) || Boolean(fincraInline));

  const fincraLocalCheckout = app.checkoutOffer?.provider === "fincra";
  const localCurrencyName = fincraLocalCheckout
    ? formatLocalCheckoutCurrencyName(app.checkoutOffer?.currency ?? "", locale)
    : "";
  const previousButton = onPrevious ? (
    <ClientButton
      type="button"
      variant="outline"
      brand="white"
      className={APPLY_STEP_PREVIOUS_CLASS}
      onClick={onPrevious}
    >
      {t("payment.previous")}
    </ClientButton>
  ) : null;
  const payButton = (
    <div className="space-y-4">
      <CheckoutTermsCheckbox
        checked={termsAccepted}
        onCheckedChange={(next) => {
          onTermsAcceptedChange(next);
          if (next) onTermsError(null);
        }}
        error={termsError}
        errorKey={termsErrorNonce}
      />
      {fincraLocalCheckout ? (
        <p className="text-muted-foreground text-sm">
          {t("payment.payInLocalCurrencyHint", { currencyName: localCurrencyName })}
        </p>
      ) : null}
      <div className={APPLY_PRIMARY_CTA_ROW_CLASS}>
        {previousButton}
      <PaddleCheckoutButton
        applicationId={applicationId}
        termsAccepted={termsAccepted}
        disabled={payBlocked}
        describedBy={
          [payDescribedBy, termsError ? CHECKOUT_TERMS_ERROR_ID : null].filter(Boolean).join(" ") || null
        }
        onPayingChange={onPayingChange}
        onCheckoutStarted={onCheckoutStarted}
        onTermsRejected={() => {
          onTermsError(t("checkout.errors.termsRequired"));
          setTermsErrorNonce((nonce) => nonce + 1);
          document.getElementById(CHECKOUT_TERMS_CHECKBOX_ID)?.focus();
        }}
        onZiinaEmbedded={(url) => {
          onDismissCheckoutError();
          checkout.onZiinaEmbedded(url);
        }}
        onFincraInline={(session) => {
          onDismissCheckoutError();
          checkout.onFincraInline(session);
        }}
        onFincraRedirect={(url) => {
          onDismissCheckoutError();
          checkout.onFincraRedirect(url);
        }}
        onOverlayClosed={checkout.onOverlayClosed}
        onSuccess={checkout.onSuccess}
        onCancel={checkout.onStartCheckoutTimer}
        onError={checkout.onError}
      />
      </div>
      {fincraLocalCheckout ? <PaymentWhatsAppHelp /> : null}
    </div>
  );

  return (
    <section
      id="draft-payment-section"
      className="scroll-mt-[var(--wp-shell-header-height,130px)] space-y-4"
      data-clarity-mask="true"
    >
      {paymentReadiness !== "ready" && app.paymentStatus === "unpaid" && (
        <div className="rounded-[12px] border border-border bg-muted/20 p-5 sm:p-6">
          <p className="text-muted-foreground text-sm">{t("pay.blockedMissingDocs")}</p>
        </div>
      )}

      {showUnpaidPay && (
        <div className="space-y-4 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
          <h2 tabIndex={-1} className="font-heading text-base! font-semibold md:text-lg!">{t("payment.initiatePaymentTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {payCopyComplete ? t("pay.payNowComplete") : t("pay.payNowIncomplete")}
          </p>
          {checkoutError ? <CheckoutErrorAlert message={checkoutError} /> : null}
          {payButton}
        </div>
      )}

      {showCheckoutCard && (
        <div className="space-y-6 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 tabIndex={-1} className="font-heading text-base! font-semibold md:text-lg!">{t("payment.completePaymentTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {embeddedUrl || fincraInline ? t("payment.completeInWidget") : t("payment.checkoutInProgress")}
              </p>
            </div>
            {countdown !== null && (
              <div className="bg-primary text-primary-foreground px-4 py-2 font-mono text-xl font-bold flex items-center gap-2">
                <span className="text-xs uppercase opacity-80">{t("payment.expiresLabel")}</span>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          {checkoutError ? <CheckoutErrorAlert message={checkoutError} /> : null}

          {sessionLoading && !embeddedUrl && !fincraInline && !showPaddleRetry ? (
            <p className="text-muted-foreground text-sm" role="status">
              {t("payment.preparingCheckout")}
            </p>
          ) : null}

          {embeddedUrl ? (
            <ZiinaEmbeddedCheckout
              embeddedUrl={embeddedUrl}
              confirming={confirming}
              onCompleted={checkout.onZiinaCompleted}
              onFailed={checkout.onZiinaFailed}
              onCanceled={checkout.onZiinaCanceled}
            />
          ) : null}

          {fincraInline ? (
            <FincraInlineCheckout
              key={fincraInline.reference}
              checkout={fincraInline}
              applicationId={applicationId}
              confirming={confirming}
              onCompleted={checkout.onFincraCompleted}
              onClosed={checkout.onFincraClosed}
              onSession={checkout.onFincraInline}
              onHostedRedirect={checkout.onFincraRedirect}
              onError={checkout.onError}
            />
          ) : null}
          {fincraInline && !showPaddleRetry ? <PaymentWhatsAppHelp /> : null}

          {showPaddleRetry ? <div className="flex-1">{payButton}</div> : null}

          <ClientButton
            variant="ghost"
            className="hover:bg-destructive/10 hover:text-destructive h-11 min-h-11"
            onClick={onCancelCheckout}
          >
            {t("payment.cancelAndReset")}
          </ClientButton>
        </div>
      )}

      {onPrevious && !showUnpaidPay && !showPaddleRetry ? (
        <div className={cn(APPLY_PRIMARY_CTA_ROW_CLASS, "sm:justify-start")}>{previousButton}</div>
      ) : null}

      {app.paymentStatus === "paid" && (
        <div className="bg-success/10 border border-success/30 p-5 flex items-center gap-3">
          <CheckCircle2 className="text-success size-6" />
          <div>
            <p className="text-success font-bold">{t("payment.paymentConfirmed")}</p>
            <p className="text-xs text-success/80 italic">{t("payment.paymentConfirmedDetail")}</p>
          </div>
        </div>
      )}
    </section>
  );
};

"use client";

import type { FC } from "react";
import { CheckCircle2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import type { PublicApplication } from "@/lib/applications/public-application";
import { customerLooksCompleteForPayCopy } from "@/lib/apply/payment-copy";
import type { Readiness } from "@/lib/documents/validation-readiness";
import { CheckoutErrorAlert } from "../checkout-error-alert";
import { PaddleCheckoutButton } from "../paddle-checkout-button";
import { ZiinaEmbeddedCheckout } from "../ziina-embedded-checkout";

type CheckoutHandlers = {
  onZiinaEmbedded: (embeddedUrl: string) => void;
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
  confirming: boolean;
  sessionLoading: boolean;
  showPaddleRetry: boolean;
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
  confirming,
  sessionLoading,
  showPaddleRetry,
}) => {
  const t = useCustomerT();
  const payCopyComplete = customerLooksCompleteForPayCopy({
    requiredSlotKeys,
    uploadedTypes,
    hasFullName: Boolean(app.applicant.fullName?.trim()),
    hasDateOfBirth: Boolean(app.applicant.dateOfBirth?.trim()),
    hasPassportNumber: Boolean(app.applicant.passportNumber?.trim()),
  });

  const showUnpaidPay =
    paymentReadiness === "ready" && app.paymentStatus === "unpaid" && !embeddedUrl;
  const showCheckoutCard =
    app.paymentStatus !== "paid" && (app.paymentStatus === "checkout_created" || Boolean(embeddedUrl));

  const payButton = (
    <PaddleCheckoutButton
      applicationId={applicationId}
      onZiinaEmbedded={(url) => {
        onDismissCheckoutError();
        checkout.onZiinaEmbedded(url);
      }}
      onOverlayClosed={checkout.onOverlayClosed}
      onSuccess={checkout.onSuccess}
      onCancel={checkout.onStartCheckoutTimer}
      onError={checkout.onError}
    />
  );

  return (
    <section id="draft-payment-section" className="space-y-4">
      {paymentReadiness !== "ready" && app.paymentStatus === "unpaid" && (
        <div className="rounded-[12px] border border-border bg-muted/20 p-5 sm:p-6">
          <p className="text-muted-foreground text-sm">{t("pay.blockedMissingDocs")}</p>
        </div>
      )}

      {showUnpaidPay && (
        <div className="space-y-4 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
          <h2 className="font-heading text-base! font-semibold md:text-lg!">{t("payment.initiatePaymentTitle")}</h2>
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
              <h2 className="font-heading text-base! font-semibold md:text-lg!">{t("payment.completePaymentTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {embeddedUrl ? t("payment.completeInWidget") : t("payment.checkoutInProgress")}
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

          {sessionLoading && !embeddedUrl && !showPaddleRetry ? (
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

          {showPaddleRetry ? <div className="flex-1">{payButton}</div> : null}

          <ClientButton
            variant="ghost"
            className="hover:bg-destructive/10 hover:text-destructive"
            onClick={onCancelCheckout}
          >
            {t("payment.cancelAndReset")}
          </ClientButton>
        </div>
      )}

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

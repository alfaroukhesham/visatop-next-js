"use client";

import { CheckCircle2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import type { PublicApplication } from "@/lib/applications/public-application";
import {
  customerLooksCompleteForPayCopy,
  initiatePaymentBody,
  PAY_BLOCKED_MISSING_DOCS_COPY,
} from "@/lib/apply/payment-copy";
import type { Readiness } from "@/lib/documents/validation-readiness";
import { CheckoutErrorAlert } from "../checkout-error-alert";
import { PaddleCheckoutButton } from "../paddle-checkout-button";

type CheckoutHandlers = {
  onExternalRedirect: () => void;
  onOverlayClosed: () => void;
  onSuccess: () => void;
  onStartCheckoutTimer: () => void;
  onError: (msg: string) => void;
};

export function DraftPaymentSection({
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
}: {
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
}) {
  const payCopyComplete = customerLooksCompleteForPayCopy({
    requiredSlotKeys,
    uploadedTypes,
    hasFullName: Boolean(app.applicant.fullName?.trim()),
    hasDateOfBirth: Boolean(app.applicant.dateOfBirth?.trim()),
    hasPassportNumber: Boolean(app.applicant.passportNumber?.trim()),
  });

  return (
    <section id="draft-payment-section" className="space-y-4">
      {paymentReadiness !== "ready" && app.paymentStatus === "unpaid" && (
        <div className="rounded-[12px] border border-border bg-muted/20 p-5 sm:p-6">
          <p className="text-muted-foreground text-sm">{PAY_BLOCKED_MISSING_DOCS_COPY}</p>
        </div>
      )}

      {paymentReadiness === "ready" && app.paymentStatus === "unpaid" && (
        <div className="space-y-4 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
          <h2 className="font-heading text-base! font-semibold md:text-lg!">Initiate payment</h2>
          <p className="text-sm text-muted-foreground">{initiatePaymentBody(payCopyComplete)}</p>
          {checkoutError ? <CheckoutErrorAlert message={checkoutError} /> : null}
          <PaddleCheckoutButton
            applicationId={applicationId}
            onExternalRedirect={() => {
              onDismissCheckoutError();
              checkout.onExternalRedirect();
            }}
            onOverlayClosed={checkout.onOverlayClosed}
            onSuccess={checkout.onSuccess}
            onCancel={checkout.onStartCheckoutTimer}
            onError={checkout.onError}
          />
        </div>
      )}

      {app.paymentStatus === "checkout_created" && (
        <div className="space-y-6 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-base! font-semibold md:text-lg!">Complete your payment</h2>
              <p className="text-sm text-muted-foreground">Checkout is in progress.</p>
            </div>
            {countdown !== null && (
              <div className="bg-primary text-primary-foreground px-4 py-2 font-mono text-xl font-bold flex items-center gap-2">
                <span className="text-xs uppercase opacity-80">Expires:</span>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          {checkoutError ? <CheckoutErrorAlert message={checkoutError} /> : null}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <PaddleCheckoutButton
                applicationId={applicationId}
                onExternalRedirect={() => {
                  onDismissCheckoutError();
                  checkout.onExternalRedirect();
                }}
                onOverlayClosed={checkout.onOverlayClosed}
                onSuccess={checkout.onSuccess}
                onError={checkout.onError}
              />
            </div>
            <ClientButton
              variant="ghost"
              className="hover:bg-destructive/10 hover:text-destructive"
              onClick={onCancelCheckout}
            >
              Cancel & Reset
            </ClientButton>
          </div>
        </div>
      )}

      {app.paymentStatus === "paid" && (
        <div className="bg-success/10 border border-success/30 p-5 flex items-center gap-3">
          <CheckCircle2 className="text-success size-6" />
          <div>
            <p className="text-success font-bold">Payment Confirmed</p>
            <p className="text-xs text-success/80 italic">
              We’re confirming your payment and starting processing.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

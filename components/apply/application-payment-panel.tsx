"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { DraftPanelError } from "@/components/apply/draft/draft-panel-error";
import { DraftPaymentSection } from "@/components/apply/draft/draft-payment-section";
import { useApplicationDraft } from "@/components/apply/draft/use-application-draft";
import { ClientButton } from "@/components/client/client-button";
import { APPLY_STEP3_VALIDATION_DISABLED } from "@/lib/apply/apply-flow-config";
import { paymentPanelMayShow } from "@/lib/applications/payment-panel-may-show";
import { computeValidation, type Readiness } from "@/lib/documents/validation-readiness";

export function ApplicationPaymentPanel({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const draft = useApplicationDraft(applicationId);

  const documentsPath = `/apply/applications/${encodeURIComponent(applicationId)}`;
  const submittedPath = `/apply/applications/${encodeURIComponent(applicationId)}/submitted`;

  const app = draft.app;

  if (draft.loading) {
    return <ClientDraftPanelSkeleton />;
  }

  if (draft.error || !app) {
    return <DraftPanelError error={draft.error} onRetry={() => void draft.load()} />;
  }

  const validationEmail = app.isGuest ? app.guestEmail : "signed-in";
  const paymentReadiness: Readiness = computeValidation({
    profile: { ...app.applicant, email: validationEmail },
    uploads: {
      passportCopyPresent: Boolean(draft.passport),
      personalPhotoPresent: Boolean(draft.photo),
    },
    now: new Date(),
  }).paymentReadiness;

  const checkoutHandlers = {
    onExternalRedirect: () =>
      draft.setActionMsg("Redirecting to our payment partner to complete checkout securely…"),
    onOverlayClosed: () => void draft.load({ silent: true }),
    onSuccess: () => {
      draft.setCountdown(null);
      draft.setActionMsg("Payment submitted. Confirming with our systems…");
      router.push(submittedPath);
    },
    onError: (msg: string) => {
      setCheckoutError(msg);
      document.getElementById("draft-payment-section")?.scrollIntoView({ behavior: "smooth" });
    },
  };

  const uploads = {
    passportCopyPresent: Boolean(draft.passport),
    personalPhotoPresent: Boolean(draft.photo),
  };

  if (!paymentPanelMayShow(app, uploads) && app.paymentStatus === "unpaid") {
    return <ClientDraftPanelSkeleton />;
  }

  return (
    <div className="space-y-8">
      {draft.actionMsg ? (
        <p className="text-accent-foreground border-accent/30 bg-accent/15 text-sm border-b-2 border-l-accent px-3 py-2">
          {draft.actionMsg}
        </p>
      ) : null}

      <DraftPaymentSection
        applicationId={applicationId}
        app={app}
        paymentReadiness={paymentReadiness}
        countdown={draft.countdown}
        checkoutError={checkoutError}
        onDismissCheckoutError={() => setCheckoutError(null)}
        onCancelCheckout={() => {
          setCheckoutError(null);
          void draft.cancelCheckout();
        }}
        checkout={{
          ...checkoutHandlers,
          onStartCheckoutTimer: () => {
            if (draft.countdown === null) draft.setCountdown(600);
          },
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ClientButton
          type="button"
          variant="outline"
          brand="cta"
          className="rounded-none"
          onClick={() => router.push(documentsPath)}
        >
          Previous
        </ClientButton>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        <Link href="/" className="text-link hover:underline">
          Start another draft
        </Link>
        {" · "}
        <Link href="/portal/track" className="hover:text-foreground">
          Portal
        </Link>
      </p>

      <ApplyJourneyStepBar
        step={4}
        totalSteps={5}
        title="Secure payment"
        subtitle={
          APPLY_STEP3_VALIDATION_DISABLED
            ? "Pay securely now — you can add documents and details anytime before submission."
            : "Confirm your details, then pay securely to submit."
        }
      />
    </div>
  );
}

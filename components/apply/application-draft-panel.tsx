"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { APPLY_STEP3_VALIDATION_DISABLED } from "@/lib/apply/apply-flow-config";
import { computeValidation } from "@/lib/documents/validation-readiness";
import { ApplicantReview } from "./draft/applicant-review";
import { DraftDocumentsSection } from "./draft/draft-documents-section";
import { DraftPanelError } from "./draft/draft-panel-error";
import { DraftPaymentSection } from "./draft/draft-payment-section";
import { applicantFormResetKey } from "./draft/utils";
import { useApplicationDraft } from "./draft/use-application-draft";

export function ApplicationDraftPanel({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const draft = useApplicationDraft(applicationId);

  if (draft.loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading application…
      </p>
    );
  }

  if (draft.error || !draft.app) {
    return <DraftPanelError error={draft.error} onRetry={() => void draft.load()} />;
  }

  const {app} = draft;
  const gotBoth = Boolean(draft.passport && draft.photo);
  const validationEmail = app.isGuest ? app.guestEmail : "signed-in";

  const { readiness, paymentReadiness, requiredFieldsMissing: missing } = computeValidation({
    profile: { ...app.applicant, email: validationEmail },
    uploads: {
      passportCopyPresent: Boolean(draft.passport),
      personalPhotoPresent: Boolean(draft.photo),
    },
    now: new Date(),
  });

  const journeyStep =
    app.paymentStatus === "checkout_created" || app.paymentStatus === "paid"
      ? (4 as const)
      : paymentReadiness === "ready"
        ? (4 as const)
        : (3 as const);

  const submittedPath = `/apply/applications/${encodeURIComponent(applicationId)}/submitted`;

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

  return (
    <div className="space-y-8">
      {draft.actionMsg ? (
        <p className="text-accent-foreground border-accent/30 bg-accent/15 text-sm border-l-4 border-l-accent px-3 py-2">
          {draft.actionMsg}
        </p>
      ) : null}

      <DraftDocumentsSection
        applicationId={applicationId}
        passport={draft.passport}
        photo={draft.photo}
        gotBoth={gotBoth}
        uploading={draft.uploading}
        extracting={draft.extracting}
        passportExtractionStatus={app.passportExtraction.status}
        attemptsLeft={draft.attemptsLeft}
        onUpload={(type, file) => void draft.onUpload(type, file)}
      />

      <ApplicantReview
        key={applicantFormResetKey(app.applicant, draft.extractResult?.extraction ?? null, app.guestEmail)}
        applicationId={applicationId}
        nationalityCode={app.nationalityCode}
        applicant={app.applicant}
        guestEmail={app.guestEmail}
        extraction={draft.extractResult?.extraction ?? null}
        readiness={readiness}
        paymentReadiness={paymentReadiness}
        missing={missing}
        locked={app.checkoutState === "pending" || app.paymentStatus === "paid"}
        onSaved={() => void draft.load({ silent: true })}
      />

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
        step={journeyStep}
        totalSteps={5}
        title={journeyStep === 4 ? "Review & pay" : "Upload documents"}
        subtitle={
          journeyStep === 4
            ? APPLY_STEP3_VALIDATION_DISABLED
              ? "Pay securely now — you can add documents and details anytime before submission."
              : "Confirm your details, then pay securely to submit."
            : "Upload what we ask for, then confirm your passport details."
        }
      />
    </div>
  );
}

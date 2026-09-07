"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { DraftPanelError } from "@/components/apply/draft/draft-panel-error";
import { DraftPaymentSection } from "@/components/apply/draft/draft-payment-section";
import { useApplicationDraft } from "@/components/apply/draft/use-application-draft";
import { ClientButton } from "@/components/client/client-button";
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
    uploads: draft.uploadPresence,
    now: new Date(),
  }).paymentReadiness;

  const requiredSlotKeys =
    draft.uploadPresence.memberRequiredUploads?.flatMap((m) => m.requiredSlotKeys) ?? [];
  const uploadedTypes = [
    ...new Set(
      draft.uploadPresence.memberRequiredUploads?.flatMap((m) => m.uploadedDocumentTypes) ?? [],
    ),
  ];

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
        <p className="text-accent-foreground border-accent/30 bg-accent/15 text-sm border-b-2 border-l-accent px-3 py-2">
          {draft.actionMsg}
        </p>
      ) : null}

      <DraftPaymentSection
        applicationId={applicationId}
        app={app}
        paymentReadiness={paymentReadiness}
        requiredSlotKeys={requiredSlotKeys}
        uploadedTypes={uploadedTypes}
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
          brand="white"
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
          Your applications
        </Link>
      </p>

    </div>
  );
}

"use client";

import Link from "next/link";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { AppShimmer } from "@/components/ui/app-loading";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { computeValidation } from "@/lib/documents/validation-readiness";
import { ApplicantReview } from "./draft/applicant-review";
import { DraftDocumentsSection } from "./draft/draft-documents-section";
import { DraftPanelError } from "./draft/draft-panel-error";
import { PartyDocumentsTabs } from "./draft/party-documents-tabs";
import { applicantFormResetKey } from "./draft/utils";
import { useApplicationDraft } from "./draft/use-application-draft";

export function ApplicationDraftPanel({ applicationId }: { applicationId: string }) {
  const draft = useApplicationDraft(applicationId);

  if (draft.loading) {
    return <ClientDraftPanelSkeleton />;
  }

  if (draft.error || !draft.app) {
    return <DraftPanelError error={draft.error} onRetry={() => void draft.load()} />;
  }

  const selectedApp = draft.selected.app;
  if (!selectedApp) {
    return <ClientDraftPanelSkeleton />;
  }

  const validationEmail = selectedApp.isGuest ? selectedApp.guestEmail : "signed-in";

  const { readiness, paymentReadiness, requiredFieldsMissing: missing } = computeValidation({
    profile: { ...selectedApp.applicant, email: validationEmail },
    uploads: {
      passportCopyPresent: Boolean(draft.selected.passport),
      personalPhotoPresent: Boolean(draft.selected.photo),
    },
    now: new Date(),
  });

  const primaryMember =
    draft.members.find((m) => m.travelerRole === "primary") ?? draft.members[0];
  const payApplicationId = primaryMember?.applicationId ?? applicationId;

  return (
    <div className="space-y-8">
      {draft.actionMsg ? (
        <p className="text-accent-foreground border-accent/30 bg-accent/15 text-sm border-b-2 border-l-accent px-3 py-2">
          {draft.actionMsg}
        </p>
      ) : null}

      <PartyDocumentsTabs
        members={draft.members}
        selectedMemberId={draft.selectedMemberId}
        onSelect={draft.setSelectedMemberId}
      />

      {draft.selected.docsLoading ? (
        <section
          className="border-border bg-card space-y-4 rounded-[12px] border p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6"
          aria-busy="true"
          aria-label="Loading documents"
        >
          <AppShimmer className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppShimmer className="h-32 w-full rounded-lg" />
            <AppShimmer className="h-32 w-full rounded-lg" />
          </div>
        </section>
      ) : (
        <DraftDocumentsSection
          key={selectedApp.id}
          applicationId={selectedApp.id}
          slots={draft.selected.slots}
          docsByType={draft.selected.docsByType}
          uploading={draft.selected.uploading}
          extracting={draft.selected.extracting}
          onUpload={(type, file) => void draft.onUpload(type, file)}
        />
      )}

      <ApplicantReview
        key={`${applicantFormResetKey(selectedApp.applicant, draft.selected.extractResult?.extraction ?? null, selectedApp.guestEmail)}\u001e${draft.selected.nationalityName}`}
        applicationId={selectedApp.id}
        paymentApplicationId={payApplicationId}
        nationalityCode={selectedApp.nationalityCode}
        nationalityName={draft.selected.nationalityName}
        applicant={selectedApp.applicant}
        guestEmail={selectedApp.guestEmail}
        extraction={draft.selected.extractResult?.extraction ?? null}
        readiness={readiness}
        paymentReadiness={paymentReadiness}
        missing={missing}
        locked={selectedApp.checkoutState === "pending" || selectedApp.paymentStatus === "paid"}
        onSaved={() => void draft.load({ silent: true })}
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
        step={3}
        totalSteps={5}
        title="Upload documents"
        subtitle="Upload what we ask for, then confirm your passport details."
      />
    </div>
  );
}

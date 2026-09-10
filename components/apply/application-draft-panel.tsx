"use client";

import Link from "next/link";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { AppShimmer } from "@/components/ui/app-loading";
import { computeValidation } from "@/lib/documents/validation-readiness";
import { ApplicantReview } from "./draft/applicant-review";
import { DraftDocumentsSection } from "./draft/draft-documents-section";
import { DraftPanelError } from "./draft/draft-panel-error";
import { PartyDocumentsTabs } from "./draft/party-documents-tabs";
import type { DocType } from "./draft/types";
import { applicantFormResetKey } from "./draft/utils";
import { useApplicationDraft } from "./draft/use-application-draft";

export function ApplicationDraftPanel({ applicationId }: { applicationId: string }) {
  const t = useCustomerT();
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
    uploads: draft.uploadPresence,
    now: new Date(),
  });

  const primaryMember =
    draft.members.find((m) => m.travelerRole === "primary") ?? draft.members[0];
  const payApplicationId = primaryMember?.applicationId ?? applicationId;

  const requiredSlots = draft.selected.slots.filter((s) => s.role === "required");
  const allRequiredUploaded = requiredSlots.every(
    (s) => draft.selected.docsByType[s.key as DocType],
  );
  const passportUploaded = Boolean(draft.selected.passport);

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
          aria-label={t("draft.loadingDocuments")}
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
        key={`${applicantFormResetKey(selectedApp.applicant, draft.selected.extractResult?.extraction ?? null, selectedApp.guestEmail, draft.selected.passport?.id)}\u001e${draft.selected.nationalityName}\u001e${passportUploaded ? "p" : "n"}\u001e${allRequiredUploaded ? "d" : "u"}`}
        applicationId={selectedApp.id}
        paymentApplicationId={payApplicationId}
        nationalityCode={selectedApp.nationalityCode}
        nationalityName={draft.selected.nationalityName}
        nationalities={draft.nationalities}
        applicant={selectedApp.applicant}
        guestEmail={selectedApp.guestEmail}
        extraction={draft.selected.extractResult?.extraction ?? null}
        readiness={readiness}
        paymentReadiness={paymentReadiness}
        missing={missing}
        documentsReady={passportUploaded}
        passportUploaded={passportUploaded}
        extractPending={draft.selected.extracting}
        waitForPassportExtract={draft.waitForPassportExtract}
        locked={selectedApp.checkoutState === "pending" || selectedApp.paymentStatus === "paid"}
        onSaved={() => void draft.load({ silent: true })}
      />

      <p className="text-muted-foreground text-center text-xs">
        <Link href="/" className="text-link hover:underline">
          {t("draft.startAnotherDraft")}
        </Link>
      </p>

    </div>
  );
}

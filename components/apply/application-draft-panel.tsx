"use client";

import Link from "next/link";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { ApplyDocumentWizard } from "./draft/apply-document-wizard";
import { DraftPanelError } from "./draft/draft-panel-error";
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

  return (
    <div className="space-y-8">
      {draft.actionMsg ? (
        <p className="text-accent-foreground border-accent/30 bg-accent/15 border-b-2 border-l-accent px-3 py-2 text-sm">
          {draft.actionMsg}
        </p>
      ) : null}

      <ApplyDocumentWizard
        applicationId={applicationId}
        members={draft.members}
        memberViews={draft.memberStates}
        nationalities={draft.nationalities}
        uploadPresence={draft.uploadPresence}
        wizardCursor={draft.wizardCursor}
        setWizardCursor={draft.setWizardCursor}
        onUpload={(type, file, source) => void draft.onUpload(type, file, source)}
        onCancelUpload={draft.cancelInFlightUpload}
        setSelectedMemberId={draft.setSelectedMemberId}
        waitForPassportExtract={draft.waitForPassportExtract}
        onSaved={() => void draft.load({ silent: true })}
      />

      <p className="text-muted-foreground text-center text-xs">
        <Link href="/" className="text-link inline-flex min-h-11 items-center hover:underline">
          {t("draft.startAnotherDraft")}
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import { Camera, FileText, Landmark, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { tagClarityApplyScreen } from "@/lib/analytics/clarity-apply-screen";
import { trackEventOnce, trackPageView } from "@/lib/analytics/gtag-client";
import {
  applyWizardHref,
  nextApplyScreen,
  parseApplyWizardQuery,
  resolveApplyScreen,
  type TApplyWizardCursor,
  type TApplyWizardMember,
  type TApplyWizardStep,
} from "@/lib/apply/apply-wizard";
import { translateDocumentSlot } from "@/lib/apply/document-slot-i18n";
import type { TDocumentSlot } from "@/lib/apply/document-requirements";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { computeValidation } from "@/lib/documents/validation-readiness";
import type { TPublicPartyMember } from "@/lib/applications/load-party-members";
import type { PublicApplication } from "@/lib/applications/public-application";
import { ApplicantReview } from "./applicant-review";
import { DocumentUploadSlot } from "./document-upload-slot";
import type { DocType, ExtractResponse, PublicDocument, TUploadSlotError } from "./types";
import type { TPhoneNationalityOption } from "./phone-country-field";

type TMemberView = {
  app: PublicApplication | null;
  slots: TDocumentSlot[];
  docsByType: Partial<Record<DocType, PublicDocument | null>>;
  uploading: DocType | null;
  uploadPercent: number | null;
  lastUploadErrors: Partial<Record<DocType, TUploadSlotError | null>>;
  extracting: boolean;
  extractResult: ExtractResponse | null;
  nationalityName: string;
  docsLoading: boolean;
};

export interface IApplyDocumentWizardProps {
  applicationId: string;
  members: TPublicPartyMember[];
  memberViews: Record<string, TMemberView>;
  nationalities: TPhoneNationalityOption[];
  uploadPresence: Parameters<typeof computeValidation>[0]["uploads"];
  wizardCursor: TApplyWizardCursor | null;
  setWizardCursor: (cursor: TApplyWizardCursor) => void;
  onUpload: (type: DocType, file: File, source: "camera" | "file") => void;
  onCancelUpload: () => void;
  setSelectedMemberId: (memberId: string) => void;
  waitForPassportExtract: () => Promise<void>;
  onSaved: () => void;
}

const iconForSlot = (key: string) => {
  if (key === "personal_photo") return Camera;
  if (key === "bank_statement_6m") return Landmark;
  return FileText;
};

const ApplyOrderTotal: FC<{
  nationalityCode: string;
  currency: string;
  serviceIds: string[];
}> = ({ nationalityCode, currency, serviceIds }) => {
  const t = useCustomerT();
  const [total, setTotal] = useState<string | null>(null);
  const serviceKey = serviceIds.join("|");
  useEffect(() => {
    let cancelled = false;
    const ids = serviceKey.split("|").filter(Boolean);
    const run = async () => {
      const tab = currency === "AED" ? "AED" : "USD";
      const res = await fetchApiEnvelope<{
        services: { id: string; displayPriceMinor: string | null; currency: string | null }[];
      }>(
        apiHref(
          `/catalog/services?nationality=${encodeURIComponent(nationalityCode)}&currency=${encodeURIComponent(tab)}`,
        ),
      );
      if (cancelled || !res.ok) return;
      let sum = BigInt(0);
      for (const id of ids) {
        const service = res.data.services.find((row) => row.id === id);
        if (!service?.displayPriceMinor) return;
        const minor = Number(service.displayPriceMinor);
        if (!Number.isFinite(minor)) return;
        sum += BigInt(Math.trunc(minor));
      }
      if (cancelled) return;
      try {
        setTotal(new Intl.NumberFormat(undefined, { style: "currency", currency: tab }).format(Number(sum) / 100));
      } catch {
        setTotal(`${(Number(sum) / 100).toFixed(2)} ${tab}`);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currency, nationalityCode, serviceKey]);
  if (!total) return null;
  return (
    <p className="text-muted-foreground text-center text-sm">
      {t("wizard.orderTotal", { total })}
    </p>
  );
};

export const ApplyDocumentWizard: FC<IApplyDocumentWizardProps> = ({
  applicationId,
  members,
  memberViews,
  nationalities,
  uploadPresence,
  wizardCursor,
  setWizardCursor,
  onUpload,
  onCancelUpload,
  setSelectedMemberId,
  waitForPassportExtract,
  onSaved,
}) => {
  const t = useCustomerT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ordered = useMemo(
    () => members.slice().sort((a, b) => a.travelerIndex - b.travelerIndex),
    [members],
  );
  const wizardMembers: TApplyWizardMember[] = ordered.map((member) => ({
    applicationId: member.applicationId,
    hasPassport: Boolean(memberViews[member.applicationId]?.docsByType.passport_copy),
  }));
  const requested = parseApplyWizardQuery(searchParams.get("screen"), searchParams.get("traveller"));
  const resolved = resolveApplyScreen({
    members: wizardMembers,
    cursor: wizardCursor,
    requested,
  });

  const resolvedKey = `${resolved.screen}:${resolved.travellerId ?? ""}`;
  useEffect(() => {
    if (resolved.screen === "payment") {
      router.replace(applyWizardHref(applicationId, resolved));
      return;
    }
    const hereTraveller = searchParams.get("traveller");
    if (
      searchParams.get("screen") === resolved.screen &&
      (hereTraveller ?? null) === (resolved.travellerId ?? null)
    ) {
      return;
    }
    router.replace(applyWizardHref(applicationId, resolved));
  }, [applicationId, resolved, resolvedKey, router, searchParams]);

  useEffect(() => {
    if (resolved.screen === "ready" || resolved.screen === "payment" || !resolved.travellerId) return;
    setSelectedMemberId(resolved.travellerId);
  }, [resolved, setSelectedMemberId]);

  useEffect(() => {
    if (resolved.screen === "payment") return;
    tagClarityApplyScreen(resolved.screen);
    const search = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    trackPageView(window.location.pathname, search);
    if (resolved.screen === "ready") {
      trackEventOnce(
        APPLY_FUNNEL_EVENTS.docsReadyViewed,
        { application_id: applicationId },
        `${APPLY_FUNNEL_EVENTS.docsReadyViewed}:${applicationId}`,
      );
    }
    if (resolved.screen === "details" && resolved.travellerId) {
      trackEventOnce(
        APPLY_FUNNEL_EVENTS.detailsReviewViewed,
        { application_id: resolved.travellerId },
        `${APPLY_FUNNEL_EVENTS.detailsReviewViewed}:${resolved.travellerId}`,
      );
    }
  }, [applicationId, resolved, resolvedKey]);

  const confirmAndGo = async (current: TApplyWizardStep) => {
    const next = nextApplyScreen(wizardMembers, current);
    setWizardCursor({ screen: current.screen, travellerId: current.travellerId });
    void fetchApiEnvelope(apiHref(`/applications/${encodeURIComponent(applicationId)}/wizard-cursor`), {
      method: "POST",
      body: JSON.stringify({ screen: current.screen, travellerId: current.travellerId }),
    });
    router.push(applyWizardHref(applicationId, next));
  };

  if (resolved.screen === "payment" || wizardMembers.length === 0) return null;

  const travellerId = resolved.travellerId;
  const memberIndex = ordered.findIndex((member) => member.applicationId === travellerId);
  const showTraveller = ordered.length > 1 && resolved.screen !== "ready";
  const view = travellerId ? memberViews[travellerId] : null;
  const primary = ordered[0];
  const primaryApp = primary ? memberViews[primary.applicationId]?.app : null;

  if (resolved.screen === "ready" && primaryApp) {
    const laterByKey = new Map<string, TDocumentSlot>();
    for (const member of ordered) {
      for (const slot of memberViews[member.applicationId]?.slots ?? []) {
        if (slot.key !== "passport_copy" && !laterByKey.has(slot.key)) laterByKey.set(slot.key, slot);
      }
    }
    const later = [...laterByKey.values()];
    return (
      <section className="space-y-5">
        <h1 className="font-heading text-foreground text-xl font-semibold tracking-tight md:text-[1.75rem]">
          {t("wizard.readyTitle")}
        </h1>
        <div className="space-y-3">
          <p className="text-foreground text-xs font-bold uppercase tracking-wide">{t("wizard.neededNow")}</p>
          <div className="border-border flex items-start gap-3 rounded-2xl border bg-card p-4">
            <FileText className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{t("wizard.passportNow")}</p>
              <p className="text-muted-foreground text-xs">{t("documents.slots.passportCopy.description")}</p>
            </div>
          </div>
        </div>
        {later.length > 0 ? (
          <div className="space-y-3">
            <p className="text-foreground text-xs font-bold uppercase tracking-wide">{t("wizard.addLater")}</p>
            {later.map((slot) => {
              const Icon = iconForSlot(slot.key);
              const copy = translateDocumentSlot(slot, t);
              return (
                <div key={slot.key} className="border-border flex items-start gap-3 rounded-2xl border bg-card p-4">
                  <Icon className="text-secondary mt-0.5 size-5 shrink-0" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{copy.label}</p>
                    <p className="text-muted-foreground text-xs">{copy.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <p className="text-muted-foreground text-sm">{t("wizard.takesTwoMinutes")}</p>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {t("wizard.encrypted")}
        </p>
        <ApplyOrderTotal
          nationalityCode={primaryApp.nationalityCode}
          currency={primaryApp.catalogCurrency}
          serviceIds={ordered.map((member) => member.serviceId)}
        />
        <ClientButton
          brand="cta"
          className="h-12 w-full"
          type="button"
          onClick={() => void confirmAndGo({ screen: "ready", travellerId: null })}
        >
          {t("common.continue")}
        </ClientButton>
      </section>
    );
  }

  if (!view || !travellerId || view.docsLoading || !view.app) return null;

  const passportDoc = view.docsByType.passport_copy ?? null;
  const laterSlots = view.slots.filter((slot) => slot.key !== "passport_copy");
  const isLast = ordered[ordered.length - 1]?.applicationId === travellerId;

  return (
    <section className="space-y-5">
      {showTraveller ? (
        <p className="text-secondary text-xs font-bold uppercase tracking-wide">
          {t("wizard.travellerProgress", { current: memberIndex + 1, total: ordered.length })}
        </p>
      ) : null}
      {resolved.screen === "passport" ? (
        <>
          <h1 className="font-heading text-foreground text-xl font-semibold tracking-tight">
            {t("documents.slots.passportCopy.label")}
          </h1>
          <DocumentUploadSlot
            label={t("documents.slots.passportCopy.label")}
            description={t("documents.slots.passportCopy.description")}
            currentDoc={passportDoc}
            docType="passport_copy"
            applicationId={travellerId}
            uploading={view.uploading === "passport_copy"}
            uploadPercent={view.uploading === "passport_copy" ? view.uploadPercent : null}
            lastError={view.lastUploadErrors.passport_copy ?? null}
            showCaptureGuidance
            stackActions
            onUpload={(file, source) => onUpload("passport_copy", file, source)}
            onCancelUpload={onCancelUpload}
          />
          <ClientButton
            brand="cta"
            className="h-12 w-full"
            type="button"
            disabled={!passportDoc || view.uploading === "passport_copy"}
            onClick={() => void confirmAndGo({ screen: "passport", travellerId })}
          >
            {t("common.continue")}
          </ClientButton>
        </>
      ) : null}
      {resolved.screen === "other" ? (
        <>
          <h1 className="font-heading text-foreground text-xl font-semibold tracking-tight">
            {t("wizard.otherTitle")}
          </h1>
          {laterSlots.map((slot) => {
            const type = slot.key as DocType;
            const copy = translateDocumentSlot(slot, t);
            return (
              <DocumentUploadSlot
                key={slot.key}
                label={copy.label}
                description={copy.description}
                currentDoc={view.docsByType[type] ?? null}
                docType={type}
                applicationId={travellerId}
                uploading={view.uploading === type}
                uploadPercent={view.uploading === type ? view.uploadPercent : null}
                lastError={view.lastUploadErrors[type] ?? null}
                addLater
                showPhotoGuidance={slot.key === "personal_photo"}
                stackActions
                onUpload={(file, source) => onUpload(type, file, source)}
                onCancelUpload={onCancelUpload}
              />
            );
          })}
          <p className="text-muted-foreground text-center text-xs">{t("wizard.addAfterPayment")}</p>
          <ClientButton
            brand="cta"
            className="h-12 w-full"
            type="button"
            disabled={view.uploading !== null}
            onClick={() => {
              const uploaded = laterSlots.some((slot) => view.docsByType[slot.key as DocType]);
              const eventName = uploaded
                ? APPLY_FUNNEL_EVENTS.otherDocsUploaded
                : APPLY_FUNNEL_EVENTS.otherDocsSkipped;
              trackEventOnce(eventName, { application_id: travellerId }, `${eventName}:${travellerId}`);
              void confirmAndGo({ screen: "other", travellerId });
            }}
          >
            {t("common.continue")}
          </ClientButton>
        </>
      ) : null}
      {resolved.screen === "details" ? (
        <ApplicantReview
          applicationId={travellerId}
          paymentApplicationId={primary?.applicationId ?? applicationId}
          nationalityCode={view.app.nationalityCode}
          nationalityName={view.nationalityName}
          nationalities={nationalities}
          applicant={view.app.applicant}
          guestEmail={view.app.guestEmail}
          extraction={view.extractResult?.extraction ?? null}
          readiness={
            computeValidation({
              profile: {
                ...view.app.applicant,
                email: view.app.isGuest ? view.app.guestEmail : "signed-in",
              },
              uploads: uploadPresence,
              now: new Date(),
            }).readiness
          }
          paymentReadiness={
            computeValidation({
              profile: {
                ...view.app.applicant,
                email: view.app.isGuest ? view.app.guestEmail : "signed-in",
              },
              uploads: uploadPresence,
              now: new Date(),
            }).paymentReadiness
          }
          missing={
            computeValidation({
              profile: {
                ...view.app.applicant,
                email: view.app.isGuest ? view.app.guestEmail : "signed-in",
              },
              uploads: uploadPresence,
              now: new Date(),
            }).requiredFieldsMissing
          }
          documentsReady={Boolean(passportDoc)}
          passportUploaded={Boolean(passportDoc)}
          extractPending={view.extracting}
          waitForPassportExtract={waitForPassportExtract}
          locked={view.app.checkoutState === "pending" || view.app.paymentStatus === "paid"}
          onSaved={onSaved}
          destination={isLast ? "payment" : "next"}
          onFinished={() => void confirmAndGo({ screen: "details", travellerId })}
          onReplacePassport={() =>
            router.push(applyWizardHref(applicationId, { screen: "passport", travellerId }))
          }
        />
      ) : null}
    </section>
  );
};

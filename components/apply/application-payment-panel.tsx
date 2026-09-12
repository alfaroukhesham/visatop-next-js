"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { ClientDraftPanelSkeleton } from "@/components/client/client-loading";
import { DraftPanelError } from "@/components/apply/draft/draft-panel-error";
import { DraftPaymentSection } from "@/components/apply/draft/draft-payment-section";
import { useApplicationDraft } from "@/components/apply/draft/use-application-draft";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { computeValidation, type Readiness } from "@/lib/documents/validation-readiness";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { TZiinaCheckoutSession } from "@/lib/payments/checkout-types";

interface IApplicationPaymentPanelProps {
  applicationId: string;
}

export const ApplicationPaymentPanel: FC<IApplicationPaymentPanelProps> = ({ applicationId }) => {
  const t = useCustomerT();
  const router = useRouter();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showPaddleRetry, setShowPaddleRetry] = useState(false);
  const draft = useApplicationDraft(applicationId);
  const app = draft.app;
  const loadDraft = draft.load;
  const setDraftActionMsg = draft.setActionMsg;
  const setDraftCountdown = draft.setCountdown;

  const documentsPath = `/apply/applications/${encodeURIComponent(applicationId)}`;
  const submittedPath = `/apply/applications/${encodeURIComponent(applicationId)}/submitted`;
  const paidRef = useRef(false);
  const pollCleanupRef = useRef<(() => void) | null>(null);
  const pollUntilPaidRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    paidRef.current = app?.paymentStatus === "paid";
  }, [app?.paymentStatus]);

  const goToSubmitted = useCallback(() => {
    setDraftCountdown(null);
    router.push(submittedPath);
  }, [router, setDraftCountdown, submittedPath]);

  useEffect(() => {
    if (app?.paymentStatus === "paid") {
      goToSubmitted();
    }
  }, [app?.paymentStatus, goToSubmitted]);

  useEffect(() => {
    if (app?.paymentStatus !== "checkout_created") return;
    if (embeddedUrl) return;

    let cancelled = false;
    const run = async () => {
      const res = await fetchApiEnvelope<TZiinaCheckoutSession>(
        apiHref(`/applications/${encodeURIComponent(applicationId)}/checkout-session`),
      );
      if (cancelled) return;
      if (!res.ok) {
        setCheckoutError(t("checkout.errors.sessionUnavailable"));
        return;
      }
      const data = res.data;
      if (data.kind === "open") {
        setShowPaddleRetry(false);
        setEmbeddedUrl(data.embeddedUrl);
        return;
      }
      if (data.kind === "paid") {
        goToSubmitted();
        return;
      }
      if (data.kind === "confirming") {
        pollUntilPaidRef.current();
        return;
      }
      if (data.kind === "not_ziina") {
        setShowPaddleRetry(true);
        return;
      }
      if (data.kind === "closed") {
        setCheckoutError(t("checkout.errors.paymentNotCompleted"));
        return;
      }
      setCheckoutError(t("checkout.errors.sessionUnavailable"));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [app?.paymentStatus, applicationId, embeddedUrl, goToSubmitted, t]);

  useEffect(() => {
    return () => {
      pollCleanupRef.current?.();
    };
  }, []);

  const pollUntilPaid = useCallback(() => {
    pollCleanupRef.current?.();
    setConfirming(true);
    setDraftActionMsg(t("checkout.confirmingWithServers"));
    const startedAt = Date.now();
    let delay = 1000;
    const state: { cancelled: boolean; timer?: ReturnType<typeof setTimeout> } = { cancelled: false };

    const tick = async () => {
      if (state.cancelled || paidRef.current) return;
      if (Date.now() - startedAt > 120_000) {
        state.cancelled = true;
        if (state.timer) clearTimeout(state.timer);
        setConfirming(false);
        setDraftActionMsg(null);
        setCheckoutError(t("checkout.takingLonger"));
        return;
      }
      await fetchApiEnvelope(apiHref(`/applications/${encodeURIComponent(applicationId)}/checkout/reconcile`), {
        method: "POST",
      });
      if (state.cancelled || paidRef.current) return;
      await loadDraft({ silent: true });
      if (state.cancelled || paidRef.current) return;
      delay = Math.min(delay + 250, 2000);
      state.timer = setTimeout(() => void tick(), delay);
    };
    void tick();
    pollCleanupRef.current = () => {
      state.cancelled = true;
      if (state.timer) clearTimeout(state.timer);
    };
  }, [applicationId, loadDraft, setDraftActionMsg, t]);

  useEffect(() => {
    pollUntilPaidRef.current = pollUntilPaid;
  }, [pollUntilPaid]);

  const onZiinaEmbedded = useCallback(
    (url: string) => {
      setCheckoutError(null);
      setShowPaddleRetry(false);
      setEmbeddedUrl(url);
      void loadDraft({ silent: true });
    },
    [loadDraft],
  );

  const onZiinaCompleted = useCallback(() => {
    pollUntilPaid();
  }, [pollUntilPaid]);

  const onZiinaFailed = useCallback(() => {
    setConfirming(false);
    setCheckoutError(t("checkout.errors.paymentNotCompleted"));
  }, [t]);

  const onZiinaCanceled = useCallback(() => {
    setConfirming(false);
    setCheckoutError(t("checkout.errors.paymentNotCompleted"));
  }, [t]);

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
  const sessionLoading =
    app.paymentStatus === "checkout_created" &&
    !embeddedUrl &&
    !showPaddleRetry &&
    !checkoutError &&
    !confirming;

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
          setEmbeddedUrl(null);
          setConfirming(false);
          setShowPaddleRetry(false);
          pollCleanupRef.current?.();
          void draft.cancelCheckout();
        }}
        checkout={{
          onZiinaEmbedded,
          onZiinaCompleted,
          onZiinaFailed,
          onZiinaCanceled,
          onOverlayClosed: () => void loadDraft({ silent: true }),
          onSuccess: goToSubmitted,
          onStartCheckoutTimer: () => {
            if (draft.countdown === null) setDraftCountdown(600);
          },
          onError: (msg: string) => {
            setCheckoutError(msg);
            document.getElementById("draft-payment-section")?.scrollIntoView({ behavior: "smooth" });
          },
        }}
        embeddedUrl={embeddedUrl}
        confirming={confirming}
        sessionLoading={sessionLoading}
        showPaddleRetry={app.paymentStatus === "checkout_created" && showPaddleRetry}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ClientButton
          type="button"
          variant="outline"
          brand="white"
          onClick={() => router.push(documentsPath)}
        >
          {t("payment.previous")}
        </ClientButton>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        <Link href="/" className="text-link hover:underline">
          {t("draft.startAnotherDraft")}
        </Link>
      </p>
    </div>
  );
};

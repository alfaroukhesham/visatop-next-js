"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirectToSubmittedApplication } from "./actions";
import { ClientCenteredStatus } from "@/components/client/client-loading";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { trackEvent } from "@/lib/analytics/gtag-client";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type AppPoll = { paymentStatus: string };

export function CheckoutReturnClient({ applicationId }: { applicationId: string }) {
  const [message, setMessage] = useState("Confirming payment with our servers…");
  const startedAt = useRef(0);
  const nextDelayMs = useRef(1000);
  const paymentCompletedFired = useRef(false);

  useEffect(() => {
    if (startedAt.current === 0) {
      startedAt.current = Date.now();
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (fn: () => void) => {
      const delay = Math.min(nextDelayMs.current, 2000);
      nextDelayMs.current = Math.min(nextDelayMs.current + 250, 2000);
      timer = setTimeout(fn, delay);
    };

    async function pollOnce() {
      try {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > 120_000) {
        setMessage(
          "This is taking longer than usual. Your payment may still be processing—open your application and refresh, or contact support if the charge appears on your statement.",
        );
        return;
      }

      await fetchApiEnvelope<{ reconciled?: boolean }>(
        apiHref(`/applications/${encodeURIComponent(applicationId)}/checkout/reconcile`),
        { method: "POST" },
      );

      const res = await fetchApiEnvelope<{ application: AppPoll }>(
        apiHref(`/applications/${encodeURIComponent(applicationId)}`),
      );
      if (cancelled) return;
      if (!res.ok) {
        setMessage(res.error.message);
        return;
      }

      const ps = res.data.application.paymentStatus;
      if (ps === "paid") {
        if (!paymentCompletedFired.current) {
          paymentCompletedFired.current = true;
          trackEvent(APPLY_FUNNEL_EVENTS.paymentCompleted, {
            application_id: applicationId,
            payment_provider: "ziina",
          });
        }
        await redirectToSubmittedApplication(applicationId);
        return;
      }
      if (ps !== "checkout_created") {
        setMessage(
          "We could not confirm a completed payment yet. Return to your application to check status or try again.",
        );
        return;
      }

      if (!cancelled) schedule(pollOnce);
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setMessage("Something went wrong while confirming payment. Please refresh or contact support.");
      }
    }

    void pollOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId]);

  return (
    <div className="mx-auto max-w-lg px-4">
      <ClientCenteredStatus label={message} />
      <p className="text-center">
        <Link
          href={`/apply/applications/${encodeURIComponent(applicationId)}/payment`}
          className="text-link text-sm font-medium"
        >
          Back to payment
        </Link>
      </p>
    </div>
  );
}

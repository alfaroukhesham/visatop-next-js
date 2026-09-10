"use client";

import { useEffect, useRef, useState, type FC } from "react";
import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirectToSubmittedApplication } from "./actions";
import { ClientCenteredStatus } from "@/components/client/client-loading";
import { trackApplyPaymentCompleted } from "@/lib/analytics/gtag-client";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { useCustomerT } from "@/components/client/customer-i18n-provider";

type TAppPoll = {
  paymentStatus: string;
  chargedAmountMajor?: number | null;
  chargedCurrency?: string | null;
};

interface ICheckoutReturnClientProps {
  applicationId: string;
}

export const CheckoutReturnClient: FC<ICheckoutReturnClientProps> = ({ applicationId }) => {
  const t = useCustomerT();
  const [message, setMessage] = useState(t("checkout.confirmingWithServers"));
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

    const pollOnce = async () => {
      try {
        if (cancelled) return;
        const elapsed = Date.now() - startedAt.current;
        if (elapsed > 120_000) {
          setMessage(t("checkout.takingLonger"));
          return;
        }

        await fetchApiEnvelope<{ reconciled?: boolean }>(
          apiHref(`/applications/${encodeURIComponent(applicationId)}/checkout/reconcile`),
          { method: "POST" },
        );

        const res = await fetchApiEnvelope<{ application: TAppPoll }>(
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
            trackApplyPaymentCompleted({
              applicationId,
              paymentProvider: "ziina",
              value: res.data.application.chargedAmountMajor ?? undefined,
              currency: res.data.application.chargedCurrency ?? undefined,
            });
          }
          await redirectToSubmittedApplication(applicationId);
          return;
        }
        if (ps !== "checkout_created") {
          setMessage(t("checkout.notConfirmedYet"));
          return;
        }

        if (!cancelled) schedule(pollOnce);
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setMessage(t("checkout.confirmError"));
      }
    };

    void pollOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId, t]);

  return (
    <div className="mx-auto max-w-lg px-4">
      <ClientCenteredStatus label={message} />
      <p className="text-center">
        <Link
          href={`/apply/applications/${encodeURIComponent(applicationId)}/payment`}
          className="text-link text-sm font-medium"
        >
          {t("checkout.backToPayment")}
        </Link>
      </p>
    </div>
  );
};

"use client";

import { useState } from "react";
import {
  CheckoutEventNames,
  CheckoutEventsStatus,
  initializePaddle,
  type PaddleEventData,
} from "@paddle/paddle-js";
import { ClientButton } from "@/components/client/client-button";
import { Loader2 } from "lucide-react";
import { apiHref } from "@/lib/app-href";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { trackEvent } from "@/lib/analytics/gtag-client";
import { checkoutErrorToUserMessage } from "@/lib/payments/checkout-client-messages";

interface PaddleCheckoutButtonProps {
  applicationId: string;
  disabled?: boolean;
  onSuccess?: () => void;
  /** Called when Ziina mode is about to redirect the browser to the hosted checkout page. */
  onExternalRedirect?: () => void;
  /** Runs whenever the Paddle overlay closes (success, cancel, or dismiss). Use to refetch server payment state. */
  onOverlayClosed?: () => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

export function PaddleCheckoutButton({
  applicationId,
  disabled,
  onSuccess,
  onExternalRedirect,
  onOverlayClosed,
  onCancel,
  onError,
}: PaddleCheckoutButtonProps) {
  const [isInitializing, setIsInitializing] = useState(false);

  const handleCheckout = async () => {
    /** Per click: overlay may emit `checkout.updated` (status) without `checkout.completed`. */
    const paymentFinished = { current: false };

    const markSuccess = () => {
      if (paymentFinished.current) return;
      paymentFinished.current = true;
      setIsInitializing(false);
      trackEvent(APPLY_FUNNEL_EVENTS.paymentCompleted, {
        application_id: applicationId,
        payment_provider: "paddle",
      });
      onSuccess?.();
    };

    const markFailure = (message: string) => {
      if (paymentFinished.current) return;
      paymentFinished.current = true;
      setIsInitializing(false);
      onError?.(message);
    };

    setIsInitializing(true);
    try {
      const res = await fetch(apiHref("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const raw = await res.text();
      let envelope: {
        ok?: boolean;
        data?:
          | { provider: "paddle"; transactionId: string; clientToken: string }
          | { provider: "ziina"; redirectUrl: string }
          | { transactionId?: string; clientToken?: string };
        error?: { code?: string; message?: string; details?: { reason?: string } };
      };
      try {
        envelope = raw ? (JSON.parse(raw) as typeof envelope) : {};
      } catch {
        throw new Error(
          raw.trim().startsWith("<")
            ? `Checkout failed (HTTP ${res.status}: server returned HTML, not JSON). Check the terminal for a route error.`
            : `Checkout failed (HTTP ${res.status}: response was not JSON).`,
        );
      }

      if (!res.ok) {
        throw new Error(checkoutErrorToUserMessage(envelope.error));
      }

      if (!envelope.ok || !envelope.data) {
        throw new Error(checkoutErrorToUserMessage(envelope.error));
      }

      const data = envelope.data;
      if ("provider" in data && data.provider === "ziina") {
        trackEvent(APPLY_FUNNEL_EVENTS.paymentStarted, {
          application_id: applicationId,
          payment_provider: "ziina",
        });
        onExternalRedirect?.();
        window.location.assign(data.redirectUrl);
        return;
      }

      trackEvent(APPLY_FUNNEL_EVENTS.paymentStarted, {
        application_id: applicationId,
        payment_provider: "paddle",
      });

      if (!("transactionId" in data) || !data.transactionId) {
        throw new Error(checkoutErrorToUserMessage(envelope.error));
      }

      const { transactionId, clientToken } = data;

      const paddleEnv =
        process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

      const paddle = await initializePaddle({
        environment: paddleEnv,
        token: clientToken || process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
        eventCallback: (event: PaddleEventData) => {
          const name =
            event.name ??
            (typeof (event as { event?: unknown }).event === "string"
              ? ((event as { event: string }).event as PaddleEventData["name"])
              : undefined);

          if (name === CheckoutEventNames.CHECKOUT_COMPLETED) {
            markSuccess();
            return;
          }

          if (name === CheckoutEventNames.CHECKOUT_UPDATED) {
            const status = event.data?.status;
            const terminal =
              status === CheckoutEventsStatus.COMPLETED ||
              status === CheckoutEventsStatus.PAID ||
              status === CheckoutEventsStatus.BILLED ||
              (typeof status === "string" &&
                ["completed", "paid", "billed"].includes(status.toLowerCase()));
            if (terminal) {
              markSuccess();
            }
            return;
          }

          if (name === CheckoutEventNames.CHECKOUT_CLOSED) {
            setIsInitializing(false);
            if (!paymentFinished.current) {
              onCancel?.();
            }
            onOverlayClosed?.();
            return;
          }

          if (
            name === CheckoutEventNames.CHECKOUT_ERROR ||
            name === CheckoutEventNames.CHECKOUT_FAILED ||
            name === CheckoutEventNames.CHECKOUT_PAYMENT_FAILED ||
            name === CheckoutEventNames.CHECKOUT_PAYMENT_ERROR
          ) {
            const detail =
              "detail" in event && typeof (event as { detail?: string }).detail === "string"
                ? (event as { detail: string }).detail
                : "Checkout failed";
            markFailure(detail);
          }
        },
      });

      if (!paddle) {
        throw new Error("Failed to initialize Paddle SDK");
      }

      paddle.Checkout.open({
        transactionId,
      });
    } catch (err: unknown) {
      console.error("Checkout error:", err);
      onError?.(err instanceof Error ? err.message : "Checkout failed.");
      setIsInitializing(false);
    }
  };

  return (
    <ClientButton
      onClick={handleCheckout}
      disabled={disabled || isInitializing}
      className="h-12 w-full text-lg font-bold shadow-lg transition-all hover:shadow-xl"
    >
      {isInitializing ? (
        <>
          <Loader2 className="mr-2 size-5 animate-spin" />
          Preparing Secure Checkout...
        </>
      ) : (
        "Pay & Submit Application"
      )}
    </ClientButton>
  );
}

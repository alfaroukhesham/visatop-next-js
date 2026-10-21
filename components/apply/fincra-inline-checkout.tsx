"use client";

import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { apiHref } from "@/lib/app-href";
import { checkoutErrorToUserMessage } from "@/lib/payments/checkout-client-messages";
import {
  loadFincraInlineScript,
  toFincraInitializeOptions,
  type TFincraInlineCheckoutData,
} from "@/lib/payments/fincra-inline";

const openedInlineReferences = new Set<string>();

interface IFincraInlineCheckoutProps {
  checkout: TFincraInlineCheckoutData;
  applicationId: string;
  confirming?: boolean;
  onCompleted: () => void;
  onClosed: () => void;
  onHostedRedirect: (redirectUrl: string) => void;
  onError: (message: string) => void;
}

export const FincraInlineCheckout: FC<IFincraInlineCheckoutProps> = ({
  checkout,
  applicationId,
  confirming = false,
  onCompleted,
  onClosed,
  onHostedRedirect,
  onError,
}) => {
  const t = useCustomerT();
  const checkoutRef = useRef(checkout);
  const applicationIdRef = useRef(applicationId);
  const onCompletedRef = useRef(onCompleted);
  const onClosedRef = useRef(onClosed);
  const onHostedRedirectRef = useRef(onHostedRedirect);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);
  const fallingBackRef = useRef(false);
  const [opening, setOpening] = useState(() => !openedInlineReferences.has(checkout.reference));
  const [closed, setClosed] = useState(false);

  checkoutRef.current = checkout;
  applicationIdRef.current = applicationId;
  onCompletedRef.current = onCompleted;
  onClosedRef.current = onClosed;
  onHostedRedirectRef.current = onHostedRedirect;
  onErrorRef.current = onError;
  tRef.current = t;

  const fallbackToHosted = useCallback(async () => {
    if (fallingBackRef.current) return;
    fallingBackRef.current = true;
    setOpening(true);
    try {
      const res = await fetch(apiHref("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: applicationIdRef.current,
          termsAccepted: true,
          fincraMode: "hosted",
        }),
      });
      const raw = await res.text();
      let envelope: {
        ok?: boolean;
        data?: { provider?: string; mode?: string; redirectUrl?: string };
        error?: { code?: string; message?: string; details?: { reason?: string } };
      } = {};
      try {
        envelope = raw ? (JSON.parse(raw) as typeof envelope) : {};
      } catch {
        throw new Error(tRef.current("checkout.errors.failedDot"));
      }
      if (!res.ok || !envelope.ok || !envelope.data?.redirectUrl) {
        throw new Error(checkoutErrorToUserMessage(envelope.error, tRef.current));
      }
      onHostedRedirectRef.current(envelope.data.redirectUrl);
    } catch (err: unknown) {
      fallingBackRef.current = false;
      setOpening(false);
      onErrorRef.current(err instanceof Error ? err.message : tRef.current("checkout.errors.failedDot"));
    }
  }, []);

  const openPopup = useCallback(async () => {
    setOpening(true);
    setClosed(false);
    try {
      const api = await loadFincraInlineScript();
      api.initialize(
        toFincraInitializeOptions(checkoutRef.current, {
          onSuccess: () => {
            setOpening(false);
            onCompletedRef.current();
          },
          onClose: () => {
            setOpening(false);
            setClosed(true);
            onClosedRef.current();
          },
        }),
      );
      setOpening(false);
    } catch {
      await fallbackToHosted();
    }
  }, [fallbackToHosted]);

  const openPopupRef = useRef(openPopup);
  openPopupRef.current = openPopup;

  useEffect(() => {
    if (openedInlineReferences.has(checkout.reference)) {
      return;
    }
    openedInlineReferences.add(checkout.reference);
    void openPopupRef.current();
  }, [checkout.reference]);

  return (
    <div className="relative mx-auto w-full max-w-[450px]" data-clarity-mask="true">
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-4 py-8">
        {opening && !confirming ? (
          <p className="text-muted-foreground text-center text-sm" role="status">
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            {t("payment.preparingCheckout")}
          </p>
        ) : null}
        {!opening && !confirming ? (
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground text-sm">
              {closed ? t("payment.fincraWindowClosed") : t("payment.completeInWidget")}
            </p>
            <ClientButton type="button" className="h-12 w-full text-lg font-bold" onClick={() => void openPopup()}>
              {t("payment.continueFincraPayment")}
            </ClientButton>
          </div>
        ) : null}
      </div>
      {confirming ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-card/90 px-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-center text-sm font-medium text-foreground">{t("checkout.confirmingWithServers")}</p>
        </div>
      ) : null}
    </div>
  );
};

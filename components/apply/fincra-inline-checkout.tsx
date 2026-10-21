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
  const [opening, setOpening] = useState(false);
  const [closed, setClosed] = useState(false);
  const fallingBackRef = useRef(false);

  const fallbackToHosted = useCallback(async () => {
    if (fallingBackRef.current) return;
    fallingBackRef.current = true;
    setOpening(true);
    try {
      const res = await fetch(apiHref("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, termsAccepted: true, fincraMode: "hosted" }),
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
        throw new Error(t("checkout.errors.failedDot"));
      }
      if (!res.ok || !envelope.ok || !envelope.data?.redirectUrl) {
        throw new Error(checkoutErrorToUserMessage(envelope.error, t));
      }
      onHostedRedirect(envelope.data.redirectUrl);
    } catch (err: unknown) {
      fallingBackRef.current = false;
      setOpening(false);
      onError(err instanceof Error ? err.message : t("checkout.errors.failedDot"));
    }
  }, [applicationId, onError, onHostedRedirect, t]);

  const openPopup = useCallback(async () => {
    setOpening(true);
    setClosed(false);
    try {
      const api = await loadFincraInlineScript();
      api.initialize(
        toFincraInitializeOptions(checkout, {
          onSuccess: () => {
            setOpening(false);
            onCompleted();
          },
          onClose: () => {
            setOpening(false);
            setClosed(true);
            onClosed();
          },
        }),
      );
      setOpening(false);
    } catch {
      await fallbackToHosted();
    }
  }, [checkout, fallbackToHosted, onClosed, onCompleted]);

  useEffect(() => {
    if (openedInlineReferences.has(checkout.reference)) {
      setClosed(true);
      return;
    }
    openedInlineReferences.add(checkout.reference);
    void openPopup();
  }, [checkout.reference, openPopup]);

  return (
    <div className="relative mx-auto w-full max-w-[450px]" data-clarity-mask="true">
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-4 py-8">
        {opening && !confirming ? (
          <p className="text-muted-foreground text-center text-sm" role="status">
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            {t("payment.preparingCheckout")}
          </p>
        ) : null}
        {closed && !confirming ? (
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground text-sm">{t("payment.fincraWindowClosed")}</p>
            <ClientButton type="button" className="h-12 w-full text-lg font-bold" onClick={() => void openPopup()}>
              {t("payment.continueFincraPayment")}
            </ClientButton>
          </div>
        ) : null}
        {!opening && !closed && !confirming ? (
          <p className="text-muted-foreground text-center text-sm">{t("payment.completeInWidget")}</p>
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

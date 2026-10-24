"use client";

import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { apiHref } from "@/lib/app-href";
import { checkoutErrorToUserMessage } from "@/lib/payments/checkout-client-messages";
import {
  claimFincraInlineReference,
  hasFincraInlineReferenceBeenOpened,
  initializeFincraInlineCheckout,
  loadFincraInlineScript,
  type TFincraInlineCheckoutData,
} from "@/lib/payments/fincra-inline";

interface IFincraInlineCheckoutProps {
  checkout: TFincraInlineCheckoutData;
  applicationId: string;
  confirming?: boolean;
  onCompleted: () => void;
  onClosed: () => void;
  onSession?: (checkout: TFincraInlineCheckoutData) => void;
  onHostedRedirect: (redirectUrl: string) => void;
  onError: (message: string) => void;
}

const parseCheckoutEnvelope = (
  raw: string,
): {
  ok?: boolean;
  data?: TFincraInlineCheckoutData | { provider?: string; mode?: string; redirectUrl?: string };
  error?: { code?: string; message?: string; details?: { reason?: string } };
} => {
  try {
    return raw ? (JSON.parse(raw) as ReturnType<typeof parseCheckoutEnvelope>) : {};
  } catch {
    return {};
  }
};

export const FincraInlineCheckout: FC<IFincraInlineCheckoutProps> = ({
  checkout,
  applicationId,
  confirming = false,
  onCompleted,
  onClosed,
  onSession,
  onHostedRedirect,
  onError,
}) => {
  const t = useCustomerT();
  const checkoutRef = useRef(checkout);
  const applicationIdRef = useRef(applicationId);
  const onCompletedRef = useRef(onCompleted);
  const onClosedRef = useRef(onClosed);
  const onSessionRef = useRef(onSession);
  const onHostedRedirectRef = useRef(onHostedRedirect);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);
  const fallingBackRef = useRef(false);
  const widgetOpenRef = useRef(false);
  const refreshingRef = useRef(false);
  const [preparing, setPreparing] = useState(() => !hasFincraInlineReferenceBeenOpened(checkout.reference));
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [closed, setClosed] = useState(false);

  checkoutRef.current = checkout;
  applicationIdRef.current = applicationId;
  onCompletedRef.current = onCompleted;
  onClosedRef.current = onClosed;
  onSessionRef.current = onSession;
  onHostedRedirectRef.current = onHostedRedirect;
  onErrorRef.current = onError;
  tRef.current = t;

  const postCheckout = useCallback(async (fincraMode?: "hosted") => {
    const res = await fetch(apiHref("/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: applicationIdRef.current,
        termsAccepted: true,
        ...(fincraMode ? { fincraMode } : {}),
      }),
    });
    const raw = await res.text();
    const envelope = parseCheckoutEnvelope(raw);
    if (!res.ok || !envelope.ok || !envelope.data) {
      throw new Error(checkoutErrorToUserMessage(envelope.error, tRef.current));
    }
    return envelope.data;
  }, []);

  const fallbackToHosted = useCallback(async () => {
    if (fallingBackRef.current) return;
    fallingBackRef.current = true;
    setPreparing(true);
    try {
      const data = await postCheckout("hosted");
      const redirectUrl = "redirectUrl" in data ? data.redirectUrl : undefined;
      if (!redirectUrl) {
        throw new Error(tRef.current("checkout.errors.failedDot"));
      }
      onHostedRedirectRef.current(redirectUrl);
    } catch (err: unknown) {
      fallingBackRef.current = false;
      setPreparing(false);
      widgetOpenRef.current = false;
      setWidgetOpen(false);
      onErrorRef.current(err instanceof Error ? err.message : tRef.current("checkout.errors.failedDot"));
    }
  }, [postCheckout]);

  const openPopup = useCallback(async () => {
    if (widgetOpenRef.current) return;
    setPreparing(true);
    setClosed(false);
    try {
      const api = await loadFincraInlineScript();
      let settled = false;
      const started = initializeFincraInlineCheckout(api, checkoutRef.current, {
        onSuccess: () => {
          settled = true;
          widgetOpenRef.current = false;
          setWidgetOpen(false);
          setPreparing(false);
          onCompletedRef.current();
        },
        onClose: () => {
          settled = true;
          widgetOpenRef.current = false;
          setWidgetOpen(false);
          setPreparing(false);
          setClosed(true);
          onClosedRef.current();
        },
      });
      if (!started || settled) {
        setPreparing(false);
        return;
      }
      widgetOpenRef.current = true;
      setWidgetOpen(true);
      setPreparing(false);
    } catch {
      await fallbackToHosted();
    }
  }, [fallbackToHosted]);

  const refreshAndOpen = useCallback(async () => {
    if (widgetOpenRef.current || preparing || refreshingRef.current) return;
    refreshingRef.current = true;
    setPreparing(true);
    setClosed(false);
    try {
      const data = await postCheckout();
      if ("mode" in data && data.mode === "hosted" && "redirectUrl" in data && data.redirectUrl) {
        onHostedRedirectRef.current(data.redirectUrl);
        return;
      }
      if (!("mode" in data) || data.mode !== "inline" || !("reference" in data) || !data.reference) {
        throw new Error(tRef.current("checkout.errors.failedDot"));
      }
      const next = data as TFincraInlineCheckoutData;
      checkoutRef.current = next;
      if (onSessionRef.current) {
        onSessionRef.current(next);
        return;
      }
      await openPopup();
    } catch (err: unknown) {
      setPreparing(false);
      onErrorRef.current(err instanceof Error ? err.message : tRef.current("checkout.errors.failedDot"));
    } finally {
      refreshingRef.current = false;
    }
  }, [openPopup, postCheckout, preparing]);

  const openPopupRef = useRef(openPopup);
  openPopupRef.current = openPopup;

  useEffect(() => {
    if (!claimFincraInlineReference(checkout.reference)) {
      return;
    }
    void openPopupRef.current();
  }, [checkout.reference]);

  const busy = preparing || widgetOpen || confirming;

  return (
    <div className="relative mx-auto w-full max-w-[450px]" data-clarity-mask="true">
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-4 py-8">
        {preparing && !confirming ? (
          <p className="text-muted-foreground text-center text-sm" role="status">
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            {t("payment.preparingCheckout")}
          </p>
        ) : null}
        {!preparing && !confirming ? (
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground text-sm">
              {closed ? t("payment.fincraWindowClosed") : t("payment.completeInWidget")}
            </p>
            <ClientButton
              type="button"
              className="h-12 w-full text-lg font-bold"
              disabled={busy}
              onClick={() => void refreshAndOpen()}
            >
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

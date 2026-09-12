"use client";

import { useEffect, useRef, type FC } from "react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import {
  buildZiinaEmbeddedCheckoutSrc,
  parseZiinaCheckoutMessage,
} from "@/lib/payments/ziina-embedded";

interface IZiinaEmbeddedCheckoutProps {
  embeddedUrl: string;
  confirming?: boolean;
  onCompleted: () => void;
  onFailed: () => void;
  onCanceled: () => void;
}

export const ZiinaEmbeddedCheckout: FC<IZiinaEmbeddedCheckoutProps> = ({
  embeddedUrl,
  confirming = false,
  onCompleted,
  onFailed,
  onCanceled,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = buildZiinaEmbeddedCheckoutSrc(embeddedUrl, locale);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const status = parseZiinaCheckoutMessage({
        event,
        expectedSource: iframeRef.current?.contentWindow ?? null,
      });
      if (status === "COMPLETED") onCompleted();
      if (status === "FAILED") onFailed();
      if (status === "CANCELED") onCanceled();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onCompleted, onCanceled, onFailed]);

  return (
    <div className="relative mx-auto w-full max-w-[450px]">
      <iframe
        ref={iframeRef}
        id="ziina-checkout"
        title={t("payment.iframeTitle")}
        src={src}
        className="h-[820px] w-full border-0"
        allow="payment"
      />
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

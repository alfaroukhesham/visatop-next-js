"use client";

import { useEffect, useState, type FC } from "react";
import { createPortal } from "react-dom";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { useNarrowViewport } from "@/lib/client/use-narrow-viewport";
import { APPLY_STICKY_CTA_MEDIA_QUERY } from "@/components/apply/apply-ready-continue";

interface ICheckoutStickyTotalProps {
  totalText: string;
  hidden: boolean;
}

const portalTarget = (): HTMLElement =>
  document.querySelector<HTMLElement>("[data-ui='client']") ?? document.body;

export const CheckoutStickyTotal: FC<ICheckoutStickyTotalProps> = ({ totalText, hidden }) => {
  const t = useCustomerT();
  const compact = useNarrowViewport(APPLY_STICKY_CTA_MEDIA_QUERY);
  const [paymentInView, setPaymentInView] = useState(false);

  useEffect(() => {
    const section = document.getElementById("draft-payment-section");
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPaymentInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.25 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  if (hidden || !compact || paymentInView || typeof document === "undefined") return null;

  const goToPayment = () => {
    const section = document.getElementById("draft-payment-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    const heading = section?.querySelector("h2");
    if (heading instanceof HTMLElement) heading.focus();
  };

  return (
    <>
      <div aria-hidden data-apply-sticky-cta-spacer="" style={{ height: "5.5rem" }} />
      {createPortal(
        <div data-apply-sticky-cta="" data-apply-sticky-cta-portal="">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">{t("payment.total")}</p>
              <p className="font-heading text-foreground font-bold tabular-nums">
                <bdi>{totalText}</bdi>
              </p>
            </div>
            <ClientButton
              type="button"
              brand="cta"
              className="shrink-0"
              onClick={goToPayment}
            >
              {t("extras.bar.cta")}
            </ClientButton>
          </div>
        </div>,
        portalTarget(),
      )}
    </>
  );
};

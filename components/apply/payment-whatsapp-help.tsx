"use client";

import type { FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";

/** Small support line shown directly below the Naira (Fincra) pay / continue button. */
export const PaymentWhatsAppHelp: FC = () => {
  const t = useCustomerT();
  return (
    <p className="text-foreground text-center text-sm" data-testid="payment-whatsapp-help">
      {t("payment.whatsappHelpPrefix")}{" "}
      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link font-semibold underline underline-offset-2"
      >
        {t("payment.whatsappHelpLink")}
      </a>
      {t("payment.whatsappHelpSuffix")}
    </p>
  );
};

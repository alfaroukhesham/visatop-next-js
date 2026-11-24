"use client";

import type { FC } from "react";
import { AlertTriangle } from "lucide-react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { CheckoutStickyTotal } from "@/components/apply/checkout-sticky-total";
import { TripExtrasPanel } from "@/components/apply/trip-extras-panel";
import { useCheckoutQuoteOptional } from "@/components/apply/checkout-quote-provider";
import {
  extrasSectionVisible,
  formatMinorAmount,
  quoteUsesCodeFormat,
} from "@/lib/apply/checkout-extras-ui";

interface ITripExtrasSectionProps {
  variant?: "full" | "speed";
}

export const TripExtrasSection: FC<ITripExtrasSectionProps> = ({ variant = "full" }) => {
  const quote = useCheckoutQuoteOptional();
  const t = useCustomerT();
  const locale = useCustomerLocale();
  if (!quote?.preview) return null;
  if (variant === "full" && !extrasSectionVisible(quote.preview)) return null;
  const preview = quote.preview;
  const totalText = formatMinorAmount(
    preview.totalAmountMinor,
    preview.currency,
    locale,
    quoteUsesCodeFormat(preview) ? "code" : "symbol",
  );

  return (
    <>
      {quote.priceChanged ? (
        <p className="border-primary bg-primary/15 text-foreground flex items-start gap-2 rounded-[12px] border p-3 text-sm" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("extras.priceChanged")}</span>
        </p>
      ) : null}
      <TripExtrasPanel
        preview={preview}
        locked={quote.locked}
        paying={quote.paying}
        switchedBack={quote.switchedBack}
        announceNote={quote.announceNote}
        updateError={quote.updateError}
        onSpeed={(processingSpeed) => void quote.patchTrip({ processingSpeed })}
        onInsurance={(applicationId, selected) => {
          const chosen = new Set(preview.extraLines.flatMap((line) =>
            line.key === "travel_insurance" && line.applicationId ? [line.applicationId] : [],
          ));
          if (selected) chosen.add(applicationId);
          else chosen.delete(applicationId);
          const memberIds = preview.visaLines.map((line) => line.applicationId);
          void quote.patchTrip({
            travelInsurance: (memberIds.length > 0 ? memberIds : [applicationId]).map((id) => ({
              applicationId: id,
              selected: chosen.has(id),
            })),
          });
        }}
        onInsuranceAll={(selected) => {
          const memberIds = preview.visaLines.map((line) => line.applicationId);
          void quote.patchTrip({
            travelInsurance: memberIds.map((applicationId) => ({ applicationId, selected })),
          });
        }}
        onSaveDate={(travelDate) => quote.patchTrip({ travelDate })}
        onRetry={quote.retry}
        onCancelCheckout={quote.cancelCheckout}
        onDateBlocksPay={quote.setDateBlocksPay}
        showDate={variant === "full"}
        showInsurance={variant === "full"}
      />
      {variant === "full" ? <CheckoutStickyTotal totalText={totalText} hidden={quote.locked} /> : null}
    </>
  );
};

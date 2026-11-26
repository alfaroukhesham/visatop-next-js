"use client";

import { useRouter } from "next/navigation";
import type { FC } from "react";
import { ExtrasBreakdown, type TExtrasVisaNameInput } from "@/components/apply/extras-breakdown";
import { ExtrasStepPanel } from "@/components/apply/extras-step-panel";
import { useCheckoutQuoteOptional } from "@/components/apply/checkout-quote-provider";
import { continueWithoutExtras, skipExtrasSave } from "@/lib/apply/continue-without-extras";

interface IExtrasStepSectionProps {
  applicationId: string;
  visaNames: readonly TExtrasVisaNameInput[];
  backHref: string;
}

export const ExtrasStepSection: FC<IExtrasStepSectionProps> = ({
  applicationId,
  visaNames,
  backHref,
}) => {
  const quote = useCheckoutQuoteOptional();
  const router = useRouter();
  const preview = quote?.preview ?? null;
  const paymentHref = `/apply/applications/${encodeURIComponent(applicationId)}/payment`;

  return (
    <>
      <ExtrasStepPanel
        preview={preview}
        visaNames={visaNames}
        loading={Boolean(quote?.loading) && !preview}
        updating={Boolean(quote?.updating)}
        updateError={quote?.updateError ?? null}
        priceChanged={Boolean(quote?.priceChanged)}
        locked={Boolean(quote?.locked)}
        announcement={quote?.announcement ?? null}
        backHref={backHref}
        onInsurance={(selected) => {
          void quote?.patchTrip({ insuranceForParty: selected });
        }}
        onContinue={() => router.push(paymentHref)}
        onSkip={() => {
          void continueWithoutExtras(
            () => skipExtrasSave(quote?.patchTrip),
            () => router.push(paymentHref),
          );
        }}
        onRetry={() => quote?.retry()}
        onCancelCheckout={() => quote?.cancelCheckout()}
      />
    </>
  );
};

interface IExtrasAsideProps {
  visaNames: readonly TExtrasVisaNameInput[];
}

/** Desktop order card. Hidden below 1025px by the page layout. */
export const ExtrasAside: FC<IExtrasAsideProps> = ({ visaNames }) => {
  const quote = useCheckoutQuoteOptional();
  const preview = quote?.preview ?? null;
  if (!preview) return null;
  return (
    <ExtrasBreakdown
      preview={preview}
      visaNames={visaNames}
      updating={Boolean(quote?.updating)}
      showSpeed
      announcement={null}
      live={false}
    />
  );
};

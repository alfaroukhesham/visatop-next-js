"use client";

import type { FC } from "react";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { ExtrasBreakdown } from "@/components/apply/extras-breakdown";
import { ExtrasStepPanel } from "@/components/apply/extras-step-panel";
import { PayOrderSummary } from "@/components/apply/pay-order-summary";
import type { TClientQuotePreview } from "@/lib/apply/checkout-extras-ui";

interface IExtrasStepPreviewClientProps {
  view: "extras" | "pay";
  selected: boolean;
}

const travellers = 2;

const previewFor = (selected: boolean): TClientQuotePreview => {
  const insuranceUnit = 7900;
  const visa = 81400 * travellers;
  const fast = 36800 * travellers;
  const insurance = selected ? insuranceUnit * travellers : 0;
  return {
    currency: "AED",
    todayUae: "2026-11-25",
    maxTravelDate: "2027-05-24",
    travelDateRequired: false,
    thresholdDays: 4,
    travelDate: "2026-11-25",
    daysUntilTravel: 0,
    recommendFastTrack: false,
    processingSpeed: "fast_track",
    processingSpeedSource: "customer",
    locked: false,
    travellerCount: travellers,
    visaLines: [
      { applicationId: "app-a", serviceId: "svc", amountMinor: "81400" },
      { applicationId: "app-b", serviceId: "svc", amountMinor: "81400" },
    ],
    extraLines: [
      { key: "fast_track", applicationId: "app-a", amountMinor: "36800" },
      { key: "fast_track", applicationId: "app-b", amountMinor: "36800" },
      ...(selected
        ? [
            { key: "travel_insurance" as const, applicationId: "app-a", amountMinor: "7900" },
            { key: "travel_insurance" as const, applicationId: "app-b", amountMinor: "7900" },
          ]
        : []),
    ],
    availableExtras: [
      {
        key: "travel_insurance",
        unitAmountMinor: "7900",
        travellerCount: travellers,
        sumAmountMinor: String(insuranceUnit * travellers),
        selected,
        chargeBasis: "per_traveller",
        labelI18n: { en: "Travel insurance" },
        descriptionI18n: { en: "Medical cover for the trip.", ar: "تغطية طبية للرحلة." },
        promiseI18n: null,
        termsUrl: null,
      },
      {
        key: "fast_track",
        unitAmountMinor: "36800",
        travellerCount: travellers,
        sumAmountMinor: String(fast),
        selected: true,
        chargeBasis: "per_traveller",
        labelI18n: { en: "Fast Track" },
        descriptionI18n: {},
        promiseI18n: { en: "within 24 hours", ar: "خلال 24 ساعة" },
        termsUrl: null,
      },
    ],
    visaAmountMinor: String(visa),
    extrasAmountMinor: String(fast + insurance),
    totalAmountMinor: String(visa + fast + insurance),
  };
};

const visaNames = ["30-day tourist visa", "30-day tourist visa"];

export const ExtrasStepPreviewClient: FC<IExtrasStepPreviewClientProps> = ({ view, selected }) => {
  const preview = previewFor(selected);
  return (
    <ApplyTwoColumn
      currentStep={view === "pay" ? 5 : 4}
      phase={view === "pay" ? undefined : "extras"}
      includeExtras
      summaryFrom="desktop"
      applicationId="extras-fixture"
      tripHref="/apply/start?nationality=IN&application=extras-fixture&extras=1"
      hasSelectedVisa
      visaSummary={
        <div className="border-border bg-card rounded-[12px] border p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
          <ExtrasBreakdown
            preview={preview}
            visaNames={visaNames}
            updating={false}
            showSpeed={view !== "pay"}
            announcement={null}
          />
        </div>
      }
      contentClassName="mx-auto w-full max-w-4xl space-y-8"
    >
      {view === "pay" ? (
        <PayOrderSummary applicationId="extras-fixture" visaNames={visaNames} previewOverride={preview} />
      ) : (
        <ExtrasStepPanel
          preview={preview}
          visaNames={visaNames}
          loading={false}
          updating={false}
          updateError={null}
          priceChanged={false}
          locked={false}
          announcement={null}
          backHref="/apply/dev/extras-step-preview"
          onInsurance={() => undefined}
          onContinue={() => undefined}
          onSkip={() => undefined}
          onRetry={() => undefined}
          onCancelCheckout={() => undefined}
        />
      )}
    </ApplyTwoColumn>
  );
};

"use client";

import { useState, type FC } from "react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { ArrivalDateField } from "@/components/apply/arrival-date-field";
import { validateTravelDate } from "@/lib/checkout-extras/dubai-calendar";
import { formatArrivalDate, travelDateErrorKey } from "@/lib/apply/checkout-extras-ui";

interface ITravelDateStepProps {
  value: string;
  onChange: (value: string) => void;
  todayUae: string;
  maxTravelDate: string;
  onContinue: () => void;
  onSkip: () => void;
}

export const TravelDateStep: FC<ITravelDateStepProps> = ({
  value,
  onChange,
  todayUae,
  maxTravelDate,
  onContinue,
  onSkip,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const continueWithDate = () => {
    const validated = validateTravelDate(value.trim() ? value : null, {
      required: false,
      todayUae,
      maxTravelDate,
    });
    if (!validated.ok) {
      setTouched(true);
      setError(
        t(travelDateErrorKey(validated.code), {
          maxDate: formatArrivalDate(maxTravelDate, locale),
        }),
      );
      return;
    }
    if (!validated.date) {
      onSkip();
      return;
    }
    setError(null);
    onContinue();
  };

  return (
    <div className="space-y-4">
      <ArrivalDateField
        id="apply-travel-date"
        value={value}
        onChange={onChange}
        todayUae={todayUae}
        maxTravelDate={maxTravelDate}
        required={false}
        error={error}
        onError={setError}
        touched={touched}
        onTouched={() => setTouched(true)}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ClientButton type="button" brand="white" className="min-h-11" onClick={onSkip}>
          {t("start.travelDate.notSure")}
        </ClientButton>
        <ClientButton type="button" brand="cta" className="min-h-11" onClick={continueWithDate}>
          {t("start.continue")}
        </ClientButton>
      </div>
    </div>
  );
};

"use client";

import { useState, type FC } from "react";
import { AlertCircle } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { InlineMonthCalendar } from "@/components/apply/inline-month-calendar";
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

  const pickDate = (next: string) => {
    onChange(next);
    const validated = validateTravelDate(next, { required: false, todayUae, maxTravelDate });
    setError(
      validated.ok
        ? null
        : t(travelDateErrorKey(validated.code), {
            maxDate: formatArrivalDate(maxTravelDate, locale),
          }),
    );
  };

  const continueWithDate = () => {
    const validated = validateTravelDate(value.trim() ? value : null, {
      required: false,
      todayUae,
      maxTravelDate,
    });
    if (!validated.ok) {
      setError(
        t(travelDateErrorKey(validated.code), {
          maxDate: formatArrivalDate(maxTravelDate, locale),
        }),
      );
      window.setTimeout(() => document.getElementById("travel-date-calendar-grid")?.focus(), 0);
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
      <div className="mx-auto max-w-2xl">
        <h3 className="font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("start.travelDate.label")}
        </h3>
      </div>
      <InlineMonthCalendar
        value={value}
        onChange={pickDate}
        todayUae={todayUae}
        maxTravelDate={maxTravelDate}
      />
      {error ? (
        <p role="alert" className="text-foreground mx-auto flex max-w-lg items-start gap-2 text-sm">
          <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <ClientButton type="button" brand="white" className="min-h-11" onClick={onSkip}>
          {t("start.travelDate.notSure")}
        </ClientButton>
        <ClientButton type="button" brand="cta" className="min-h-11" onClick={continueWithDate}>
          {t("start.travelDate.seeVisas")}
        </ClientButton>
      </div>
    </div>
  );
};

"use client";

import { useId, useState, type FC } from "react";
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
  readOnly?: boolean;
}

export const TravelDateStep: FC<ITravelDateStepProps> = ({
  value,
  onChange,
  todayUae,
  maxTravelDate,
  onContinue,
  onSkip,
  readOnly = false,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

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
      setFocusToken((token) => token + 1);
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
    <div className="space-y-4" data-travel-date-step="">
      <div className="mx-auto max-w-2xl">
        <h3 tabIndex={-1} className="font-heading text-foreground focus:outline-secondary text-center text-2xl font-semibold tracking-tight focus:outline-2 focus:outline-offset-2 sm:text-3xl">
          {t("start.travelDate.label")}
        </h3>
      </div>
      <InlineMonthCalendar
        value={value}
        onChange={pickDate}
        todayUae={todayUae}
        maxTravelDate={maxTravelDate}
        readOnly={readOnly}
        describedBy={error ? errorId : undefined}
        focusToken={focusToken}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-foreground mx-auto flex max-w-lg items-start gap-2 text-sm">
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

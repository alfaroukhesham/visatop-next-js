"use client";

import { useId, type FC, type Ref } from "react";
import { AlertCircle } from "lucide-react";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { validateTravelDate } from "@/lib/checkout-extras/dubai-calendar";
import {
  arrivalReadback,
  formatArrivalDate,
  travelDateErrorKey,
  type TTranslate,
} from "@/lib/apply/checkout-extras-ui";

interface IArrivalDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  todayUae: string;
  maxTravelDate: string;
  required: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  touched: boolean;
  onTouched: () => void;
}

const messageFor = (
  code: "required" | "invalid" | "past" | "too_far",
  t: TTranslate,
  maxTravelDate: string,
  locale: string,
): string =>
  t(travelDateErrorKey(code), {
    maxDate: formatArrivalDate(maxTravelDate, locale),
  });

export const ArrivalDateField: FC<IArrivalDateFieldProps> = ({
  id = "apply-travel-date",
  value,
  onChange,
  todayUae,
  maxTravelDate,
  required,
  error,
  onError,
  inputRef,
  disabled,
  touched,
  onTouched,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const reactId = useId();
  const hintId = `${reactId}-hint`;
  const readbackId = `${reactId}-readback`;
  const errorId = `${id}-error`;
  const readback =
    value && !error ? arrivalReadback(value, todayUae, locale, t) : null;
  const describedBy = [readback ? readbackId : null, hintId, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const label = required
    ? `${t("start.travelDate.label")} *`
    : `${t("start.travelDate.label")} ${t("start.travelDate.optional")}`;

  const validate = (next: string, badInput: boolean) => {
    if (badInput) {
      onError(t("start.travelDate.errorIncomplete"));
      return;
    }
    const result = validateTravelDate(next.trim() ? next : null, {
      required,
      todayUae,
      maxTravelDate,
    });
    onError(
      result.ok ? null : messageFor(result.code, t, maxTravelDate, locale),
    );
  };

  return (
    <ClientField id={id} label={label}>
      <ClientInput
        ref={inputRef}
        id={id}
        type="date"
        required={required}
        aria-required={required}
        disabled={disabled}
        value={value}
        min={todayUae}
        max={maxTravelDate}
        invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          if (touched || error) validate(next, event.target.validity.badInput);
        }}
        onBlur={(event) => {
          onTouched();
          validate(event.target.value, event.target.validity.badInput);
        }}
        className="h-12 min-h-12 w-full rounded-xl sm:max-w-64"
      />
      {readback ? (
        <p id={readbackId} className="text-foreground text-sm font-medium">
          <bdi>{readback}</bdi>
        </p>
      ) : null}
      <p id={hintId} className="text-muted-foreground text-xs leading-relaxed">
        {t("start.travelDate.hint")}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-foreground flex items-start gap-2 text-sm">
          <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </ClientField>
  );
};

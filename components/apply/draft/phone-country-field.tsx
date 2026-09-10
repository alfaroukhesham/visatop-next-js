"use client";

import { useMemo, useState, type FC } from "react";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { composeE164, splitStoredPhone } from "@/lib/apply/phone-country";

export type TPhoneNationalityOption = {
  code: string;
  name: string;
  dialCode: string | null;
};

export interface IPhoneCountryFieldProps {
  nationalities: TPhoneNationalityOption[];
  applicationNationalityCode: string;
  storedPhone: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (e164: string) => void;
}

export const PhoneCountryField: FC<IPhoneCountryFieldProps> = ({
  nationalities,
  applicationNationalityCode,
  storedPhone,
  disabled = false,
  invalid = false,
  onChange,
}) => {
  const t = useCustomerT();
  const defaultDial = useMemo(
    () =>
      nationalities
        .find((n) => n.code === applicationNationalityCode)
        ?.dialCode?.replace(/\D/g, "") ?? "",
    [nationalities, applicationNationalityCode],
  );

  const initial = splitStoredPhone(storedPhone, defaultDial);
  const [dialDigits, setDialDigits] = useState(initial.dial);
  const [nationalDigits, setNationalDigits] = useState(initial.national);

  const emitChange = (dial: string, national: string) => {
    onChange(composeE164(dial, national));
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-[5.5rem] shrink-0">
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
          +
        </span>
        <ClientInput
          type="tel"
          inputMode="numeric"
          autoComplete="tel-country-code"
          maxLength={6}
          disabled={disabled}
          invalid={invalid}
          aria-label={t("draft.fields.countryCallingCode")}
          value={dialDigits}
          className="h-8 pl-6"
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
            setDialDigits(next);
            emitChange(next, nationalDigits);
          }}
        />
      </div>
      <ClientInput
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        invalid={invalid}
        value={nationalDigits}
        placeholder={t("draft.fields.phoneNumberPlaceholder")}
        className="h-8 min-w-0 flex-1"
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "");
          setNationalDigits(next);
          emitChange(dialDigits, next);
        }}
      />
    </div>
  );
};

"use client";

import Link from "next/link";
import { useCallback, useState, type FC } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyManualAedChange,
  applyManualUsdChange,
  type TFxFillDirty,
} from "@/lib/admin/catalog/service-price-fx-fill";
import { FX_SETTINGS_HREF } from "@/lib/admin/catalog/apply-service-price-ui-updates";

interface ICatalogServicePriceInputsProps {
  aedMajor: string;
  usdMajor: string;
  onAedChange: (value: string) => void;
  onUsdChange: (value: string) => void;
  fxConfigured: boolean;
  fxAedPerUsd: string | null;
  disabled?: boolean;
  showFxMissingHint?: boolean;
  idPrefix: string;
}

export const CatalogServicePriceInputs: FC<ICatalogServicePriceInputsProps> = ({
  aedMajor,
  usdMajor,
  onAedChange,
  onUsdChange,
  fxConfigured,
  fxAedPerUsd,
  disabled = false,
  showFxMissingHint = false,
  idPrefix,
}) => (
  <div className="space-y-4">
    {showFxMissingHint && !fxConfigured ? (
      <p className="text-destructive text-sm leading-relaxed border-b-2 border-destructive/40 pl-3">
        FX is not configured.{" "}
        <Link href={FX_SETTINGS_HREF} className="underline underline-offset-4">
          Open Settings
        </Link>
        , set AED per 1 USD, then come back.
      </p>
    ) : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-aed`}>Price (AED)</Label>
        <Input
          id={`${idPrefix}-aed`}
          inputMode="decimal"
          value={aedMajor}
          onChange={(e) => onAedChange(e.target.value)}
          placeholder="e.g. 419.00"
          disabled={disabled}
          className="font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-usd`}>Price (USD)</Label>
        <Input
          id={`${idPrefix}-usd`}
          inputMode="decimal"
          value={usdMajor}
          onChange={(e) => onUsdChange(e.target.value)}
          placeholder="e.g. 114.00"
          disabled={disabled}
          className="font-mono"
        />
      </div>
    </div>
    {fxConfigured && fxAedPerUsd ? (
      <p className="text-muted-foreground text-xs leading-relaxed">
        Entering one currency fills the other using the configured display FX rate ({fxAedPerUsd}{" "}
        AED per 1 USD). You can edit either field.
      </p>
    ) : null}
  </div>
);

interface IUseDualCurrencyFxFillResult {
  aedMajor: string;
  usdMajor: string;
  onAedChange: (value: string) => void;
  onUsdChange: (value: string) => void;
  reset: () => void;
  setPair: (aed: string, usd: string) => void;
}

export const useDualCurrencyFxFill = (
  fxConfigured: boolean,
  fxAedPerUsd: string | null,
  initialAed = "",
  initialUsd = "",
): IUseDualCurrencyFxFillResult => {
  const [aedMajor, setAedMajor] = useState(initialAed);
  const [usdMajor, setUsdMajor] = useState(initialUsd);
  const [dirty, setDirty] = useState<TFxFillDirty>({ aed: false, usd: false });

  const onAedChange = (value: string) => {
    const next = applyManualAedChange(value, usdMajor, dirty, fxConfigured, fxAedPerUsd);
    setAedMajor(next.aed);
    setUsdMajor(next.usd);
    setDirty(next.dirty);
  };

  const onUsdChange = (value: string) => {
    const next = applyManualUsdChange(value, aedMajor, dirty, fxConfigured, fxAedPerUsd);
    setAedMajor(next.aed);
    setUsdMajor(next.usd);
    setDirty(next.dirty);
  };

  const reset = useCallback(() => {
    setAedMajor("");
    setUsdMajor("");
    setDirty({ aed: false, usd: false });
  }, []);

  const setPair = useCallback((aed: string, usd: string) => {
    setAedMajor(aed);
    setUsdMajor(usd);
    setDirty({ aed: false, usd: false });
  }, []);

  return { aedMajor, usdMajor, onAedChange, onUsdChange, reset, setPair };
};

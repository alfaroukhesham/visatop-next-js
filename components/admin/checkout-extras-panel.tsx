"use client";

import { useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  suggestMissingGlobalPrice,
  type TGlobalCheckoutCurrency,
} from "@/lib/checkout-extras/suggest-global-price";
import type { TCheckoutExtraAdmin, TCheckoutExtraKey } from "@/lib/checkout-extras/types";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "@/lib/i18n/customer-locale";
import { ADMIN_IMPORT_CURRENCIES } from "@/lib/payments/local-checkout-config";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

interface ICheckoutExtrasPanelProps {
  extras: TCheckoutExtraAdmin[];
  fxAedPerUsd: string | null;
  canWrite: boolean;
}

const SELECT_CLASS =
  "border-border bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none";

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  tr: "Turkish",
  ar: "Arabic",
  de: "German",
  hi: "Hindi",
  tl: "Filipino",
  ru: "Russian",
  ha: "Hausa",
};

const EXTRA_COPY: Record<TCheckoutExtraKey, { title: string; blurb: string }> = {
  travel_insurance: {
    title: "Travel insurance",
    blurb: "Optional add-on charged per traveller. Starting price is 79 AED.",
  },
  fast_track: {
    title: "Fast Track",
    blurb: "Optional processing speed charged per traveller. Starting price is 100 USD.",
  },
};

const priceDrafts = (extra: TCheckoutExtraAdmin): Record<string, string> => {
  const drafts: Record<string, string> = {};
  for (const currency of ADMIN_IMPORT_CURRENCIES) drafts[currency] = "";
  for (const price of extra.prices) drafts[price.currency] = price.amountMajor;
  return drafts;
};

const localeDrafts = (map: Record<string, string> | null): Record<string, string> => {
  const drafts: Record<string, string> = {};
  for (const slug of FALLBACK_CUSTOMER_LOCALE_SLUGS) drafts[slug] = map?.[slug] ?? "";
  return drafts;
};

interface ICheckoutExtraFormProps {
  extra: TCheckoutExtraAdmin;
  fxAedPerUsd: string | null;
  canWrite: boolean;
  onSaved: (extra: TCheckoutExtraAdmin) => void;
}

const CheckoutExtraForm: FC<ICheckoutExtraFormProps> = ({ extra, fxAedPerUsd, canWrite, onSaved }) => {
  const [enabled, setEnabled] = useState(extra.enabled);
  const [baseCurrency, setBaseCurrency] = useState(extra.baseCurrency);
  const [baseAmountMajor, setBaseAmountMajor] = useState(extra.baseAmountMajor);
  const [labels, setLabels] = useState(() => localeDrafts(extra.labels));
  const [descriptions, setDescriptions] = useState(() => localeDrafts(extra.descriptions));
  const [promise, setPromise] = useState(() => localeDrafts(extra.promise));
  const [termsUrl, setTermsUrl] = useState(extra.termsUrl ?? "");
  const [prices, setPrices] = useState(() => priceDrafts(extra));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateSuggestion, setRateSuggestion] = useState<{
    currency: TGlobalCheckoutCurrency;
    amountMajor: string;
  } | null>(null);

  const copy = EXTRA_COPY[extra.key];
  const isFastTrack = extra.key === "fast_track";

  const onSuggestRate = () => {
    const suggestion = suggestMissingGlobalPrice({
      usdMajor: prices.USD ?? "",
      aedMajor: prices.AED ?? "",
      fxAedPerUsd,
    });
    if (!suggestion) {
      setRateSuggestion(null);
      setError(
        fxAedPerUsd
          ? "Enter either USD or AED, and leave the other blank, to suggest a price."
          : "Set Display FX before suggesting USD or AED. Local currencies stay manual.",
      );
      setMessage(null);
      return;
    }
    setRateSuggestion(suggestion);
    setError(null);
    setMessage(null);
  };

  const onUseSuggestion = () => {
    if (!rateSuggestion) return;
    setPrices((current) => ({ ...current, [rateSuggestion.currency]: rateSuggestion.amountMajor }));
    setMessage(`${rateSuggestion.currency} is in the form only. Save to store the price.`);
    setRateSuggestion(null);
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetchApiEnvelope<{ extra: TCheckoutExtraAdmin }>(
      apiHref(`/admin/catalog/extras/${extra.key}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          baseCurrency,
          baseAmountMajor,
          labels,
          descriptions,
          promise: isFastTrack ? promise : null,
          termsUrl: termsUrl.trim() ? termsUrl.trim() : null,
          prices: ADMIN_IMPORT_CURRENCIES.map((currency) => ({
            currency,
            amountMajor: prices[currency] ?? "",
          })),
        }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const saved = res.data.extra;
    setEnabled(saved.enabled);
    setBaseCurrency(saved.baseCurrency);
    setBaseAmountMajor(saved.baseAmountMajor);
    setLabels(localeDrafts(saved.labels));
    setDescriptions(localeDrafts(saved.descriptions));
    setPromise(localeDrafts(saved.promise));
    setTermsUrl(saved.termsUrl ?? "");
    setPrices(priceDrafts(saved));
    setMessage("Saved.");
    onSaved(saved);
  };

  return (
    <Card className="border-border border">
      <CardHeader className="border-border bg-muted/20 border-b">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-heading text-lg">{copy.title}</CardTitle>
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <CardDescription>{copy.blurb} Applies to every service.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={onSave} className="space-y-6">
          {error ? (
            <p className="border-destructive/40 text-destructive border-b-2 py-1 pl-3 text-sm">{error}</p>
          ) : null}
          {message ? (
            <p className="border-success/40 bg-success/10 text-success border-b-2 py-1 pl-3 text-sm">{message}</p>
          ) : null}

          <div className="flex items-center gap-2">
            <input
              id={`${extra.key}-enabled`}
              type="checkbox"
              className="accent-primary size-4"
              checked={enabled}
              disabled={!canWrite || saving}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <Label htmlFor={`${extra.key}-enabled`} className="font-normal">
              Enabled for checkout
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${extra.key}-base-currency`}>Base currency</Label>
              <select
                id={`${extra.key}-base-currency`}
                className={SELECT_CLASS}
                value={baseCurrency}
                disabled={!canWrite || saving}
                onChange={(event) => setBaseCurrency(event.target.value)}
              >
                {ADMIN_IMPORT_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${extra.key}-base-amount`}>Base amount</Label>
              <Input
                id={`${extra.key}-base-amount`}
                inputMode="decimal"
                required
                value={baseAmountMajor}
                disabled={!canWrite || saving}
                onChange={(event) => setBaseAmountMajor(event.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold">Customer copy</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`${extra.key}-label-en`}>English label</Label>
                <Input
                  id={`${extra.key}-label-en`}
                  required
                  maxLength={80}
                  value={labels.en ?? ""}
                  disabled={!canWrite || saving}
                  onChange={(event) => setLabels((current) => ({ ...current, en: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${extra.key}-description-en`}>English description</Label>
                <Input
                  id={`${extra.key}-description-en`}
                  maxLength={400}
                  value={descriptions.en ?? ""}
                  disabled={!canWrite || saving}
                  onChange={(event) =>
                    setDescriptions((current) => ({ ...current, en: event.target.value }))
                  }
                />
              </div>
              {isFastTrack ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`${extra.key}-promise-en`}>English promise</Label>
                  <Input
                    id={`${extra.key}-promise-en`}
                    required
                    maxLength={200}
                    value={promise.en ?? ""}
                    disabled={!canWrite || saving}
                    onChange={(event) => setPromise((current) => ({ ...current, en: event.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <details className="border-border border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Other languages</summary>
              <div className="mt-3 space-y-4">
                {FALLBACK_CUSTOMER_LOCALE_SLUGS.filter((slug) => slug !== "en").map((slug) => (
                  <div key={slug} className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`${extra.key}-label-${slug}`}>
                        {LOCALE_NAMES[slug] ?? slug} label
                      </Label>
                      <Input
                        id={`${extra.key}-label-${slug}`}
                        maxLength={80}
                        value={labels[slug] ?? ""}
                        disabled={!canWrite || saving}
                        onChange={(event) =>
                          setLabels((current) => ({ ...current, [slug]: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${extra.key}-description-${slug}`}>
                        {LOCALE_NAMES[slug] ?? slug} description
                      </Label>
                      <Input
                        id={`${extra.key}-description-${slug}`}
                        maxLength={400}
                        value={descriptions[slug] ?? ""}
                        disabled={!canWrite || saving}
                        onChange={(event) =>
                          setDescriptions((current) => ({ ...current, [slug]: event.target.value }))
                        }
                      />
                    </div>
                    {isFastTrack ? (
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={`${extra.key}-promise-${slug}`}>
                          {LOCALE_NAMES[slug] ?? slug} promise
                        </Label>
                        <Input
                          id={`${extra.key}-promise-${slug}`}
                          maxLength={200}
                          value={promise[slug] ?? ""}
                          disabled={!canWrite || saving}
                          onChange={(event) =>
                            setPromise((current) => ({ ...current, [slug]: event.target.value }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${extra.key}-terms`}>Terms URL</Label>
            <Input
              id={`${extra.key}-terms`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={termsUrl}
              disabled={!canWrite || saving}
              onChange={(event) => setTermsUrl(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-heading text-sm font-semibold">Prices by currency</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Stored amounts are the checkout price. A blank currency hides this extra for that currency.
                  A rate suggestion stays in this form until you save. Local currencies are never suggested.
                </p>
              </div>
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none"
                  disabled={saving || !fxAedPerUsd}
                  onClick={onSuggestRate}
                >
                  Suggest USD/AED from display rate
                </Button>
              ) : null}
            </div>
            {rateSuggestion ? (
              <div className="border-border flex flex-wrap items-center justify-between gap-3 border px-3 py-2">
                <p className="text-sm">
                  Suggested {rateSuggestion.currency} {rateSuggestion.amountMajor}. This is not saved.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="rounded-none" onClick={onUseSuggestion}>
                    Use in form
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    onClick={() => setRateSuggestion(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {ADMIN_IMPORT_CURRENCIES.map((currency) => {
                const blank = (prices[currency] ?? "").trim() === "";
                return (
                  <div key={currency} className="space-y-1">
                    <Label htmlFor={`${extra.key}-price-${currency}`}>{currency}</Label>
                    <Input
                      id={`${extra.key}-price-${currency}`}
                      inputMode="decimal"
                      value={prices[currency] ?? ""}
                      disabled={!canWrite || saving}
                      onChange={(event) =>
                        setPrices((current) => ({ ...current, [currency]: event.target.value }))
                      }
                      className="font-mono"
                      placeholder="Blank hides it"
                    />
                    {blank ? (
                      <p className="text-muted-foreground text-xs">No {currency} price — hidden for that checkout.</p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {currency === "USD" || currency === "AED" ? "Global currency" : "Local currency"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {canWrite ? (
            <Button type="submit" disabled={saving} className="rounded-none font-semibold">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};

export const CheckoutExtrasPanel: FC<ICheckoutExtrasPanelProps> = ({ extras, fxAedPerUsd, canWrite }) => {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Partial<Record<TCheckoutExtraKey, TCheckoutExtraAdmin>>>({});
  const byKey = new Map(extras.map((extra) => [extra.key, overrides[extra.key] ?? extra]));

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
        Customers do not see these options on the apply or pay pages yet. Enabling an extra stores the flag for
        the checkout release. Checkout will use the saved currency amount and will not call a live exchange rate.
      </p>
      {(["travel_insurance", "fast_track"] as const).map((key) => {
        const extra = byKey.get(key);
        if (!extra) {
          return (
            <Card key={key} className="border-border border">
              <CardHeader>
                <CardTitle className="font-heading text-lg">{EXTRA_COPY[key].title}</CardTitle>
                <CardDescription>
                  This extra is missing from the catalog. Add the checkout extras migration before editing it.
                </CardDescription>
              </CardHeader>
            </Card>
          );
        }
        return (
          <CheckoutExtraForm
            key={key}
            extra={extra}
            fxAedPerUsd={fxAedPerUsd}
            canWrite={canWrite}
            onSaved={(saved) => {
              setOverrides((current) => ({ ...current, [saved.key]: saved }));
              router.refresh();
            }}
          />
        );
      })}
    </div>
  );
};

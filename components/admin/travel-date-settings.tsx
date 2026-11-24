"use client";

import { useState, type FC, type FormEvent } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TTravelDateSettings } from "@/lib/checkout-extras/types";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

interface ITravelDateSettingsProps {
  settings: TTravelDateSettings;
}

type TTravelDateField =
  | "fastTrackThresholdDays"
  | "travelDateMaxDaysAhead"
  | "travelDateRequired"
  | "travelDateStepEnabled";

const TRAVEL_DATE_FIELDS: readonly TTravelDateField[] = [
  "fastTrackThresholdDays",
  "travelDateMaxDaysAhead",
  "travelDateRequired",
  "travelDateStepEnabled",
];

const travelDateErrorField = (details: unknown): TTravelDateField | null => {
  if (typeof details !== "object" || details === null || !("field" in details)) return null;
  const field = (details as { field?: unknown }).field;
  return TRAVEL_DATE_FIELDS.find((candidate) => candidate === field) ?? null;
};

const travelDateErrorFields = (details: unknown): Partial<Record<TTravelDateField, string>> => {
  if (typeof details === "object" && details !== null && "fields" in details) {
    const rows = (details as { fields?: unknown }).fields;
    if (Array.isArray(rows)) {
      const map: Partial<Record<TTravelDateField, string>> = {};
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const field = TRAVEL_DATE_FIELDS.find((candidate) => candidate === (row as { field?: unknown }).field);
        const message = (row as { message?: unknown }).message;
        if (field && typeof message === "string") map[field] = message;
      }
      if (Object.keys(map).length > 0) return map;
    }
  }
  const field = travelDateErrorField(details);
  return field ? { [field]: "Check this field." } : {};
};

const FIELD_CONTROL_ID: Record<TTravelDateField, string> = {
  fastTrackThresholdDays: "fast-track-threshold-days",
  travelDateMaxDaysAhead: "travel-date-max-days",
  travelDateRequired: "travel-date-required",
  travelDateStepEnabled: "travel-date-step-enabled",
};

export const TravelDateSettings: FC<ITravelDateSettingsProps> = ({ settings }) => {
  const [thresholdDays, setThresholdDays] = useState(String(settings.fastTrackThresholdDays));
  const [required, setRequired] = useState(settings.travelDateRequired);
  const [stepEnabled, setStepEnabled] = useState(settings.travelDateStepEnabled);
  const [maxDaysAhead, setMaxDaysAhead] = useState(String(settings.travelDateMaxDaysAhead));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TTravelDateField, string>>>({});

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    setFieldErrors({});
    const res = await fetchApiEnvelope<TTravelDateSettings>(apiHref("/admin/settings/travel-date"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fastTrackThresholdDays: Number.parseInt(thresholdDays, 10),
        travelDateRequired: required,
        travelDateStepEnabled: stepEnabled,
        travelDateMaxDaysAhead: Number.parseInt(maxDaysAhead, 10),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const fields = travelDateErrorFields(res.error.details);
      const named = Object.keys(fields) as TTravelDateField[];
      if (named.length > 0) {
        setFieldErrors(fields);
        const first = named[0];
        if (first) document.getElementById(FIELD_CONTROL_ID[first])?.focus();
      } else {
        setError(res.error.message);
      }
      return;
    }
    setThresholdDays(String(res.data.fastTrackThresholdDays));
    setRequired(res.data.travelDateRequired);
    setStepEnabled(res.data.travelDateStepEnabled);
    setMaxDaysAhead(String(res.data.travelDateMaxDaysAhead));
    setMessage("Saved.");
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      {error ? (
        <p className="border-border text-foreground flex items-start gap-2 border-b-2 py-1 pl-3 text-sm leading-relaxed">
          <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
      {message ? (
        <p className="border-success/40 bg-success/10 text-success border-b-2 py-1 pl-3 text-sm">{message}</p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="fast-track-threshold-days">Fast Track threshold (days)</Label>
        <Input
          id="fast-track-threshold-days"
          inputMode="numeric"
          required
          min={1}
          max={60}
          value={thresholdDays}
          aria-invalid={fieldErrors.fastTrackThresholdDays ? true : undefined}
          aria-describedby={
            fieldErrors.fastTrackThresholdDays ? "fast-track-threshold-days-error" : undefined
          }
          onChange={(event) => {
            setThresholdDays(event.target.value);
            setFieldErrors((current) => {
              if (!current.fastTrackThresholdDays) return current;
              const next = { ...current };
              delete next.fastTrackThresholdDays;
              return next;
            });
          }}
          className={
            fieldErrors.fastTrackThresholdDays
              ? "border-destructive rounded-none font-mono"
              : "rounded-none font-mono"
          }
        />
        {fieldErrors.fastTrackThresholdDays ? (
          <p
            id="fast-track-threshold-days-error"
            className="text-foreground flex items-start gap-1.5 text-xs"
            role="alert"
          >
            <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{fieldErrors.fastTrackThresholdDays}</span>
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs leading-relaxed">
          When the travel date is sooner than this many days, Fast Track shows a Recommended badge. Standard stays
          selected. Customers can always choose standard processing. Payment is never blocked.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="travel-date-required"
            type="checkbox"
            className="accent-primary size-4"
            checked={required}
            aria-invalid={fieldErrors.travelDateRequired ? true : undefined}
            aria-describedby={fieldErrors.travelDateRequired ? "travel-date-required-error" : undefined}
            onChange={(event) => {
              setRequired(event.target.checked);
              setFieldErrors((current) => {
                if (!current.travelDateRequired) return current;
                const next = { ...current };
                delete next.travelDateRequired;
                return next;
              });
            }}
          />
          <Label htmlFor="travel-date-required" className="font-normal">
            Require a travel date on new applications
          </Label>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Off by default. The date step stays skippable, and checkout accepts an application with no date.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="travel-date-step-enabled"
            type="checkbox"
            className="accent-primary size-4"
            checked={stepEnabled}
            aria-invalid={fieldErrors.travelDateStepEnabled ? true : undefined}
            aria-describedby={fieldErrors.travelDateStepEnabled ? "travel-date-step-enabled-error" : undefined}
            onChange={(event) => {
              setStepEnabled(event.target.checked);
              setFieldErrors((current) => {
                if (!current.travelDateStepEnabled) return current;
                const next = { ...current };
                delete next.travelDateStepEnabled;
                return next;
              });
            }}
          />
          <Label htmlFor="travel-date-step-enabled" className="font-normal">
            Show the travel date step
          </Label>
        </div>
        {fieldErrors.travelDateStepEnabled ? (
          <p id="travel-date-step-enabled-error" className="text-foreground flex items-start gap-1.5 text-xs" role="alert">
            <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{fieldErrors.travelDateStepEnabled}</span>
          </p>
        ) : null}
        {fieldErrors.travelDateRequired ? (
          <p
            id="travel-date-required-error"
            className="text-foreground flex items-start gap-1.5 text-xs"
            role="alert"
          >
            <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{fieldErrors.travelDateRequired}</span>
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="travel-date-max-days">Maximum days ahead</Label>
        <Input
          id="travel-date-max-days"
          inputMode="numeric"
          required
          min={1}
          max={730}
          value={maxDaysAhead}
          aria-invalid={fieldErrors.travelDateMaxDaysAhead ? true : undefined}
          aria-describedby={fieldErrors.travelDateMaxDaysAhead ? "travel-date-max-days-error" : undefined}
          onChange={(event) => {
            setMaxDaysAhead(event.target.value);
            setFieldErrors((current) => {
              if (!current.travelDateMaxDaysAhead) return current;
              const next = { ...current };
              delete next.travelDateMaxDaysAhead;
              return next;
            });
          }}
          className={
            fieldErrors.travelDateMaxDaysAhead
              ? "border-destructive rounded-none font-mono"
              : "rounded-none font-mono"
          }
        />
        {fieldErrors.travelDateMaxDaysAhead ? (
          <p
            id="travel-date-max-days-error"
            className="text-foreground flex items-start gap-1.5 text-xs"
            role="alert"
          >
            <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{fieldErrors.travelDateMaxDaysAhead}</span>
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={saving} className="rounded-none font-semibold">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
};

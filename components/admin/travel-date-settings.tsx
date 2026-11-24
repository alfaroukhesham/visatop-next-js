"use client";

import { useState, type FC, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TTravelDateSettings } from "@/lib/checkout-extras/types";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

interface ITravelDateSettingsProps {
  settings: TTravelDateSettings;
}

export const TravelDateSettings: FC<ITravelDateSettingsProps> = ({ settings }) => {
  const [thresholdDays, setThresholdDays] = useState(String(settings.fastTrackThresholdDays));
  const [required, setRequired] = useState(settings.travelDateRequired);
  const [maxDaysAhead, setMaxDaysAhead] = useState(String(settings.travelDateMaxDaysAhead));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetchApiEnvelope<TTravelDateSettings>(apiHref("/admin/settings/travel-date"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fastTrackThresholdDays: Number.parseInt(thresholdDays, 10),
        travelDateRequired: required,
        travelDateMaxDaysAhead: Number.parseInt(maxDaysAhead, 10),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setThresholdDays(String(res.data.fastTrackThresholdDays));
    setRequired(res.data.travelDateRequired);
    setMaxDaysAhead(String(res.data.travelDateMaxDaysAhead));
    setMessage("Saved.");
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      {error ? (
        <p className="border-destructive/40 text-destructive border-b-2 py-1 pl-3 text-sm leading-relaxed">{error}</p>
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
          onChange={(event) => setThresholdDays(event.target.value)}
          className="rounded-none font-mono"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          When the travel date is sooner than this many days, Fast Track is recommended and pre-selected. Customers
          can always choose standard processing. Payment is never blocked.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="travel-date-required"
          type="checkbox"
          className="accent-primary size-4"
          checked={required}
          onChange={(event) => setRequired(event.target.checked)}
        />
        <Label htmlFor="travel-date-required" className="font-normal">
          Require a travel date on new applications
        </Label>
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
          onChange={(event) => setMaxDaysAhead(event.target.value)}
          className="rounded-none font-mono"
        />
      </div>
      <Button type="submit" disabled={saving} className="rounded-none font-semibold">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
};

"use client";

import { useState, type FC, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

interface IPartySettingsProps {
  partyEnabled: boolean;
  partyMaxTravelers: number;
}

type TApplyConfigData = {
  partyEnabled: boolean;
  partyMaxTravelers: number;
  badges: { allFeesIncluded: string; noHiddenCharges: string };
};

export const PartySettings: FC<IPartySettingsProps> = ({ partyEnabled, partyMaxTravelers }) => {
  const [enabled, setEnabled] = useState(partyEnabled);
  const [maxTravelers, setMaxTravelers] = useState(String(partyMaxTravelers));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetchApiEnvelope<TApplyConfigData>(apiHref("/admin/settings/apply-config"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyEnabled: enabled,
        partyMaxTravelers: Number.parseInt(maxTravelers, 10),
      }),
    });
    if (!res.ok) {
      setError(res.error.message);
      setSaving(false);
      return;
    }
    setEnabled(res.data.partyEnabled);
    setMaxTravelers(String(res.data.partyMaxTravelers));
    setMessage("Saved. New checkouts pick up this setting.");
    setSaving(false);
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      {error ? (
        <p className="text-destructive text-sm leading-relaxed border-b-2 border-destructive/40 pl-3">{error}</p>
      ) : null}
      {message ? (
        <p className="text-success text-sm border-b-2 border-success/40 bg-success/10 pl-3 py-1">{message}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          id="party-enabled"
          type="checkbox"
          className="accent-primary size-4"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label="Allow more than one traveller on a checkout"
        />
        <Label htmlFor="party-enabled" className="font-normal">
          Allow more than one traveller on a checkout
        </Label>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        When off, customers can only apply for one traveller. Existing multi-traveller applications stay in
        Applications.
      </p>
      <div className="space-y-2">
        <Label htmlFor="party-max-travelers">Maximum travellers per checkout</Label>
        <Input
          id="party-max-travelers"
          inputMode="numeric"
          required
          min={1}
          max={20}
          value={maxTravelers}
          onChange={(e) => setMaxTravelers(e.target.value)}
          className="rounded-none font-mono"
        />
      </div>
      <Button type="submit" disabled={saving} className="rounded-none font-semibold">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
};

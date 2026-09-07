"use client";

import { useState, type FC, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { TApplyPriceBadges } from "@/lib/apply/apply-config";

interface IApplyPriceBadgeSettingsProps {
  badges: TApplyPriceBadges;
}

type TApplyConfigData = {
  partyEnabled: boolean;
  partyMaxTravelers: number;
  badges: TApplyPriceBadges;
};

export const ApplyPriceBadgeSettings: FC<IApplyPriceBadgeSettingsProps> = ({ badges }) => {
  const [allFeesIncluded, setAllFeesIncluded] = useState(badges.allFeesIncluded);
  const [noHiddenCharges, setNoHiddenCharges] = useState(badges.noHiddenCharges);
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
        badges: { allFeesIncluded, noHiddenCharges },
      }),
    });
    if (!res.ok) {
      setError(res.error.message);
      setSaving(false);
      return;
    }
    setAllFeesIncluded(res.data.badges.allFeesIncluded);
    setNoHiddenCharges(res.data.badges.noHiddenCharges);
    setMessage("Saved. These strings appear on the apply chooser.");
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
      <div className="space-y-2">
        <Label htmlFor="badge-all-fees-included">All fees included</Label>
        <Input
          id="badge-all-fees-included"
          maxLength={80}
          value={allFeesIncluded}
          onChange={(e) => setAllFeesIncluded(e.target.value)}
          className="rounded-none font-mono"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="badge-no-hidden-charges">No hidden charges</Label>
        <Input
          id="badge-no-hidden-charges"
          maxLength={80}
          value={noHiddenCharges}
          onChange={(e) => setNoHiddenCharges(e.target.value)}
          className="rounded-none font-mono"
        />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        These strings appear on the apply chooser. Leave a field empty to restore its default.
      </p>
      <Button type="submit" disabled={saving} className="rounded-none font-semibold">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
};

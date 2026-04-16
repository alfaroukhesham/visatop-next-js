"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

export function DraftTtlSettings() {
  const [hours, setHours] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchApiEnvelope<{ draftTtlHours: number }>("/api/admin/settings/draft-ttl");
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error.message);
      } else {
        setHours(String(res.data.draftTtlHours));
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const n = Number.parseInt(hours, 10);
    const res = await fetchApiEnvelope<{ draftTtlHours: number }>("/api/admin/settings/draft-ttl", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftTtlHours: n }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setHours(String(res.data.draftTtlHours));
    setMessage("Saved. New drafts pick up this window.");
  }

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading…
      </p>
    );
  }

  return (
    <form onSubmit={onSave} className="border-border max-w-md space-y-4 border border-l-4 border-l-primary bg-card p-5">
      {error ? (
        <p className="text-destructive text-sm leading-relaxed border-l-4 border-destructive/40 pl-3">{error}</p>
      ) : null}
      {message ? (
        <p className="text-success text-sm border-l-4 border-success/40 bg-success/10 pl-3 py-1">{message}</p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="ttl">Draft TTL (hours)</Label>
        <Input
          id="ttl"
          inputMode="numeric"
          required
          min={1}
          max={8760}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="rounded-none font-mono"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Fixed window for unpaid drafts; guest resume cookie Max-Age follows the same value.
        </p>
      </div>
      <Button type="submit" disabled={saving} className="rounded-none font-semibold">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
}

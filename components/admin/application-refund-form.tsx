"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiHref } from "@/lib/app-href";

const REFUND_REASONS = [
  { value: "fraud", label: "Fraud" },
  { value: "accidental", label: "Accidental charge" },
  { value: "customer_request", label: "Customer request" },
] as const;

export function ApplicationRefundForm({ applicationId }: { applicationId: string }) {
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/refund`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Refund failed.");
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-none p-3 text-sm text-success font-medium">
        ✓ Refund initiated successfully. Status will update via webhook.
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 border border-border p-4 bg-muted/30">
      <p className="text-sm font-semibold">Initiate Refund</p>
      <div>
        <label htmlFor="refund-reason" className="text-xs font-medium text-muted-foreground block mb-1">
          Reason
        </label>
        <select
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading}
          className="w-full border border-border bg-card text-foreground rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select a reason…</option>
          {REFUND_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-destructive text-xs border-l-2 border-destructive pl-2">{error}</p>
      )}
      <Button
        type="submit"
        size="sm"
        className="rounded-none w-full"
        disabled={!reason || loading}
        variant="secondary"
      >
        {loading ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}
        {loading ? "Processing…" : "Initiate Refund"}
      </Button>
    </form>
  );
}

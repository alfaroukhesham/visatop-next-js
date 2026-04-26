"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Webhook, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

type PaymentsSettingsState = {
  activeProvider: "paddle" | "ziina";
  appOrigin: string;
  canRegisterZiinaWebhook: boolean;
  derivedZiinaWebhookUrl: string;
  ziina: { configured: boolean; missing: string[]; apiBaseUrl: string; testMode: boolean };
  paddle: { configured: boolean; missing: string[] };
  webhookHealth: { lastZiina: string | null; lastPaddle: string | null };
};

export function PaymentsSettings() {
  const [state, setState] = useState<PaymentsSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testRedirectUrl, setTestRedirectUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetchApiEnvelope<PaymentsSettingsState>("/api/admin/settings/payments");
    if (!res.ok) {
      setError(res.error.message);
      setState(null);
    } else {
      setState(res.data);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function callWebhook(method: "POST" | "DELETE") {
    setWorking(true);
    setMessage(null);
    setError(null);
    const res = await fetchApiEnvelope<{ success: boolean; error?: string | null; url?: string }>(
      "/api/admin/settings/payments/ziina/webhook",
      { method },
    );
    setWorking(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setMessage(
      res.data.success
        ? method === "POST"
          ? "Ziina webhook registered/updated."
          : "Ziina webhook deleted."
        : `Ziina responded with success=false${res.data.error ? ` (${res.data.error})` : ""}`,
    );
    await load();
  }

  async function createTestIntent() {
    setWorking(true);
    setMessage(null);
    setError(null);
    setTestRedirectUrl(null);
    const res = await fetchApiEnvelope<{ redirectUrl: string; paymentIntentId: string }>(
      "/api/admin/settings/payments/ziina/test-intent",
      { method: "POST" },
    );
    setWorking(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setTestRedirectUrl(res.data.redirectUrl);
    setMessage(
      "Test intent created. Complete it in Ziina, then refresh: the Ziina webhook timestamp should update. (This test intent is not tied to an application payment row.)",
    );
  }

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading…
      </p>
    );
  }

  if (error || !state) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm border-l-4 border-destructive/40 pl-3">
          {error ?? "Failed to load payments settings."}
        </p>
        <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" aria-hidden />
          Retry
        </Button>
      </div>
    );
  }

  const missingAny = state.ziina.missing.length > 0 || state.paddle.missing.length > 0;

  return (
    <div className="space-y-4">
      {missingAny ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive border-l-4 px-3 py-2 text-sm">
          Missing env vars:{" "}
          <span className="font-mono text-xs">
            {[...state.ziina.missing, ...state.paddle.missing].join(", ") || "—"}
          </span>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm border-l-4 border-destructive/40 pl-3">{error}</p>
      ) : null}
      {message ? (
        <p className="text-success text-sm border-l-4 border-success/40 bg-success/10 pl-3 py-1">{message}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-border space-y-2 border p-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Active provider</p>
          <p className="font-heading text-base font-semibold">{state.activeProvider}</p>
          <p className="text-muted-foreground text-xs">App origin: <span className="font-mono">{state.appOrigin}</span></p>
        </div>
        <div className="border-border space-y-2 border p-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Webhook health</p>
          <p className="text-sm">
            Ziina: <span className="font-mono text-xs">{state.webhookHealth.lastZiina ?? "—"}</span>
          </p>
          <p className="text-sm">
            Paddle: <span className="font-mono text-xs">{state.webhookHealth.lastPaddle ?? "—"}</span>
          </p>
        </div>
      </div>

      <div className="border-border space-y-3 border border-l-4 border-l-primary bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center border border-primary/20">
            <Webhook className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h3 className="font-heading text-base font-semibold tracking-tight">Ziina webhook setup</h3>
            <p className="text-muted-foreground text-sm">
              URL: <span className="font-mono text-xs">{state.derivedZiinaWebhookUrl}</span>
            </p>
            {!state.canRegisterZiinaWebhook ? (
              <p className="text-destructive text-xs">
                Origin must be https (use ngrok/cloudflared) to register the webhook.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-none font-semibold"
            disabled={working || !state.canRegisterZiinaWebhook || !state.ziina.configured}
            onClick={() => void callWebhook("POST")}
          >
            {working ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
            Register / Update webhook
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={working || !state.ziina.configured}
            onClick={() => void callWebhook("DELETE")}
          >
            Delete webhook
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={working || !state.canRegisterZiinaWebhook || !state.ziina.configured}
            onClick={() => void createTestIntent()}
          >
            Create test payment
          </Button>
          <Button type="button" variant="ghost" className="rounded-none" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" aria-hidden />
            Refresh
          </Button>
        </div>

        {testRedirectUrl ? (
          <a
            href={testRedirectUrl}
            target="_blank"
            rel="noreferrer"
            className="text-link inline-flex items-center gap-1 text-sm font-medium"
          >
            Open Ziina test checkout <ExternalLink className="size-4" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}


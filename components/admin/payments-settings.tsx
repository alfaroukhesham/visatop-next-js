"use client";

import { useEffect, useReducer } from "react";
import { AdminFormLoadingSkeleton } from "@/components/admin/admin-loading";
import { ExternalLink, Loader2, RefreshCw, Webhook, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type PaymentsSettingsState = {
  activeProvider: "paddle" | "ziina";
  appOrigin: string;
  canRegisterZiinaWebhook: boolean;
  derivedZiinaWebhookUrl: string;
  ziina: { configured: boolean; missing: string[]; apiBaseUrl: string; testMode: boolean };
  paddle: { configured: boolean; missing: string[] };
  webhookHealth: { lastZiina: string | null; lastPaddle: string | null };
};

type UiState = {
  settings: PaymentsSettingsState | null;
  loading: boolean;
  working: boolean;
  message: string | null;
  error: string | null;
  testRedirectUrl: string | null;
};

type UiAction =
  | { type: "load-start" }
  | { type: "load-success"; settings: PaymentsSettingsState }
  | { type: "load-error"; error: string }
  | { type: "work-start" }
  | { type: "work-end" }
  | { type: "set-message"; message: string | null }
  | { type: "set-error"; error: string | null }
  | { type: "set-test-url"; url: string | null };

const initialUiState: UiState = {
  settings: null,
  loading: true,
  working: false,
  message: null,
  error: null,
  testRedirectUrl: null,
};

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "load-start":
      return { ...state, loading: true };
    case "load-success":
      return { ...state, loading: false, settings: action.settings, error: null };
    case "load-error":
      return { ...state, loading: false, settings: null, error: action.error };
    case "work-start":
      return { ...state, working: true, message: null, error: null };
    case "work-end":
      return { ...state, working: false };
    case "set-message":
      return { ...state, message: action.message };
    case "set-error":
      return { ...state, error: action.error };
    case "set-test-url":
      return { ...state, testRedirectUrl: action.url };
    default:
      return state;
  }
}

export function PaymentsSettings() {
  const [state, dispatch] = useReducer(uiReducer, initialUiState);

  async function load() {
    dispatch({ type: "load-start" });
    const res = await fetchApiEnvelope<PaymentsSettingsState>(apiHref("/admin/settings/payments"));
    if (!res.ok) {
      dispatch({ type: "load-error", error: res.error.message });
      return;
    }
    dispatch({ type: "load-success", settings: res.data });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function callWebhook(method: "POST" | "DELETE") {
    dispatch({ type: "work-start" });
    const res = await fetchApiEnvelope<{ success: boolean; error?: string | null; url?: string }>(
      apiHref("/admin/settings/payments/ziina/webhook"),
      { method },
    );
    dispatch({ type: "work-end" });
    if (!res.ok) {
      dispatch({ type: "set-error", error: res.error.message });
      return;
    }
    dispatch({
      type: "set-message",
      message: res.data.success
        ? method === "POST"
          ? "Ziina webhook registered/updated."
          : "Ziina webhook deleted."
        : `Ziina responded with success=false${res.data.error ? ` (${res.data.error})` : ""}`,
    });
    await load();
  }

  async function createTestIntent() {
    dispatch({ type: "work-start" });
    dispatch({ type: "set-test-url", url: null });
    const res = await fetchApiEnvelope<{ redirectUrl: string; paymentIntentId: string }>(
      apiHref("/admin/settings/payments/ziina/test-intent"),
      { method: "POST" },
    );
    dispatch({ type: "work-end" });
    if (!res.ok) {
      dispatch({ type: "set-error", error: res.error.message });
      return;
    }
    dispatch({ type: "set-test-url", url: res.data.redirectUrl });
    dispatch({
      type: "set-message",
      message:
        "Test intent created. Complete it in Ziina, then refresh: the Ziina webhook timestamp should update. (This test intent is not tied to an application payment row.)",
    });
  }

  if (state.loading) {
    return <AdminFormLoadingSkeleton fields={3} />;
  }

  if (state.error || !state.settings) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm border-b-2 border-destructive/40 pl-3">
          {state.error ?? "Failed to load payments settings."}
        </p>
        <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" aria-hidden />
          Retry
        </Button>
      </div>
    );
  }

  const missingAny =
    state.settings.ziina.missing.length > 0 || state.settings.paddle.missing.length > 0;

  return (
    <div className="space-y-4">
      {missingAny ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive border-b-2 px-3 py-2 text-sm">
          Missing env vars:{" "}
          <span className="font-mono text-xs">
            {[...state.settings.ziina.missing, ...state.settings.paddle.missing].join(", ") || "—"}
          </span>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-destructive text-sm border-b-2 border-destructive/40 pl-3">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-success text-sm border-b-2 border-success/40 bg-success/10 pl-3 py-1">{state.message}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-border space-y-2 border p-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Active provider</p>
          <p className="font-heading text-base font-semibold">{state.settings.activeProvider}</p>
          <p className="text-muted-foreground text-xs">
            App origin: <span className="font-mono">{state.settings.appOrigin}</span>
          </p>
        </div>
        <div className="border-border space-y-2 border p-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Webhook health</p>
          <p className="text-sm">
            Ziina: <span className="font-mono text-xs">{state.settings.webhookHealth.lastZiina ?? "—"}</span>
          </p>
          <p className="text-sm">
            Paddle: <span className="font-mono text-xs">{state.settings.webhookHealth.lastPaddle ?? "—"}</span>
          </p>
        </div>
      </div>

      <div className="border-border space-y-3 border border-b-2 border-b-primary bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center border border-primary/20">
            <Webhook className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h3 className="font-heading text-base font-semibold tracking-tight">Ziina webhook setup</h3>
            <p className="text-muted-foreground text-sm">
              URL: <span className="font-mono text-xs">{state.settings.derivedZiinaWebhookUrl}</span>
            </p>
            {!state.settings.canRegisterZiinaWebhook ? (
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
            disabled={state.working || !state.settings.canRegisterZiinaWebhook || !state.settings.ziina.configured}
            onClick={() => void callWebhook("POST")}
          >
            {state.working ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
            Register / Update webhook
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={state.working || !state.settings.ziina.configured}
            onClick={() => void callWebhook("DELETE")}
          >
            Delete webhook
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={state.working || !state.settings.canRegisterZiinaWebhook || !state.settings.ziina.configured}
            onClick={() => void createTestIntent()}
          >
            Create test payment
          </Button>
          <Button type="button" variant="ghost" className="rounded-none" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" aria-hidden />
            Refresh
          </Button>
        </div>

        {state.testRedirectUrl ? (
          <a
            href={state.testRedirectUrl}
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

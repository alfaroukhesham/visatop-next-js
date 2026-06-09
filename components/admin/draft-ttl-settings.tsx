"use client";

import { useEffect, useReducer } from "react";
import { AdminFormLoadingSkeleton } from "@/components/admin/admin-loading";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type DraftTtlState = {
  hours: string;
  loading: boolean;
  saving: boolean;
  message: string | null;
  error: string | null;
};

type DraftTtlAction =
  | { type: "load-start" }
  | { type: "load-success"; hours: string }
  | { type: "load-error"; error: string }
  | { type: "save-start" }
  | { type: "save-success"; hours: string; message: string }
  | { type: "save-error"; error: string }
  | { type: "set-hours"; hours: string };

const initialDraftTtlState: DraftTtlState = {
  hours: "",
  loading: true,
  saving: false,
  message: null,
  error: null,
};

function draftTtlReducer(state: DraftTtlState, action: DraftTtlAction): DraftTtlState {
  switch (action.type) {
    case "load-start":
      return { ...state, loading: true };
    case "load-success":
      return { ...state, loading: false, hours: action.hours, error: null };
    case "load-error":
      return { ...state, loading: false, error: action.error };
    case "save-start":
      return { ...state, saving: true, message: null, error: null };
    case "save-success":
      return {
        ...state,
        saving: false,
        hours: action.hours,
        message: action.message,
        error: null,
      };
    case "save-error":
      return { ...state, saving: false, error: action.error };
    case "set-hours":
      return { ...state, hours: action.hours };
    default:
      return state;
  }
}

export function DraftTtlSettings() {
  const [state, dispatch] = useReducer(draftTtlReducer, initialDraftTtlState);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "load-start" });
    void (async () => {
      const res = await fetchApiEnvelope<{ draftTtlHours: number }>(
        apiHref("/admin/settings/draft-ttl"),
      );
      if (cancelled) return;
      if (!res.ok) {
        dispatch({ type: "load-error", error: res.error.message });
      } else {
        dispatch({ type: "load-success", hours: String(res.data.draftTtlHours) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "save-start" });
    const n = Number.parseInt(state.hours, 10);
    const res = await fetchApiEnvelope<{ draftTtlHours: number }>(apiHref("/admin/settings/draft-ttl"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftTtlHours: n }),
    });
    if (!res.ok) {
      dispatch({ type: "save-error", error: res.error.message });
      return;
    }
    dispatch({
      type: "save-success",
      hours: String(res.data.draftTtlHours),
      message: "Saved. New drafts pick up this window.",
    });
  }

  if (state.loading) {
    return <AdminFormLoadingSkeleton fields={1} />;
  }

  return (
    <form onSubmit={onSave} className="border-border max-w-md space-y-4 border border-b-2 border-b-primary bg-card p-5">
      {state.error ? (
        <p className="text-destructive text-sm leading-relaxed border-b-2 border-destructive/40 pl-3">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-success text-sm border-b-2 border-success/40 bg-success/10 pl-3 py-1">{state.message}</p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="ttl">Draft TTL (hours)</Label>
        <Input
          id="ttl"
          inputMode="numeric"
          required
          min={1}
          max={8760}
          value={state.hours}
          onChange={(e) => dispatch({ type: "set-hours", hours: e.target.value })}
          className="rounded-none font-mono"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Fixed window for unpaid drafts; guest resume cookie Max-Age follows the same value.
        </p>
      </div>
      <Button type="submit" disabled={state.saving} className="rounded-none font-semibold">
        {state.saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
}

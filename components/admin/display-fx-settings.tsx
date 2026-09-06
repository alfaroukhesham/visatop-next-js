"use client";

import { useEffect, useReducer, type FC, type FormEvent } from "react";
import { AdminFormLoadingSkeleton } from "@/components/admin/admin-loading";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { TFxRateSource } from "@/lib/pricing/fx-usd-aed";

type TDisplayFxState = {
  rate: string;
  source: TFxRateSource | null;
  loading: boolean;
  saving: boolean;
  message: string | null;
  error: string | null;
};

type TDisplayFxAction =
  | { type: "load-start" }
  | { type: "load-success"; rate: string; source: TFxRateSource }
  | { type: "load-error"; error: string }
  | { type: "save-start" }
  | { type: "save-success"; rate: string; message: string }
  | { type: "save-error"; error: string }
  | { type: "set-rate"; rate: string };

const initialDisplayFxState: TDisplayFxState = {
  rate: "",
  source: null,
  loading: true,
  saving: false,
  message: null,
  error: null,
};

const displayFxReducer = (state: TDisplayFxState, action: TDisplayFxAction): TDisplayFxState => {
  switch (action.type) {
    case "load-start":
      return { ...state, loading: true };
    case "load-success":
      return {
        ...state,
        loading: false,
        rate: action.rate,
        source: action.source,
        error: null,
      };
    case "load-error":
      return { ...state, loading: false, error: action.error };
    case "save-start":
      return { ...state, saving: true, message: null, error: null };
    case "save-success":
      return {
        ...state,
        saving: false,
        rate: action.rate,
        source: "setting",
        message: action.message,
        error: null,
      };
    case "save-error":
      return { ...state, saving: false, error: action.error };
    case "set-rate":
      return { ...state, rate: action.rate };
    default:
      return state;
  }
};

type TDisplayFxApiData = {
  fxAedPerUsd: string | null;
  source: TFxRateSource;
};

export const DisplayFxSettings: FC = () => {
  const [state, dispatch] = useReducer(displayFxReducer, initialDisplayFxState);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "load-start" });
    void (async () => {
      const res = await fetchApiEnvelope<TDisplayFxApiData>(
        apiHref("/admin/settings/display-fx"),
      );
      if (cancelled) return;
      if (!res.ok) {
        dispatch({ type: "load-error", error: res.error.message });
        return;
      }
      dispatch({
        type: "load-success",
        rate: res.data.fxAedPerUsd ?? "",
        source: res.data.source,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: "save-start" });
    const res = await fetchApiEnvelope<TDisplayFxApiData>(
      apiHref("/admin/settings/display-fx"),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fxAedPerUsd: state.rate }),
      },
    );
    if (!res.ok) {
      dispatch({ type: "save-error", error: res.error.message });
      return;
    }
    dispatch({
      type: "save-success",
      rate: res.data.fxAedPerUsd ?? state.rate,
      message: "Saved. Return to the catalog price screen to apply prices.",
    });
  };

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
      {state.source === "missing" ? (
        <p className="text-destructive text-sm leading-relaxed border-b-2 border-destructive/40 pl-3">
          No display FX rate is configured. Enter a rate and save before applying catalog prices.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="display-fx-rate">AED per 1 USD</Label>
        <Input
          id="display-fx-rate"
          inputMode="decimal"
          required
          min={0}
          step="any"
          value={state.rate}
          onChange={(e) => dispatch({ type: "set-rate", rate: e.target.value })}
          className="rounded-none font-mono"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Used when a price is entered in one currency so the other can be filled in. Save here, then return to the
          catalog price screen.
        </p>
      </div>
      <Button type="submit" disabled={state.saving} className="rounded-none font-semibold">
        {state.saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
      </Button>
    </form>
  );
};

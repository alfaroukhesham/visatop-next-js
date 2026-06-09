"use client";

import { useCallback, useMemo, useReducer } from "react";
import { apiHref } from "@/lib/app-href";
import type { NationalityPricingRow } from "@/components/admin/nationality-price-editor-table";

export type NationalityOption = {
  code: string;
  name: string;
  enabled: boolean;
};

type EditorState = {
  nationalityCode: string;
  currency: "USD" | "AED";
  rows: NationalityPricingRow[];
  drafts: Record<string, string>;
  loading: boolean;
  saving: boolean;
  cleaning: boolean;
  error: string | null;
  success: string | null;
};

type EditorAction =
  | { type: "SET_NATIONALITY"; code: string }
  | { type: "SET_CURRENCY"; currency: "USD" | "AED" }
  | { type: "LOAD_START" }
  | { type: "LOAD_END" }
  | { type: "LOAD_SUCCESS"; rows: NationalityPricingRow[] }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "CLEAR_ROWS" }
  | { type: "SET_DRAFT"; serviceId: string; value: string }
  | { type: "CLEAR_DRAFTS" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_CLEANING"; value: boolean }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_SUCCESS"; message: string | null }
  | { type: "CLEAR_FEEDBACK" };

const initialEditorState: EditorState = {
  nationalityCode: "",
  currency: "USD",
  rows: [],
  drafts: {},
  loading: false,
  saving: false,
  cleaning: false,
  error: null,
  success: null,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_NATIONALITY":
      return { ...state, nationalityCode: action.code };
    case "SET_CURRENCY":
      return { ...state, currency: action.currency };
    case "LOAD_START":
      return { ...state, loading: true, error: null, success: null, drafts: {} };
    case "LOAD_END":
      return { ...state, loading: false };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, rows: action.rows };
    case "LOAD_ERROR":
      return { ...state, loading: false, rows: [], error: action.message };
    case "CLEAR_ROWS":
      return { ...state, rows: [], drafts: {}, error: null, success: null };
    case "SET_DRAFT":
      return { ...state, drafts: { ...state.drafts, [action.serviceId]: action.value } };
    case "CLEAR_DRAFTS":
      return { ...state, drafts: {} };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_CLEANING":
      return { ...state, cleaning: action.value };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "SET_SUCCESS":
      return { ...state, success: action.message };
    case "CLEAR_FEEDBACK":
      return { ...state, error: null, success: null };
    default:
      return state;
  }
}

export function useNationalityPriceEditor(nationalities: NationalityOption[]) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);

  const selectedNat = useMemo(
    () => nationalities.find((n) => n.code === state.nationalityCode),
    [nationalities, state.nationalityCode],
  );

  const loadRows = useCallback(async (code: string) => {
    dispatch({ type: "LOAD_START" });
    try {
      const res = await fetch(apiHref(`/admin/catalog/customer-prices/nationality/${code}`), {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatch({
          type: "LOAD_ERROR",
          message: (data as { error?: { message?: string } })?.error?.message ?? "Failed to load prices.",
        });
        return;
      }
      const services = (data as { data?: { services?: NationalityPricingRow[] } })?.data?.services ?? [];
      dispatch({ type: "LOAD_SUCCESS", rows: services });
    } finally {
      dispatch({ type: "LOAD_END" });
    }
  }, []);

  async function savePrices() {
    if (!state.nationalityCode) return;
    const updates: { serviceId: string; amountMajor: string }[] = [];
    for (const row of state.rows) {
      const amountMajor = (state.drafts[row.serviceId] ?? "").trim();
      if (amountMajor.length > 0) updates.push({ serviceId: row.serviceId, amountMajor });
    }
    if (updates.length === 0) {
      dispatch({ type: "SET_ERROR", message: "Enter at least one new price." });
      return;
    }
    dispatch({ type: "SET_SAVING", value: true });
    dispatch({ type: "CLEAR_FEEDBACK" });
    try {
      const res = await fetch(apiHref(`/admin/catalog/customer-prices/nationality/${state.nationalityCode}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currency: state.currency, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatch({
          type: "SET_ERROR",
          message: (data as { error?: { message?: string } })?.error?.message ?? "Save failed.",
        });
        return;
      }
      const updated = (data as { data?: { updated?: number } })?.data?.updated ?? updates.length;
      dispatch({
        type: "SET_SUCCESS",
        message: `Updated ${updated} service price${updated === 1 ? "" : "s"}. The other currency was filled via FX.`,
      });
      dispatch({ type: "CLEAR_DRAFTS" });
      await loadRows(state.nationalityCode);
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  }

  async function cleanupOrphans() {
    if (
      !window.confirm(
        "Remove duplicate empty services (from repeated imports), eligibility without prices, and other unused catalog rows? This cannot be undone.",
      )
    ) {
      return;
    }
    dispatch({ type: "SET_CLEANING", value: true });
    dispatch({ type: "CLEAR_FEEDBACK" });
    try {
      const res = await fetch(apiHref("/admin/catalog/cleanup-orphans"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatch({
          type: "SET_ERROR",
          message: (data as { error?: { message?: string } })?.error?.message ?? "Cleanup failed.",
        });
        return;
      }
      const summary = data as {
        data?: {
          eligibilityRemoved?: number;
          duplicateServicesRemoved?: number;
          unusedServicesRemoved?: number;
        };
      };
      const r = summary.data;
      const total =
        (r?.eligibilityRemoved ?? 0) +
        (r?.duplicateServicesRemoved ?? 0) +
        (r?.unusedServicesRemoved ?? 0);
      dispatch({
        type: "SET_SUCCESS",
        message:
          total === 0
            ? "No orphan catalog rows found."
            : `Cleanup complete: ${r?.duplicateServicesRemoved ?? 0} duplicate service(s), ${r?.eligibilityRemoved ?? 0} stray eligibility row(s), ${r?.unusedServicesRemoved ?? 0} unused service(s) removed.`,
      });
      if (state.nationalityCode) await loadRows(state.nationalityCode);
    } finally {
      dispatch({ type: "SET_CLEANING", value: false });
    }
  }

  function handleNationalityChange(code: string) {
    dispatch({ type: "SET_NATIONALITY", code });
    if (code) void loadRows(code);
    else dispatch({ type: "CLEAR_ROWS" });
  }

  return {
    state,
    dispatch,
    selectedNat,
    handleNationalityChange,
    savePrices,
    cleanupOrphans,
  };
}

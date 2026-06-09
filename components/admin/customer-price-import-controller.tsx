"use client";

import { useReducer, useRef, useEffect, useMemo, useCallback, type SetStateAction } from "react";
import { apiHref } from "@/lib/app-href";
import { normalizeCountryName } from "@/lib/admin/catalog/parse-price-sheet";
import {
  customerPriceImportReducer,
  initialCustomerPriceImportState,
  type ApplyResult,
  type CustomerPriceImportState,
  type MissingNationalityEntry,
  type PreviewResult,
} from "@/components/admin/customer-price-import-types";

export function useCustomerPriceImportController() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(customerPriceImportReducer, initialCustomerPriceImportState);

  const patch = useCallback((patchState: Partial<CustomerPriceImportState>) => {
    dispatch({ type: "patch", patch: patchState });
  }, []);

  const setPageField = useCallback(
    (key: "previewPendingPage" | "previewErrorsPage" | "previewMissingNatPage" | "previewAutoFixPage") =>
      (action: SetStateAction<number>) => {
        patch({
          [key]: typeof action === "function" ? action(state[key]) : action,
        });
      },
    [patch, state],
  );

  function resetPreviewPages() {
    dispatch({ type: "reset_preview_pages" });
  }

  function handlePreviewListPageSizeChange(size: number) {
    patch({ previewListPageSize: size });
    resetPreviewPages();
  }

  async function loadPendingList(batchId: string, page: number, pageSize: number) {
    patch({ pendingListLoading: true });
    try {
      const offset = page * pageSize;
      const qs = new URLSearchParams({
        batchId,
        limit: String(pageSize),
        offset: String(offset),
      });
      const res = await fetch(
        `${apiHref("admin/catalog/customer-prices/import/pending-currency")}?${qs}`,
      );
      const json = await res.json();
      if (!res.ok) {
        patch({ pendingListRows: [], pendingListTotal: 0 });
        return;
      }
      const data = json.data as { rows: CustomerPriceImportState["pendingListRows"]; total: number };
      const total = typeof data.total === "number" ? data.total : 0;
      if (total > 0 && offset >= total) {
        const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
        if (lastPage !== page) {
          await loadPendingList(batchId, lastPage, pageSize);
          return;
        }
      }
      patch({
        pendingPage: page,
        pendingListRows: Array.isArray(data.rows) ? data.rows : [],
        pendingListTotal: total,
      });
    } catch {
      patch({ pendingListRows: [], pendingListTotal: 0 });
    } finally {
      patch({ pendingListLoading: false });
    }
  }

  useEffect(() => {
    if (state.phase !== "applying") return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      patch({ applyElapsedSec: Math.floor((Date.now() - t0) / 1000) });
    }, 500);
    return () => window.clearInterval(id);
  }, [state.phase, patch]);

  useEffect(() => {
    if (state.phase !== "assigning") return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      patch({ assignElapsedSec: Math.floor((Date.now() - t0) / 1000) });
    }, 500);
    return () => window.clearInterval(id);
  }, [state.phase, patch]);

  const previewSlices = useMemo(() => {
    if (!state.preview) {
      return {
        missing: [] as PreviewResult["missingNationalities"],
        errors: [] as PreviewResult["errors"],
        pending: [] as PreviewResult["pending"],
        autoFix: [] as PreviewResult["autoFixPreview"],
      };
    }
    const ps = state.previewListPageSize;
    const slice = <T,>(arr: T[], page: number) => arr.slice(page * ps, page * ps + ps);
    return {
      missing: slice(state.preview.missingNationalities, state.previewMissingNatPage),
      errors: slice(state.preview.errors, state.previewErrorsPage),
      pending: slice(state.preview.pending, state.previewPendingPage),
      autoFix: slice(state.preview.autoFixPreview, state.previewAutoFixPage),
    };
  }, [
    state.preview,
    state.previewListPageSize,
    state.previewMissingNatPage,
    state.previewErrorsPage,
    state.previewPendingPage,
    state.previewAutoFixPage,
  ]);

  const hasBlockingErrors = state.preview && state.preview.headerRowIndex === -1;
  const hasErrors = state.preview && state.preview.errors.length > 0;
  const missingNationalities = state.preview?.missingNationalities ?? [];
  const hasMissingNationalities = missingNationalities.length > 0;

  async function handlePreview() {
    if (!state.file) return;
    patch({ error: null, preview: null, applyResult: null, applyMode: "strict", phase: "previewing" });
    try {
      const body = await state.file.arrayBuffer();
      const res = await fetch(apiHref("admin/catalog/customer-prices/import/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        patch({ error: json?.error?.message ?? "Preview failed.", phase: "idle" });
        return;
      }
      const data = json.data as PreviewResult;
      patch({
        preview: { ...data, missingNationalities: data.missingNationalities ?? [] },
        phase: "previewed",
      });
      resetPreviewPages();
    } catch {
      patch({ error: "Network error during preview.", phase: "idle" });
    }
  }

  async function handleApply() {
    if (!state.file) return;
    patch({ error: null, applyElapsedSec: 0, phase: "applying" });
    try {
      const body = await state.file.arrayBuffer();
      const res = await fetch(apiHref("admin/catalog/customer-prices/import/apply"), {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Import-Mode": state.applyMode,
        },
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        const details = json?.error?.details as { missingNationalities?: MissingNationalityEntry[] } | undefined;
        const message = details?.missingNationalities?.length
          ? `${json?.error?.message ?? "Apply blocked."} Open “Create nationalities” below to add ${details.missingNationalities.length} missing entr${details.missingNationalities.length === 1 ? "y" : "ies"}.`
          : (json?.error?.message ?? "Apply failed.");
        patch({ error: message, phase: "previewed" });
        return;
      }
      const result = json.data as ApplyResult;
      patch({ applyResult: result, pendingPageSize: state.previewListPageSize, phase: "applied" });
      if (result.batchId && (result.pendingCreated ?? 0) > 0) {
        void loadPendingList(result.batchId, 0, state.previewListPageSize);
      } else {
        patch({ pendingPage: 0, pendingListRows: [], pendingListTotal: 0 });
      }
    } catch {
      patch({ error: "Network error during apply.", phase: "previewed" });
    }
  }

  async function handleAssignPendingCurrency() {
    if (!state.applyResult?.batchId) return;
    patch({ error: null, assignElapsedSec: 0, phase: "assigning" });
    try {
      const res = await fetch(apiHref("admin/catalog/customer-prices/import/pending-currency"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: state.pendingCurrency, batchId: state.applyResult.batchId }),
      });
      const json = await res.json();
      if (!res.ok) {
        patch({ error: json?.error?.message ?? "Currency assignment failed.", phase: "applied" });
        return;
      }
      patch({
        applyResult: state.applyResult
          ? {
              ...state.applyResult,
              pendingCreated: Math.max(0, state.applyResult.pendingCreated - (json.data?.promoted ?? 0)),
              eligibilityAdded: state.applyResult.eligibilityAdded + (json.data?.eligibilityAdded ?? 0),
            }
          : state.applyResult,
        phase: "applied",
      });
    } catch {
      patch({ error: "Network error assigning currency.", phase: "applied" });
    }
  }

  function reset() {
    dispatch({ type: "reset" });
    if (fileRef.current) fileRef.current.value = "";
  }

  function openBulkNationalityModal() {
    if (!state.preview?.missingNationalities?.length) return;
    patch({
      natDrafts: state.preview.missingNationalities.map((m) => ({
        normKey: m.normKey,
        exampleRowIdx: m.exampleRowIdx,
        code: m.suggestedAlpha2 ?? "",
        name: m.exampleRaw,
        suggestedAlpha2: m.suggestedAlpha2 ?? null,
      })),
      bulkLocalError: null,
      bulkModalOpen: true,
    });
  }

  async function handleBulkCreateNationalities() {
    patch({ bulkLocalError: null });
    const codeRe = /^[A-Za-z]{2}$/;
    const seenCodes = new Set<string>();
    const seenNormNames = new Map<string, string>();
    for (const d of state.natDrafts) {
      const code = d.code.trim().toUpperCase();
      const name = d.name.trim();
      if (!codeRe.test(code)) {
        patch({ bulkLocalError: `Row “${name}”: ISO code must be exactly two letters (e.g. AE).` });
        return;
      }
      if (!name) {
        patch({ bulkLocalError: "Every nationality needs a display name." });
        return;
      }
      if (seenCodes.has(code)) {
        patch({ bulkLocalError: `Duplicate ISO code in this list: ${code}.` });
        return;
      }
      seenCodes.add(code);
      const nk = normalizeCountryName(name);
      const prev = seenNormNames.get(nk);
      if (prev !== undefined && prev !== code) {
        patch({ bulkLocalError: `Duplicate display name after normalisation: “${name}”.` });
        return;
      }
      seenNormNames.set(nk, code);
    }

    patch({ bulkSaving: true });
    try {
      const res = await fetch(apiHref("admin/catalog/nationalities/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.natDrafts.map((d) => ({
            code: d.code.trim().toUpperCase(),
            name: d.name.trim(),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        patch({ bulkLocalError: json?.error?.message ?? "Bulk create failed.", bulkSaving: false });
        return;
      }
      patch({ bulkModalOpen: false, natDrafts: [], bulkSaving: false });
      if (state.file) {
        patch({ error: null, applyResult: null, phase: "previewing" });
        try {
          const body = await state.file.arrayBuffer();
          const previewRes = await fetch(apiHref("admin/catalog/customer-prices/import/preview"), {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body,
          });
          const previewJson = await previewRes.json();
          if (!previewRes.ok) {
            patch({ error: previewJson?.error?.message ?? "Preview failed after creating nationalities.", phase: "idle" });
            return;
          }
          const data = previewJson.data as PreviewResult;
          patch({
            preview: { ...data, missingNationalities: data.missingNationalities ?? [] },
            phase: "previewed",
          });
        } catch {
          patch({ error: "Network error re-running preview.", phase: "idle" });
        }
      }
    } catch {
      patch({ bulkLocalError: "Network error during bulk create.", bulkSaving: false });
    }
  }

  return {
    fileRef,
    state,
    patch,
    setPageField,
    previewSlices,
    hasBlockingErrors,
    hasErrors,
    missingNationalities,
    hasMissingNationalities,
    handlePreviewListPageSizeChange,
    loadPendingList,
    handlePreview,
    handleApply,
    handleAssignPendingCurrency,
    reset,
    openBulkNationalityModal,
    handleBulkCreateNationalities,
  };
}

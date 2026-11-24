"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import {
  didSwitchBackToStandard,
  extraPriceSignature,
  extrasSectionVisible,
  formatMinorAmount,
  formatArrivalDate,
  optimisticPreview,
  outcomeFromTripSave,
  quoteUsesCodeFormat,
  reasonFromErrorDetails,
  type TClientQuotePreview,
  type TTripPatchBody,
} from "@/lib/apply/checkout-extras-ui";

interface ICheckoutQuoteContext {
  preview: TClientQuotePreview | null;
  loading: boolean;
  updating: boolean;
  loadError: string | null;
  updateError: string | null;
  locked: boolean;
  switchedBack: boolean;
  announceNote: boolean;
  announcement: string | null;
  priceChanged: boolean;
  termsResetKey: number;
  payBlocked: boolean;
  payDescribedBy: string | null;
  paying: boolean;
  setPaying: (paying: boolean) => void;
  patchTrip: (patch: TTripPatchBody) => Promise<boolean>;
  retry: () => void;
  refreshQuote: () => void;
  setDateBlocksPay: (blocked: boolean) => void;
  registerCancelCheckout: (cancel: (() => Promise<boolean> | boolean) | null) => void;
  cancelCheckout: () => void;
}

const CheckoutQuoteContext = createContext<ICheckoutQuoteContext | null>(null);

export const useCheckoutQuoteOptional = (): ICheckoutQuoteContext | null =>
  useContext(CheckoutQuoteContext);

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

interface ICheckoutQuoteProviderProps {
  applicationId: string;
  children: ReactNode;
}

export const CheckoutQuoteProvider: FC<ICheckoutQuoteProviderProps> = ({
  applicationId,
  children,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const [preview, setPreview] = useState<TClientQuotePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [lockedOverride, setLockedOverride] = useState(false);
  const [switchedBack, setSwitchedBack] = useState(false);
  const [announceNote, setAnnounceNote] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [priceChanged, setPriceChanged] = useState(false);
  const [termsResetKey, setTermsResetKey] = useState(0);
  const [dateBlocksPay, setDateBlocksPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const previewRef = useRef<TClientQuotePreview | null>(null);
  const lastSavedRef = useRef<TClientQuotePreview | null>(null);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastPatch = useRef<TTripPatchBody | null>(null);
  const initialPrices = useRef<string | null>(null);
  const cancelRef = useRef<(() => Promise<boolean> | boolean) | null>(null);

  const rememberPrices = useCallback((next: TClientQuotePreview) => {
    const signature = extraPriceSignature(next);
    if (initialPrices.current === null) {
      initialPrices.current = signature;
      return;
    }
    if (initialPrices.current !== signature) {
      initialPrices.current = signature;
      setPriceChanged(true);
      setTermsResetKey((key) => key + 1);
    }
  }, []);

  const applyPreview = useCallback(
    (next: TClientQuotePreview, announce: boolean) => {
      lastSavedRef.current = next;
      previewRef.current = next;
      setPreview(next);
      setLockedOverride(false);
      rememberPrices(next);
      if (!announce) return;
      const display = quoteUsesCodeFormat(next) ? "code" : "symbol";
      setAnnouncement(
        t("extras.recap.updated", {
          total: formatMinorAmount(next.totalAmountMinor, next.currency, locale, display),
        }),
      );
    },
    [locale, rememberPrices, t],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const res = await fetchApiEnvelope<TClientQuotePreview>(
        apiHref(`/applications/${encodeURIComponent(applicationId)}/quote-preview`),
        { cache: "no-store" },
      );
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.error.message);
        setLoading(false);
        return;
      }
      setLoadError(null);
      applyPreview(res.data, false);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applicationId, applyPreview]);

  const patchTrip = useCallback(
    (patch: TTripPatchBody): Promise<boolean> => {
      const current = previewRef.current;
      if (!current) return Promise.resolve(false);
      lastPatch.current = patch;
      const request = ++seq.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const previous = lastSavedRef.current;
      const optimistic = optimisticPreview(current, patch);
      previewRef.current = optimistic;
      setPreview(optimistic);
      setUpdating(true);
      setUpdateError(null);
      if (patch.processingSpeed) setSwitchedBack(false);

      const restoreSaved = () => {
        if (!previous) return;
        previewRef.current = previous;
        setPreview(previous);
      };

      return new Promise((resolve) => {
        const run = async () => {
          try {
            const res = await fetchApiEnvelope<TClientQuotePreview>(
              apiHref(`/applications/${encodeURIComponent(applicationId)}/trip`),
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
                signal: controller.signal,
              },
            );
            if (request !== seq.current) {
              resolve(false);
              return;
            }
            const outcome = outcomeFromTripSave({
              aborted: false,
              ok: res.ok,
              status: res.status,
              code: res.ok ? undefined : res.error.code,
              reason: res.ok ? undefined : reasonFromErrorDetails(res.error.details),
              preview: res.ok ? res.data : undefined,
            });
            if (outcome.kind === "saved") {
              if (patch.travelDate !== undefined && previous && didSwitchBackToStandard(previous, outcome.preview)) {
                setSwitchedBack(true);
              }
              if (patch.travelDate !== undefined) setAnnounceNote(true);
              applyPreview(outcome.preview, true);
              resolve(true);
            } else if (outcome.kind === "locked") {
              restoreSaved();
              setLockedOverride(true);
              resolve(false);
            } else if (outcome.kind === "failed") {
              restoreSaved();
              const maxDate = previous?.maxTravelDate;
              setUpdateError(
                outcome.messageKey === "start.travelDate.errorMax" && maxDate
                  ? t(outcome.messageKey, { maxDate: formatArrivalDate(maxDate, locale) })
                  : t(outcome.messageKey),
              );
              resolve(false);
            } else {
              resolve(false);
            }
          } catch (error) {
            if (request !== seq.current || isAbortError(error)) {
              resolve(false);
              return;
            }
            restoreSaved();
            setUpdateError(t("extras.error.update"));
            resolve(false);
          } finally {
            if (request === seq.current) setUpdating(false);
          }
        };
        void run();
      });
    },
    [applicationId, applyPreview, locale, t],
  );

  const retry = useCallback(() => {
    if (lastPatch.current) void patchTrip(lastPatch.current);
  }, [patchTrip]);

  const registerCancelCheckout = useCallback((cancel: (() => Promise<boolean> | boolean) | null) => {
    cancelRef.current = cancel;
  }, []);

  const refreshQuote = useCallback(() => {
    const request = ++seq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setUpdating(false);
    void (async () => {
      try {
        const res = await fetchApiEnvelope<TClientQuotePreview>(
          apiHref(`/applications/${encodeURIComponent(applicationId)}/quote-preview`),
          { cache: "no-store", signal: controller.signal },
        );
        if (request !== seq.current || !res.ok) return;
        setLoadError(null);
        applyPreview(res.data, false);
      } catch (error) {
        if (request !== seq.current || isAbortError(error)) return;
      }
    })();
  }, [applicationId, applyPreview]);

  const cancelCheckout = useCallback(() => {
    const cancel = cancelRef.current;
    if (!cancel) {
      setPaying(false);
      return;
    }
    void (async () => {
      const ok = await cancel();
      if (ok) setPaying(false);
    })();
  }, []);

  const locked = Boolean(preview?.locked) || lockedOverride;
  const sectionVisible = preview ? extrasSectionVisible(preview) : false;
  const payBlocked = updating || (sectionVisible && dateBlocksPay);
  const payDescribedBy = updating
    ? "extras-recap-updating"
    : sectionVisible && dateBlocksPay
      ? "trip-arrival-date-error"
      : null;

  const value = useMemo<ICheckoutQuoteContext>(
    () => ({
      preview,
      loading,
      updating,
      loadError,
      updateError,
      locked,
      switchedBack,
      announceNote,
      announcement,
      priceChanged,
      termsResetKey,
      payBlocked,
      payDescribedBy,
      paying,
      setPaying,
      patchTrip,
      retry,
      refreshQuote,
      setDateBlocksPay,
      registerCancelCheckout,
      cancelCheckout,
    }),
    [
      preview,
      loading,
      updating,
      loadError,
      updateError,
      locked,
      switchedBack,
      announceNote,
      announcement,
      priceChanged,
      termsResetKey,
      payBlocked,
      payDescribedBy,
      paying,
      patchTrip,
      retry,
      refreshQuote,
      registerCancelCheckout,
      cancelCheckout,
    ],
  );

  return <CheckoutQuoteContext.Provider value={value}>{children}</CheckoutQuoteContext.Provider>;
};

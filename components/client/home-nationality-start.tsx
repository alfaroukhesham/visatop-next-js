"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { ClientComboboxSkeleton } from "@/components/client/client-loading";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { NationalityCombobox } from "@/components/client/nationality-combobox";
import {
  clearLeftPageMarker,
  reloadHomeCatalogIfReturning,
  setHomeCatalogReload,
} from "@/lib/client/home-catalog-reload-bridge";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { trackEventOnce } from "@/lib/analytics/gtag-client";
import {
  COMPACT_VIEWPORT_MEDIA_QUERY,
  useNarrowViewport,
} from "@/lib/client/use-narrow-viewport";

type Nationality = { code: string; name: string };

declare global {
  interface Window {
    __visatopReloadHomeCatalog?: () => void;
  }
}

/**
 * Home hero: searchable nationality → `/apply/start` with nationality query set.
 */
export const HomeNationalityStart: FC = () => {
  const t = useCustomerT();
  const router = useRouter();
  const narrowViewport = useNarrowViewport();
  const compactViewport = useNarrowViewport(COMPACT_VIEWPORT_MEDIA_QUERY);
  const nationalityPlaceholder = t(
    compactViewport
      ? "home.nationalityPlaceholderCompact"
      : narrowViewport
        ? "home.nationalityPlaceholderNarrow"
        : "home.nationalityPlaceholder",
  );
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [catalogReloadEpoch, setCatalogReloadEpoch] = useState(0);
  const nationalitiesRef = useRef(nationalities);
  const loadingRef = useRef(loading);

  nationalitiesRef.current = nationalities;
  loadingRef.current = loading;

  const loadNationalities = useCallback(async () => {
    clearLeftPageMarker();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApiEnvelope<{ nationalities: Nationality[] }>(
        apiHref("/catalog/nationalities"),
      );
      if (!res.ok) {
        setError(res.error.message);
        setNationalities([]);
        return;
      }
      setNationalities(res.data.nationalities);
    } finally {
      setLoading(false);
    }
  }, [catalogReloadEpoch]);

  const reloadNationalities = useCallback(() => {
    const hasCatalog = nationalitiesRef.current.length > 0 && !loadingRef.current;
    const domReady =
      typeof document !== "undefined" &&
      Boolean(document.querySelector("#home-nationality-input"));
    if (hasCatalog && domReady) {
      clearLeftPageMarker();
      return;
    }
    setCatalogReloadEpoch((n) => n + 1);
  }, []);

  useOnBfcacheRestore(reloadNationalities);

  useLayoutEffect(() => {
    window.__visatopReloadHomeCatalog = reloadNationalities;
    setHomeCatalogReload(reloadNationalities);
    reloadHomeCatalogIfReturning();
    return () => {
      delete window.__visatopReloadHomeCatalog;
      setHomeCatalogReload(null);
    };
  }, [reloadNationalities]);

  useEffect(() => {
    void loadNationalities();
  }, [loadNationalities]);

  const onContinue = () => {
    if (!selectedCode || selectedCode.length !== 2) return;
    router.push(`/apply/start?nationality=${encodeURIComponent(selectedCode)}`);
  };

  const onNationalityFirstInteraction = useCallback(() => {
    trackEventOnce(
      APPLY_FUNNEL_EVENTS.applicationStarted,
      { step: 1, step_name: "nationality" },
      APPLY_FUNNEL_EVENTS.applicationStarted,
    );
  }, []);

  return (
    <div className="mt-10 w-full max-[414px]:mt-4 max-[414px]:min-w-0 max-[414px]:max-w-full">
      <div className="border-secondary/35 bg-card relative z-20 overflow-visible rounded-[12px] border-[3px] shadow-[0_20px_56px_rgba(1,32,49,0.14)] max-[414px]:min-w-0 max-[414px]:max-w-full">
        <div className="p-4 sm:p-6 md:p-8 max-[414px]:p-3 max-[240px]:p-2">
          <label htmlFor="home-nationality-input" className="sr-only">
            {t("home.nationalityLabelSrOnly")}
          </label>
          {loading ? (
            <ClientComboboxSkeleton />
          ) : error ? (
            <p className="text-error min-h-[3.5rem] px-2 text-sm leading-relaxed" role="alert">
              {error}
            </p>
          ) : (
            <NationalityCombobox
              id="home-nationality-input"
              nationalities={nationalities}
              valueCode={selectedCode}
              onSelectCode={setSelectedCode}
              onFirstInteraction={onNationalityFirstInteraction}
              placeholder={nationalityPlaceholder}
              size="hero"
              className="max-[414px]:min-w-0 max-[414px]:max-w-full"
            />
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-4 max-w-prose text-sm leading-relaxed max-[414px]:mt-3">
        {t("home.nationalityHelper")}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center max-[414px]:mt-4 max-[414px]:min-w-0 max-[414px]:max-w-full">
        <ClientButton
          type="button"
          brand="cta"
          variant="outline"
          disabled={!selectedCode || selectedCode.length !== 2}
          onClick={onContinue}
          className="min-w-[148px] justify-center border-secondary/40 text-secondary hover:bg-secondary/10 disabled:pointer-events-none disabled:opacity-50 max-[414px]:min-w-0 max-[414px]:w-full max-[414px]:max-w-full max-[414px]:shrink"
        >
          {t("home.nextButton")}
        </ClientButton>
      </div>
    </div>
  );
}

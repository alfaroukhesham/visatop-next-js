"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { NationalityCombobox } from "@/components/client/nationality-combobox";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type Nationality = { code: string; name: string };

/**
 * Home hero: searchable nationality → `/apply/start` with nationality query set.
 */
export function HomeNationalityStart() {
  const router = useRouter();
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        const res = await fetchApiEnvelope<{ nationalities: Nationality[] }>(
          apiHref("/catalog/nationalities"),
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error.message);
          setNationalities([]);
        } else {
          setNationalities(res.data.nationalities);
          setError(null);
        }
        setLoading(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onContinue() {
    if (!selectedCode || selectedCode.length !== 2) return;
    router.push(`/apply/start?nationality=${encodeURIComponent(selectedCode)}`);
  }

  return (
    <div className="mt-10 w-full">
      <div className="border-secondary/35 bg-card overflow-visible rounded-[12px] border-[3px] shadow-[0_20px_56px_rgba(1,32,49,0.14)]">
        <div className="p-4 sm:p-6 md:p-8">
          <label htmlFor="home-nationality-input" className="sr-only">
            Nationality
          </label>
          {loading ? (
            <p className="text-muted-foreground flex min-h-[3.5rem] items-center justify-center gap-2 text-sm">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Loading countries…
            </p>
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
              placeholder="Type your country and select to begin"
              size="hero"
            />
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-4 max-w-prose text-sm leading-relaxed">
        Next you choose your visa and currency. An account is optional.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ClientButton
          type="button"
          brand="cta"
          variant="outline"
          disabled={!selectedCode || selectedCode.length !== 2}
          onClick={onContinue}
          className="min-w-[148px] justify-center border-secondary/40 text-secondary hover:bg-secondary/10 disabled:pointer-events-none disabled:opacity-50"
        >
          Next
        </ClientButton>
      </div>
    </div>
  );
}

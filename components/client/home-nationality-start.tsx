"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ClientField } from "@/components/client/client-field";
import { ClientSelect } from "@/components/client/client-select";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

type Nationality = { code: string; name: string };

/**
 * Home hero: pick nationality → continue on /apply/start with the same draft step as the apply flow.
 */
export function HomeNationalityStart() {
  const router = useRouter();
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        const res = await fetchApiEnvelope<{ nationalities: Nationality[] }>("/api/catalog/nationalities");
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

  function onNationalityChange(code: string) {
    if (!code || code.length !== 2) return;
    router.push(`/apply/start?nationality=${encodeURIComponent(code)}`);
  }

  return (
    <div className="mt-10 max-w-md space-y-3">
      <ClientField id="home-nationality" label="Start with your nationality">
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading options…
          </p>
        ) : error ? (
          <p className="text-error text-sm leading-relaxed" role="alert">
            {error}
          </p>
        ) : (
          <ClientSelect
            id="home-nationality"
            required={false}
            value=""
            onChange={(e) => onNationalityChange(e.target.value)}
            className="w-full"
          >
            <option value="">Choose nationality — opens your draft</option>
            {nationalities.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </ClientSelect>
        )}
      </ClientField>
      <p className="text-muted-foreground text-xs leading-relaxed">
        We take you to visa services for that nationality. No account needed to begin; you can save everything after
        you pay.
      </p>
    </div>
  );
}

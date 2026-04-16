"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

type Nationality = { code: string; name: string };
type Service = {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
  displayPriceMinor: string | null;
  currency: string | null;
};

function formatDisplayMinor(minor: string | null, currency: string | null): string | null {
  if (minor === null || currency === null) return null;
  const n = Number(minor);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
}

export function StartApplicationForm() {
  const router = useRouter();
  const [nationalities, setNationalities] = useState<Nationality[]>([]);
  const [nationality, setNationality] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoadingList(true);
        const res = await fetchApiEnvelope<{ nationalities: Nationality[] }>("/api/catalog/nationalities");
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error.message);
          setNationalities([]);
        } else {
          setNationalities(res.data.nationalities);
          setError(null);
        }
        setLoadingList(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!nationality || nationality.length !== 2) {
        setServices([]);
        setServiceId("");
        return;
      }
      void (async () => {
        setLoadingServices(true);
        const res = await fetchApiEnvelope<{ services: Service[] }>(
          `/api/catalog/services?nationality=${encodeURIComponent(nationality)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error.message);
          setServices([]);
        } else {
          setServices(res.data.services);
          setServiceId("");
          setError(null);
        }
        setLoadingServices(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [nationality]);

  const selectedNat = useMemo(
    () => nationalities.find((n) => n.code === nationality),
    [nationalities, nationality],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nationality || !serviceId) {
      setError("Choose a nationality and a service.");
      return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      nationalityCode: nationality,
      serviceId,
    };
    if (guestEmail.trim()) body.guestEmail = guestEmail.trim();
    const res = await fetchApiEnvelope<{ application: { id: string; isGuest: boolean } }>(
      "/api/applications",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/apply/applications/${res.data.application.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="border-border bg-card max-w-xl space-y-6 border p-5 sm:p-6">
      {error ? (
        <p className="text-destructive border-destructive/30 bg-destructive/5 text-sm leading-relaxed border-l-4 pl-3">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="nat">Nationality</Label>
        {loadingList ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading catalog…
          </p>
        ) : (
          <select
            id="nat"
            required
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            className="border-input bg-background text-foreground focus-visible:ring-ring h-11 w-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <option value="">Select…</option>
            {nationalities.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </select>
        )}
        {selectedNat ? (
          <p className="text-muted-foreground text-xs">Eligibility is enforced again when the draft is created.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="svc">Visa service</Label>
        {!nationality ? (
          <p className="text-muted-foreground text-sm">Select a nationality first.</p>
        ) : loadingServices ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading services…
          </p>
        ) : services.length === 0 ? (
          <p className="text-muted-foreground text-sm">No services for this nationality.</p>
        ) : (
          <select
            id="svc"
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="border-input bg-background text-foreground focus-visible:ring-ring h-11 w-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <option value="">Select…</option>
            {services.map((s) => {
              const price = formatDisplayMinor(s.displayPriceMinor, s.currency);
              return (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {price ? ` — ${price}` : ""}
                </option>
              );
            })}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Guest email (optional)</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          className="rounded-none border-border"
        />
        <p className="text-muted-foreground text-xs">
          If you are not signed in, use the same browser to return — we set an HttpOnly cookie (no token in
          page markup).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={submitting || loadingList} className="rounded-none font-semibold">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create draft"
          )}
        </Button>
        <Link href="/portal" className="text-muted-foreground hover:text-foreground text-sm font-medium">
          Signed in? Portal →
        </Link>
      </div>
    </form>
  );
}

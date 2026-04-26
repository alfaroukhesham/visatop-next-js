"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { ClientNavLink } from "@/components/client/client-nav-link";
import { ClientSelect } from "@/components/client/client-select";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { authClient } from "@/lib/auth-client";

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

type StartApplicationFormProps = {
  /** Prefill when opened from home via `/apply/start?nationality=XX`. */
  initialNationalityCode?: string;
};

export function StartApplicationForm({ initialNationalityCode }: StartApplicationFormProps = {}) {
  const { data: session } = authClient.useSession();
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
          const list = res.data.nationalities;
          setNationalities(list);
          setError(null);
          const upper =
            initialNationalityCode && initialNationalityCode.length === 2
              ? initialNationalityCode.toUpperCase()
              : null;
          if (upper && list.some((n) => n.code === upper)) {
            setNationality(upper);
          }
        }
        setLoadingList(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [initialNationalityCode]);

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
    if (!session?.user) {
      const ge = guestEmail.trim();
      if (!ge) {
        setError("Email is required when you are not signed in.");
        return;
      }
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
    <form onSubmit={onSubmit} className="max-w-xl space-y-6">
      {error ? (
        <p className="text-error border-error/30 bg-error/5 text-sm leading-relaxed border-l-4 pl-3">
          {error}
        </p>
      ) : null}

      <ClientField id="nat" label="Nationality">
        {loadingList ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading catalog…
          </p>
        ) : (
          <ClientSelect
            id="nat"
            required
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          >
            <option value="">Select…</option>
            {nationalities.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name} ({n.code})
              </option>
            ))}
          </ClientSelect>
        )}
        {selectedNat ? (
          <p className="text-muted-foreground text-xs">Eligibility is enforced again when the draft is created.</p>
        ) : null}
      </ClientField>

      <ClientField id="svc" label="Visa service">
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
          <ClientSelect
            id="svc"
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
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
          </ClientSelect>
        )}
      </ClientField>

      <ClientField
        id="email"
        label={session?.user ? "Contact email override (optional)" : "Email (required)"}
        hint={
          session?.user
            ? "Optional. We normally use your account email for notifications."
            : "Required. Use the same browser to return — we set an HttpOnly cookie (no token in page markup)."
        }
      >
        <ClientInput
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          required={!session?.user}
          className="rounded-[5px] border-border"
        />
      </ClientField>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ClientButton
          type="submit"
          brand="cta"
          disabled={submitting || loadingList}
          className="justify-center font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create draft"
          )}
        </ClientButton>
        <ClientNavLink href="/portal" className="text-muted-foreground hover:text-foreground text-sm pb-1">
          Signed in? Portal →
        </ClientNavLink>
        <ClientNavLink href="/apply/track" className="text-muted-foreground hover:text-foreground text-sm pb-1">
          Track an application →
        </ClientNavLink>
      </div>
    </form>
  );
}

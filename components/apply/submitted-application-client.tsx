"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { GUEST_LINK_EVENTS, trackGuestLinkEvent } from "@/lib/analytics/guest-link-events";
import { trackApplyPaymentCompleted } from "@/lib/analytics/gtag-client";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { buildPostLinkLocation } from "@/lib/applications/post-link-redirect";
import { apiHref, appHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";
import { useCustomerT } from "@/components/client/customer-i18n-provider";

interface ISubmittedApplicationClientProps {
  applicationId: string;
  initialApplication: PublicApplication;
}

type TApiErrBody = {
  ok?: boolean;
  data?: { prepared?: boolean; applicationId?: string; linked?: boolean; alreadyLinked?: boolean };
  error?: { message?: string; code?: string; details?: { code?: string } };
};

const pollIntervalMs = (elapsedMs: number): number => {
  if (elapsedMs < 60_000) return 2000;
  return 5000;
};

export const SubmittedApplicationClient: FC<ISubmittedApplicationClientProps> = ({
  applicationId,
  initialApplication,
}) => {
  const t = useCustomerT();
  const router = useRouter();
  const sessionUser = useClientAuthStore((s) => s.session?.user);
  const sessionPending = useClientAuthStore((s) => s.isPending);
  const [app, setApp] = useState(initialApplication);
  const [pollMsg, setPollMsg] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [linkActionError, setLinkActionError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const firedView = useRef(false);
  const adsConversionFired = useRef(false);

  useEffect(() => {
    if (firedView.current) return;
    firedView.current = true;
    trackGuestLinkEvent(GUEST_LINK_EVENTS.submittedView, { applicationId });
  }, [applicationId]);

  useEffect(() => {
    if (adsConversionFired.current) return;
    if (app.paymentStatus !== "paid") return;
    if (app.chargedAmountMajor == null || !app.chargedCurrency) return;
    adsConversionFired.current = true;
    trackApplyPaymentCompleted({
      applicationId,
      value: app.chargedAmountMajor,
      currency: app.chargedCurrency,
    });
  }, [app.paymentStatus, app.chargedAmountMajor, app.chargedCurrency, applicationId]);

  const load = useCallback(async () => {
    const res = await fetch(apiHref(`/applications/${encodeURIComponent(applicationId)}`), {
      credentials: "include",
    });
    const json = (await res.json()) as { ok?: boolean; data?: { application: PublicApplication } };
    if (json.ok && json.data?.application) {
      setApp(json.data.application);
    }
  }, [applicationId]);

  useOnBfcacheRestore(() => {
    void load();
  });

  useEffect(() => {
    if (app.paymentStatus !== "checkout_created") return;

    const t0 = Date.now();
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - t0;
      if (elapsed > 180_000) {
        setTerminal(true);
        setPollMsg(t("submitted.stillConfirmingPayment"));
        return;
      }
      await load();
      timeout = setTimeout(tick, pollIntervalMs(elapsed));
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [app.paymentStatus, load, t]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkAfterPath = "/apply/link-after-signup";

  const prepareGuestIntent = async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const res = await fetch(apiHref("/apply/prepare-guest-link-intent"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ applicationId }),
    });
    const json = (await res.json()) as TApiErrBody;
    if (!res.ok || !json.ok || !json.data?.applicationId) {
      const detail =
        json.error?.details && typeof json.error.details === "object" && "code" in json.error.details
          ? String((json.error.details as { code?: string }).code ?? "")
          : "";
      const notCfg =
        detail === "GUEST_LINK_INTENT_NOT_CONFIGURED" ||
        (json.error?.message ?? "").includes("GUEST_LINK_INTENT_SECRET");
      const msg = notCfg
        ? t("submitted.linkErrors.intentNotConfigured")
        : res.status === 503
          ? t("submitted.linkErrors.temporarilyUnavailable")
          : res.status === 404
            ? t("submitted.linkErrors.verifyApplication")
            : detail === "INTENT_REQUIRES_PAID" || detail === "LINK_NOT_ALLOWED"
              ? t("submitted.linkErrors.cannotLink")
              : (json.error?.message ?? `Could not prepare linking (HTTP ${res.status}).`);
      return { ok: false, message: msg };
    }
    const idToStore = json.data.applicationId;
    try {
      sessionStorage.setItem("guest_link_application_id", idToStore);
      if (sessionStorage.getItem("guest_link_application_id") !== idToStore) {
        return {
          ok: false,
          message: t("submitted.linkErrors.storageBlocked"),
        };
      }
    } catch {
      return {
        ok: false,
        message: t("submitted.linkErrors.storageBlockedShort"),
      };
    }
    trackGuestLinkEvent(GUEST_LINK_EVENTS.guestLinkIntentPrepared, { applicationId });
    return { ok: true };
  };

  const goAuth = async (target: "sign-up" | "sign-in") => {
    setLinkActionError(null);
    setAuthBusy(true);
    const prep = await prepareGuestIntent();
    setAuthBusy(false);
    if (!prep.ok) {
      setLinkActionError(prep.message);
      return;
    }
    const cb = encodeURIComponent(safeCallbackUrl(linkAfterPath));
    const authPath = target === "sign-up" ? "/sign-up" : "/sign-in";
    window.location.assign(`${appHref(authPath)}?callbackUrl=${cb}`);
  };

  const attachWhileSignedIn = async () => {
    setLinkActionError(null);
    setAuthBusy(true);
    try {
      const prep = await prepareGuestIntent();
      if (!prep.ok) {
        setLinkActionError(prep.message);
        return;
      }
      const res = await fetch(apiHref("/applications/link-after-auth"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
      });
      const json = (await res.json()) as TApiErrBody;
      if (json.ok && (json.data?.linked || json.data?.alreadyLinked)) {
        router.replace(buildPostLinkLocation(applicationId));
        return;
      }
      const msg =
        json.error?.message ??
        (res.status === 401
          ? t("submitted.linkErrors.sessionExpired")
          : t("submitted.linkErrors.attachFailed"));
      setLinkActionError(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const confirming = app.paymentStatus === "checkout_created";
  const paid = app.paymentStatus === "paid";
  const showGuestLink = paid && app.isGuest;
  const signedIn = Boolean(sessionUser?.id);

  return (
    <div className="space-y-10">
      <header className="space-y-6">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm leading-relaxed" role="status" aria-live="polite">
            {t("submitted.referencePrefix")}{" "}
            <span className="text-foreground font-mono text-xs">{app.referenceNumber ?? app.id.slice(0, 8)}</span>
            {paid
              ? t("submitted.paymentConfirmedSuffix")
              : confirming && !terminal
                ? t("submitted.confirmingPaymentSuffix")
                : null}
            {confirming && terminal ? ` · ${pollMsg ?? ""}` : null}
          </p>
        </div>
        <ApplicationClientTracking tracking={app.clientTracking} />
      </header>

      {showGuestLink ? (
        <section className="space-y-5 rounded-[12px] border border-border border-l-[3px] border-l-primary bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          <div className="space-y-2">
            <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.2em]">
              {t("submitted.guestLinkEyebrow")}
            </p>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-[#012031] sm:text-2xl">
              {t("submitted.guestLinkTitle")}
            </h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {signedIn ? t("submitted.guestLinkSignedInBody") : t("submitted.guestLinkGuestBody")}
          </p>
          {!signedIn ? (
            <ul className="text-muted-foreground list-inside list-disc space-y-1.5 border-y border-border py-4 text-sm leading-relaxed">
              <li>{t("submitted.guestLinkBenefit1")}</li>
              <li>{t("submitted.guestLinkBenefit2")}</li>
              <li>{t("submitted.guestLinkBenefit3")}</li>
            </ul>
          ) : null}
          {linkActionError ? (
            <p className="text-error text-sm leading-relaxed" role="alert">
              {linkActionError}
            </p>
          ) : null}
          {!sessionPending && signedIn ? (
            <ClientButton
              type="button"
              brand="cta"
              disabled={authBusy}
              onClick={() => void attachWhileSignedIn()}
            >
              {authBusy ? t("submitted.attaching") : t("submitted.attachToAccount")}
            </ClientButton>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <ClientButton
                type="button"
                brand="cta"
                disabled={authBusy || sessionPending}
                onClick={() => void goAuth("sign-up")}
              >
                {authBusy ? t("submitted.working") : t("submitted.createAccount")}
              </ClientButton>
              <ClientButton
                type="button"
                variant="outline"
                brand="white"
                disabled={authBusy || sessionPending}
                onClick={() => void goAuth("sign-in")}
              >
                {authBusy ? t("submitted.working") : t("submitted.alreadyHaveAccount")}
              </ClientButton>
            </div>
          )}
        </section>
      ) : null}

      {app.adminAttentionRequired && paid && (
        <div className="rounded-[12px] border border-border bg-muted/50 p-4 text-sm text-muted-foreground leading-relaxed shadow-sm">
          {t("submitted.adminReviewBanner")}
        </div>
      )}

      {confirming && terminal && (
        <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-medium">{t("submitted.stillConfirmingTitle")}</p>
          <ClientButton
            type="button"
            variant="outline"
            className="self-start font-medium"
            onClick={() => void load()}
          >
            {t("submitted.refreshStatus")}
          </ClientButton>
          <Link href={SUPPORT_WHATSAPP_URL} className="text-link text-sm font-medium">
            {t("submitted.contactSupport")}
          </Link>
        </div>
      )}

      {paid && !app.isGuest && (
        <section className="rounded-[12px] border border-border bg-card p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <h2 className="font-heading text-lg font-semibold text-[#012031]">{t("submitted.nextStepsTitle")}</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t("submitted.nextStepsBody")}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ClientButtonLink href="/apply/track" brand="cta" className="inline-flex">
              {t("submitted.trackApplication")}
            </ClientButtonLink>
            <ClientButtonLink href="/" brand="white" className="inline-flex">
              {t("submitted.startNewApplication")}
            </ClientButtonLink>
          </div>
        </section>
      )}

      <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 border-t border-border pt-8 text-xs sm:justify-start">
        <Link href="/" className="text-link font-medium transition-colors hover:underline">
          {t("submitted.browseServices")}
        </Link>
        <span aria-hidden className="text-border">
          ·
        </span>
        <Link href={SUPPORT_WHATSAPP_URL} className="text-link font-medium transition-colors hover:underline">
          {t("submitted.help")}
        </Link>
      </footer>
    </div>
  );
};

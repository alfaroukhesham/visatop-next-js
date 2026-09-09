"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { authClient } from "@/lib/auth-client";
import { appHref } from "@/lib/app-href";

export function TrackSignInPanel() {
  const t = useCustomerT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setPending(true);
    const { error: socialError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: appHref("/apply/track"),
    });
    setPending(false);
    if (socialError) {
      setError(socialError.message ?? t("auth.signIn.couldNotSignIn"));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });
    setPending(false);
    if (signInError) {
      setError(signInError.message ?? t("auth.signIn.couldNotSignIn"));
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-6 rounded-[12px] border border-border bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)] sm:p-8">
      <div className="space-y-1">
        <h2 className="font-heading text-foreground text-lg font-semibold">{t("auth.signIn.cardTitle")}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{t("track.signInHelper")}</p>
      </div>
      {error ? (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <ClientButton type="button" variant="outline" disabled={pending} onClick={() => void signInWithGoogle()}>
        {t("auth.signIn.continueGoogle")}
      </ClientButton>
      <div className="flex items-center gap-3">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">{t("auth.signIn.orDivider")}</span>
        <div className="bg-border h-px flex-1" />
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <ClientField id="track-email" label={t("auth.signIn.emailLabel")}>
          <ClientInput
            id="track-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </ClientField>
        <ClientField id="track-password" label={t("auth.signIn.passwordLabel")}>
          <ClientInput
            id="track-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </ClientField>
        <ClientButton type="submit" brand="cta" disabled={pending} className="font-semibold">
          {pending ? t("auth.signIn.signingIn") : t("auth.signIn.signInButton")}
        </ClientButton>
      </form>
    </section>
  );
}

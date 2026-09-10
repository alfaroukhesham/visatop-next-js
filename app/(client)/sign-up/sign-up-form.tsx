"use client";

import { Suspense, useState, type FC, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFlowSkeleton } from "@/components/auth/auth-flow-skeleton";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { appHref } from "@/lib/app-href";
import { authClient } from "@/lib/auth-client";
import { ClientAppHeader } from "@/components/client/client-app-header";
import {
  ClientButton,
  ClientButtonLink,
} from "@/components/client/client-button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  ClientCard,
  CardTitle,
} from "@/components/client/client-card";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { useCustomerT } from "@/components/client/customer-i18n-provider";

type TSocialProvider = "google" | "facebook";

interface ISignUpFormProps {
  facebookEnabled: boolean;
}

export const SignUpForm: FC<ISignUpFormProps> = ({ facebookEnabled }) => {
  return (
    <Suspense fallback={<AuthFlowSkeleton />}>
      <SignUpFormContent facebookEnabled={facebookEnabled} />
    </Suspense>
  );
};

const SignUpFormContent: FC<ISignUpFormProps> = ({ facebookEnabled }) => {
  const t = useCustomerT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signInWith = async (provider: TSocialProvider) => {
    setError(null);
    setPending(true);
    const next = safeCallbackUrl(searchParams.get("callbackUrl"));
    const { error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: appHref(next),
    });
    setPending(false);
    if (socialError) {
      setError(socialError.message ?? t("auth.signUp.couldNotContinue"));
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? t("auth.signUp.couldNotCreateAccount"));
      return;
    }
    router.refresh();
    router.push(safeCallbackUrl(searchParams.get("callbackUrl")));
  };

  const socialCols =
    facebookEnabled ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-xs sm:max-w-none";

  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_10%_20%,rgba(252,205,100,0.2),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto grid w-full max-w-[calc(1300px+3rem)] flex-1 items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_420px] lg:gap-16 lg:py-20 xl:gap-24">
          <div className="space-y-2 lg:hidden">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#012031]">
              {t("auth.signUp.mobileTitle")}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("auth.signUp.mobileSubtitle")}
            </p>
          </div>
          <ClientHeroPanel className="border-secondary/20 hidden bg-gradient-to-br from-white via-[#F2F9FC] to-white p-8 shadow-[0_12px_48px_rgba(1,32,49,0.08)] lg:block lg:p-10">
            <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">
              {t("auth.signUp.heroEyebrow")}
            </p>
            <h1 className="font-heading mt-4 text-[clamp(1.85rem,3.5vw,3rem)] font-semibold leading-[1.1] tracking-tight text-[#012031]">
              {t("auth.signUp.heroTitle")}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-[48ch] text-lg leading-relaxed">
              {t("auth.signUp.heroBody")}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="border-secondary/15 rounded-[5px] border bg-white/60 p-4">
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest">
                  {t("auth.signUp.featureClarityTitle")}
                </p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {t("auth.signUp.featureClarityBody")}
                </p>
              </div>
              <div className="border-secondary/15 rounded-[5px] border bg-white/60 p-4">
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest">
                  {t("auth.signUp.featureTranslationTitle")}
                </p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {t("auth.signUp.featureTranslationBody")}
                </p>
              </div>
            </div>
          </ClientHeroPanel>

          <div className="w-full">
            <ClientCard className="border-secondary/20 overflow-hidden shadow-[0_16px_48px_rgba(1,32,49,0.1)]">
              <CardHeader className="border-b border-border bg-muted/30 pb-6">
                <CardTitle className="font-heading text-2xl text-[#012031]">
                  {t("auth.signUp.cardTitle")}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  {t("auth.signUp.cardDescription")}
                </CardDescription>
              </CardHeader>
              <form onSubmit={onSubmit}>
                <CardContent className="space-y-4 py-6">
                  {error ? (
                    <p className="text-error text-sm" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className={`grid gap-2 ${socialCols}`}>
                    <ClientButton
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void signInWith("google")}
                    >
                      {t("auth.signUp.continueGoogle")}
                    </ClientButton>
                    {facebookEnabled ? (
                      <ClientButton
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void signInWith("facebook")}
                      >
                        {t("auth.signUp.continueFacebook")}
                      </ClientButton>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-border h-px flex-1" />
                    <span className="text-muted-foreground text-xs">{t("auth.signUp.orDivider")}</span>
                    <div className="bg-border h-px flex-1" />
                  </div>
                  <ClientField id="name" label={t("auth.signUp.nameLabel")}>
                    <ClientInput
                      id="name"
                      autoComplete="name"
                      required
                      value={name}
                      invalid={!!error}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </ClientField>
                  <ClientField id="email" label={t("auth.signUp.emailLabel")}>
                    <ClientInput
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      invalid={!!error}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </ClientField>
                  <ClientField
                    id="password"
                    label={t("auth.signUp.passwordLabel")}
                    hint={t("auth.signUp.passwordHint")}
                  >
                    <ClientInput
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      invalid={!!error}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </ClientField>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t border-border bg-muted/20 pt-6 sm:flex-row sm:justify-between">
                  <ClientButton type="submit" brand="cta" disabled={pending} className="w-full sm:w-auto">
                    {pending ? t("auth.signUp.creating") : t("auth.signUp.createAccountButton")}
                  </ClientButton>
                  <ClientButtonLink
                    href={
                      searchParams.get("callbackUrl")
                        ? `/sign-in?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}`
                        : "/sign-in"
                    }
                    brand="white"
                    className="w-full sm:w-auto"
                  >
                    {t("auth.signUp.alreadyHaveAccountLink")}
                  </ClientButtonLink>
                </CardFooter>
              </form>
            </ClientCard>
          </div>
        </div>
      </main>
    </div>
  );
};

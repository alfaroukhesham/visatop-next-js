"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
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

type SocialProvider = "google" | "facebook";

export function SignUpForm({ facebookEnabled }: { facebookEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWith(provider: SocialProvider) {
    setError(null);
    setPending(true);
    const { error: socialError } = await authClient.signIn.social({ provider });
    setPending(false);
    if (socialError) {
      setError(socialError.message ?? "Could not continue");
    }
  }

  async function onSubmit(e: React.FormEvent) {
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
      setError(signUpError.message ?? "Could not create account");
      return;
    }
    router.refresh();
    router.push(safeCallbackUrl(searchParams.get("callbackUrl")));
  }

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
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#012031]">Create your account</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Secure portal for documents, payments, and status.
            </p>
          </div>
          <ClientHeroPanel className="border-secondary/20 hidden bg-gradient-to-br from-white via-[#F2F9FC] to-white p-8 shadow-[0_12px_48px_rgba(1,32,49,0.08)] lg:block lg:p-10">
            <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">Create account</p>
            <h1 className="font-heading mt-4 text-[clamp(1.85rem,3.5vw,3rem)] font-semibold leading-[1.1] tracking-tight text-[#012031]">
              Your portal for every document and update.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-[48ch] text-lg leading-relaxed">
              One secure place to upload files, review extracted fields, pay, and track status — built for
              clarity under pressure.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="border-secondary/15 rounded-[5px] border bg-white/60 p-4">
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest">Built for clarity</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Left-aligned rhythm and generous spacing for busy days.
                </p>
              </div>
              <div className="border-secondary/15 rounded-[5px] border bg-white/60 p-4">
                <p className="text-secondary text-[10px] font-bold uppercase tracking-widest">Translation-ready</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Layouts stay resilient with longer labels and RTL.
                </p>
              </div>
            </div>
          </ClientHeroPanel>

          <div className="w-full">
            <ClientCard className="border-secondary/20 overflow-hidden shadow-[0_16px_48px_rgba(1,32,49,0.1)]">
              <CardHeader className="border-b border-border bg-muted/30 pb-6">
                <CardTitle className="font-heading text-2xl text-[#012031]">Create account</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Email and password, or continue with a provider.
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
                      onClick={() => signInWith("google")}
                    >
                      Continue with Google
                    </ClientButton>
                    {facebookEnabled ? (
                      <ClientButton
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => signInWith("facebook")}
                      >
                        Continue with Facebook
                      </ClientButton>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-border h-px flex-1" />
                    <span className="text-muted-foreground text-xs">or</span>
                    <div className="bg-border h-px flex-1" />
                  </div>
                  <ClientField id="name" label="Name">
                    <ClientInput
                      id="name"
                      autoComplete="name"
                      required
                      value={name}
                      invalid={!!error}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </ClientField>
                  <ClientField id="email" label="Email">
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
                    label="Password"
                    hint="Use at least 8 characters."
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
                    {pending ? "Creating…" : "Create account"}
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
                    I already have an account
                  </ClientButtonLink>
                </CardFooter>
              </form>
            </ClientCard>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SocialProvider = "google" | "facebook";

export function SignUpForm({ facebookEnabled }: { facebookEnabled: boolean }) {
  const router = useRouter();
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
    router.push("/portal");
  }

  const socialCols =
    facebookEnabled ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-xs sm:max-w-none";

  return (
    <div className="bg-background text-foreground flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              Visa &amp; residency services
            </p>
            <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
              Visatop
            </Link>
          </div>
          <Link
            href="/admin/sign-in"
            className={cn(buttonVariants({ variant: "ghost" }), "h-8 px-3 text-xs")}
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Create your account.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed sm:text-lg max-w-[65ch]">
              Get a secure portal where you can upload documents, review details,
              and track progress.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border bg-card border p-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Built for clarity
              </p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Everything left-aligned and easy to scan — even on busy days.
              </p>
            </div>
            <div className="border-border bg-card border p-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Translation-ready
              </p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Layouts are resilient to longer labels and RTL languages.
              </p>
            </div>
          </div>
        </section>

        <aside className="lg:justify-self-end w-full">
          <Card className="w-full max-w-md border-border">
            <CardHeader className="border-b border-border">
              <CardTitle>Create account</CardTitle>
              <CardDescription>Sign up with email and password.</CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4 py-6">
                {error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className={cn("grid gap-2", socialCols)}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => signInWith("google")}
                  >
                    Continue with Google
                  </Button>
                  {facebookEnabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => signInWith("facebook")}
                    >
                      Continue with Facebook
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-muted-foreground text-xs">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Use at least 8 characters.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                  {pending ? "Creating…" : "Create account"}
                </Button>
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full sm:w-auto inline-flex items-center justify-center",
                  )}
                >
                  I already have an account
                </Link>
              </CardFooter>
            </form>
          </Card>
        </aside>
      </main>
    </div>
  );
}

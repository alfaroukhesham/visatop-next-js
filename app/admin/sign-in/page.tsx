"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { adminAuthClient } from "@/lib/admin-auth-client";
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

function safeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/admin";
  }
  if (!raw.startsWith("/admin")) return "/admin";
  return raw;
}

export default function AdminSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: signInError } = await adminAuthClient.signIn.email({
      email,
      password,
    });
    setPending(false);
    if (signInError) {
      const code =
        signInError && typeof signInError === "object" && "code" in signInError
          ? String((signInError as { code?: string }).code)
          : null;
      setError(
        [signInError.message, code ? `(${code})` : null]
          .filter(Boolean)
          .join(" ") || "Could not sign in",
      );
      return;
    }
    const next = safeCallbackUrl(searchParams.get("callbackUrl"));
    router.refresh();
    router.push(next);
  }

  return (
    <div className="bg-background text-foreground flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              Admin access
            </p>
            <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
              Visatop
            </Link>
          </div>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost" }), "h-8 px-3 text-xs")}
          >
            Customer
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Admin sign in
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed sm:text-lg max-w-[65ch]">
              This area is for operations staff. Admin accounts are provisioned
              internally.
            </p>
          </div>
          <div className="border-border bg-card border p-4">
            <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Note
            </p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              If you don’t have an admin account, use the customer portal sign-in.
            </p>
          </div>
        </section>

        <aside className="lg:justify-self-end w-full">
          <Card className="w-full max-w-md border-border">
            <CardHeader className="border-b border-border">
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Use your admin email and password.</CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4 py-6">
                {error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
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
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full sm:w-auto inline-flex items-center justify-center",
                  )}
                >
                  Customer sign in
                </Link>
              </CardFooter>
            </form>
          </Card>
        </aside>
      </main>
    </div>
  );
}


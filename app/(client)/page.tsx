import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Visa and residency services — sign in to manage your application in one place.",
};

/** Session-dependent CTAs; whole route stays dynamic. Revisit a static shell only if TTFB metrics require it. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const hdrs = await headers();
  const session = await auth.api.getSession({
    headers: hdrs,
  });
  const adminSession = await adminAuth.api.getSession({
    headers: hdrs,
  });

  return (
    <div className="bg-background text-foreground flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              Visa &amp; residency services
            </p>
            <h1 className="font-heading text-lg font-semibold tracking-tight">
              Visatop
            </h1>
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
            <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              A calm, structured way to manage your application.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed sm:text-lg max-w-[65ch]">
              Sign in to continue your visa or residency journey. Upload documents,
              review details, and track progress in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border bg-card border p-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Step 1
              </p>
              <p className="mt-1 font-medium">Create your account</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Save your details and return anytime.
              </p>
            </div>
            <div className="border-border bg-card border p-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Step 2
              </p>
              <p className="mt-1 font-medium">Submit documents</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Keep everything organized in a single workspace.
              </p>
            </div>
            <div className="border-border bg-card border p-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Step 3
              </p>
              <p className="mt-1 font-medium">Review &amp; pay</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Confirm extracted details before submission.
              </p>
            </div>
            <div className="border-border bg-card border p-4">
              <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Step 4
              </p>
              <p className="mt-1 font-medium">Track status</p>
              <p className="text-muted-foreground mt-1 text-sm">
                See progress updates without back-and-forth.
              </p>
            </div>
          </div>
        </section>

        <aside className="lg:justify-self-end w-full">
          <Card className="w-full max-w-md border-border">
            <CardHeader className="border-b border-border">
              <CardTitle>Sign in or create an account</CardTitle>
              <CardDescription>
                Customer access only. Admins use the switch in the top-right.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 py-6">
              <div className="space-y-2">
                {session?.user ? (
                  <p className="text-muted-foreground text-sm">
                    Signed in as{" "}
                    <span className="text-foreground font-medium">
                      {session.user.email}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Sign in to access your portal.
                  </p>
                )}
                {adminSession?.user ? (
                  <p className="text-muted-foreground text-sm">
                    Admin session detected:{" "}
                    <span className="text-foreground font-medium">
                      {adminSession.user.email}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                {session?.user ? (
                  <>
                    <Link
                      href="/apply/start"
                      className={cn(
                        buttonVariants({ variant: "secondary" }),
                        "justify-center rounded-none font-semibold",
                      )}
                    >
                      Start application (guest OK)
                    </Link>
                    <Link
                      href="/portal"
                      className={cn(buttonVariants({ variant: "default" }), "justify-center")}
                    >
                      Go to portal
                    </Link>
                    <form action={signOutAction}>
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full justify-center"
                      >
                        Sign out
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link
                      href="/apply/start"
                      className={cn(
                        buttonVariants({ variant: "secondary" }),
                        "justify-center rounded-none font-semibold",
                      )}
                    >
                      Start without signing in
                    </Link>
                    <Link
                      href="/sign-in"
                      className={cn(buttonVariants({ variant: "default" }), "justify-center")}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
                    >
                      Create account
                    </Link>
                  </>
                )}
                {adminSession?.user ? (
                  <Link
                    href="/admin"
                    className={cn(buttonVariants({ variant: "secondary" }), "justify-center")}
                  >
                    Go to admin
                  </Link>
                ) : null}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Tip: If you were given an admin account, use <span className="font-medium">Admin</span> in
                  the header. Admin signup is disabled.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

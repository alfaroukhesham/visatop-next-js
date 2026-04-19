import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export const metadata = {
  title: "Application workspace | Unified Hybrid Portal",
};

type Search = Promise<{ applicationId?: string }>;

export default async function ApplicationWorkspacePage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const rawId = sp.applicationId?.trim();
  const highlightEnabled = process.env.WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED !== "false";

  if (rawId) {
    const id = rawId;
    if (!highlightEnabled) {
      redirect(`/apply/applications/${encodeURIComponent(id)}?linked=1`);
    }

    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    if (!session) {
      redirect(
        `/sign-in?callbackUrl=${encodeURIComponent(`/portal/application-workspace?applicationId=${encodeURIComponent(id)}`)}`,
      );
    }

    const apps = await withClientDbActor(session.user.id, async (tx) => {
      return tx
        .select({
          id: application.id,
          referenceNumber: application.referenceNumber,
          applicationStatus: application.applicationStatus,
          paymentStatus: application.paymentStatus,
          createdAt: application.createdAt,
        })
        .from(application)
        .where(eq(application.userId, session.user.id))
        .orderBy(desc(application.createdAt))
        .limit(50);
    });

    const match = apps.find((a) => a.id === id);
    if (!match) {
      redirect("/portal");
    }

    return (
      <div className="bg-background text-foreground flex min-h-screen flex-col">
        <header className="border-border bg-card sticky top-0 z-10 flex h-16 w-full shrink-0 items-center border-b px-6">
          <Link
            href="/portal/client-dashboard"
            className="text-foreground hover:text-primary mr-6 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="bg-border mx-2 hidden h-6 w-px sm:block" />
          <div className="flex items-center gap-3">
            <FileText className="text-primary size-5" aria-hidden />
            <h1 className="font-heading text-lg font-semibold tracking-tight">Application workspace</h1>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
          <p className="text-muted-foreground text-sm">
            Applications linked to your account. The highlighted row matches your deep link.
          </p>
          <ul className="space-y-3">
            {apps.map((a) => {
              const active = a.id === id;
              return (
                <li key={a.id}>
                  <Link
                    href={`/apply/applications/${encodeURIComponent(a.id)}`}
                    className={cn(
                      "border-border bg-card block border p-4 transition-colors",
                      active && "border-l-primary border-l-4",
                    )}
                  >
                    <p className="font-mono text-xs">{a.referenceNumber ?? a.id.slice(0, 8)}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {a.applicationStatus.replaceAll("_", " ")} · {a.paymentStatus}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border bg-card sticky top-0 z-10 flex h-16 w-full shrink-0 items-center border-b px-6">
        <Link
          href="/portal/client-dashboard"
          className="text-foreground hover:text-primary mr-6 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-5" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <div className="bg-border mx-2 hidden h-6 w-px sm:block" />
        <div className="flex items-center gap-3">
          <FileText className="text-primary size-5" aria-hidden />
          <h1 className="font-heading text-lg font-semibold tracking-tight">Application workspace</h1>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
        <div className="border-border bg-card border border-l-4 border-l-primary p-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
            The interactive draft flow lives under{" "}
            <span className="text-foreground font-mono text-xs">/apply</span> so guests are not blocked by
            portal authentication. Use{" "}
            <Link href="/apply/start" className="text-link font-medium">
              Start application
            </Link>{" "}
            to create a draft, then manage documents and extraction on the next screen.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/apply/start"
              className={cn(
                buttonVariants({ variant: "default" }),
                "rounded-none px-6 font-semibold",
              )}
            >
              Open start flow
            </Link>
            <Link
              href="/portal"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-none px-6 font-semibold")}
            >
              Portal overview
            </Link>
          </div>
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Deep-link with{" "}
          <span className="font-mono">
            ?applicationId=&lt;uuid&gt;
          </span>{" "}
          to jump straight into the live workspace.
        </p>
      </main>
    </div>
  );
}

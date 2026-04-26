import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { ClientButtonLink } from "@/components/client/client-button";
import { ClientSurface } from "@/components/client/client-surface";
import { ApplicationClientTracking } from "@/components/apply/application-client-tracking";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
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
          fulfillmentStatus: application.fulfillmentStatus,
          adminAttentionRequired: application.adminAttentionRequired,
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
      <div className="text-foreground flex min-h-[calc(100vh-4rem)] flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center border-b border-[#224D64]/12 bg-white/90 px-5 shadow-sm backdrop-blur-md sm:px-8">
          <Link
            href="/portal/client-dashboard"
            className="text-secondary hover:text-foreground mr-5 flex items-center gap-2 text-sm font-semibold transition-colors duration-200"
          >
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="bg-border mx-1 hidden h-6 w-px sm:block" />
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="text-primary size-5 shrink-0" aria-hidden />
            <h1 className="font-heading truncate text-lg font-semibold text-[#012031]">Application workspace</h1>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Applications linked to your account. The highlighted row matches your deep link.
          </p>
          <ul className="space-y-3">
            {apps.map((a) => {
              const active = a.id === id;
              const tracking = computeClientApplicationTracking({
                applicationStatus: a.applicationStatus,
                paymentStatus: a.paymentStatus,
                fulfillmentStatus: a.fulfillmentStatus,
                adminAttentionRequired: a.adminAttentionRequired,
              });
              return (
                <li key={a.id}>
                  <Link
                    href={`/apply/applications/${encodeURIComponent(a.id)}`}
                    className={`border-border bg-card block rounded-[10px] border p-4 shadow-sm transition-all duration-200 hover:border-secondary/30 hover:shadow-[0_8px_28px_rgba(1,32,49,0.08)] ${
                      active ? "border-l-[3px] border-l-[#FCCD64] ring-1 ring-[#FCCD64]/20" : ""
                    }`}
                  >
                    <p className="font-mono text-xs text-[#012031]">{a.referenceNumber ?? a.id.slice(0, 8)}</p>
                    <p className="text-foreground mt-2 text-sm font-medium leading-snug">{tracking.headline}</p>
                    <ApplicationClientTracking tracking={tracking} stepsOnly className="mt-3" />
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
    <div className="text-foreground flex min-h-[calc(100vh-4rem)] flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center border-b border-[#224D64]/12 bg-white/90 px-5 shadow-sm backdrop-blur-md sm:px-8">
        <Link
          href="/portal/client-dashboard"
          className="text-secondary hover:text-foreground mr-5 flex items-center gap-2 text-sm font-semibold transition-colors duration-200"
        >
          <ArrowLeft className="size-5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <div className="bg-border mx-1 hidden h-6 w-px sm:block" />
        <div className="flex items-center gap-2">
          <FileText className="text-primary size-5 shrink-0" aria-hidden />
          <h1 className="font-heading text-lg font-semibold text-[#012031]">Application workspace</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
        <ClientSurface
          preset="highlight"
          className="border-secondary/20 from-card to-muted/25 border-l-[3px] border-l-[#FCCD64] bg-gradient-to-br p-6 shadow-[0_8px_32px_rgba(1,32,49,0.07)]"
        >
          <p className="text-muted-foreground text-sm leading-relaxed">
            The interactive draft flow lives under{" "}
            <span className="text-foreground font-mono text-xs">/apply</span> so guests are not blocked by
            portal authentication. Use{" "}
            <Link href="/apply/start" className="text-link font-semibold hover:underline">
              Start application
            </Link>{" "}
            to create a draft, then manage documents and extraction on the next screen.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ClientButtonLink href="/apply/start" brand="cta" className="px-6 font-semibold">
              Open start flow
            </ClientButtonLink>
            <ClientButtonLink href="/portal" brand="white" className="px-6 font-semibold">
              Portal hub
            </ClientButtonLink>
          </div>
        </ClientSurface>
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Deep-link with{" "}
          <span className="font-mono text-[11px] text-foreground">?applicationId=&lt;uuid&gt;</span> to jump
          straight into the live workspace.
        </p>
      </main>
    </div>
  );
}

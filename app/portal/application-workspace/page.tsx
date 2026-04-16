import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

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
  if (sp.applicationId?.trim()) {
    redirect(`/apply/applications/${encodeURIComponent(sp.applicationId.trim())}`);
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

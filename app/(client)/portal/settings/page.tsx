import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/portal/change-password-form";

export const metadata = {
  title: "Settings | Visatop",
};

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });

  const email = (session?.user as any)?.email ?? null;
  const name = (session?.user as any)?.name ?? null;

  return (
    <div className="text-foreground flex min-h-[calc(100vh-4rem)] flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/portal"
            className="text-secondary hover:text-foreground inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-200"
          >
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
            <span>Portal</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <Settings className="text-primary size-5 shrink-0" aria-hidden />
            <h1 className="font-heading truncate text-lg font-semibold text-foreground">Settings</h1>
          </div>
        </div>

        <section className="space-y-2 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
          <p className="font-heading text-base font-semibold tracking-tight">Account</p>
          <dl className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground font-medium">Name</dt>
              <dd>{name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-foreground font-medium">Email</dt>
              <dd className="font-mono text-xs break-all">{email ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <ChangePasswordForm />
      </main>
    </div>
  );
}


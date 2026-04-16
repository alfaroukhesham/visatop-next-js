import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { adminAuth } from "@/lib/admin-auth";
import { DraftTtlSettings } from "@/components/admin/draft-ttl-settings";
import { AdminShell } from "@/components/admin/admin-shell";
import { withAdminDbActor } from "@/lib/db/actor-context";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/admin/sign-in?callbackUrl=%2Fadmin%2Fsettings");
  }

  const gate = await withAdminDbActor(session.user.id, async ({ permissions }) => {
    if (!permissions.includes("settings.read")) {
      return "forbidden" as const;
    }
    return "ok" as const;
  });

  if (gate === "forbidden") {
    return (
      <AdminShell
        title="Platform settings"
        active="settings"
        subtitle="Missing settings.read permission for this admin account."
      >
        <p className="text-muted-foreground font-body text-sm leading-relaxed">
          Ask a super admin to grant <span className="font-mono text-xs">settings.read</span> (and{" "}
          <span className="font-mono text-xs">settings.write</span> if you need to change values).
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Platform settings"
      active="settings"
      subtitle="Operational keys stored in Postgres with RLS. Draft TTL controls unpaid guest and signed-in draft expiry."
    >
      <section className="border-border max-w-xl space-y-4 border border-l-4 border-l-primary bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center border border-primary/20">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Draft expiry</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Key <span className="font-mono text-xs">draft_ttl_hours</span> in{" "}
              <span className="font-mono text-xs">platform_setting</span>. New drafts use the resolved window once;
              existing rows keep their original <span className="font-mono text-xs">draft_expires_at</span>.
            </p>
          </div>
        </div>
        <DraftTtlSettings />
      </section>
    </AdminShell>
  );
}

import { SlidersHorizontal } from "lucide-react";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { DraftTtlSettings } from "@/components/admin/draft-ttl-settings";
import { DisplayFxSettings } from "@/components/admin/display-fx-settings";
import { PaymentsSettings } from "@/components/admin/payments-settings";
import { PartySettings } from "@/components/admin/party-settings";
import { ApplyPriceBadgeSettings } from "@/components/admin/apply-price-badge-settings";
import { AdminShell } from "@/components/admin/admin-shell";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { getApplyConfigFromTx } from "@/lib/apply/apply-config";

export default async function AdminSettingsPage() {
  const adminUserId = await getAdminUserId();

  const gate = await withAdminDbActor(adminUserId, async ({ tx, permissions }) => {
    if (!permissions.includes("settings.read")) {
      return "forbidden" as const;
    }
    const applyConfig = await getApplyConfigFromTx(tx);
    return { applyConfig } as const;
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
      subtitle="Manage platform settings."
    >
      <section className="border-border max-w-xl space-y-4 border border-b-2 border-b-primary bg-card p-6">
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

      <section
        id="multi-traveller"
        className="border-border mt-8 max-w-xl space-y-4 border border-b-2 border-b-primary bg-card p-6"
      >
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center border border-primary/20">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Multi-traveller applications</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Controls how many travellers can be added to a single checkout. Stored in{" "}
              <span className="font-mono text-xs">platform_setting</span>.
            </p>
          </div>
        </div>
        <PartySettings
          partyEnabled={gate.applyConfig.partyEnabled}
          partyMaxTravelers={gate.applyConfig.partyMaxTravelers}
        />
      </section>

      <section
        id="apply-price-badges"
        className="border-border mt-8 max-w-xl space-y-4 border border-b-2 border-b-primary bg-card p-6"
      >
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center border border-primary/20">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Price badges</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Key <span className="font-mono text-xs">apply_price_badges</span> in{" "}
              <span className="font-mono text-xs">platform_setting</span>. These strings appear on the apply
              chooser.
            </p>
          </div>
        </div>
        <ApplyPriceBadgeSettings badges={gate.applyConfig.badges} />
      </section>

      <section
        id="display-fx"
        className="border-border mt-8 max-w-xl space-y-4 border border-b-2 border-b-primary bg-card p-6"
      >
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center border border-primary/20">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Display FX</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Key <span className="font-mono text-xs">fx_aed_per_usd</span> in{" "}
              <span className="font-mono text-xs">platform_setting</span>. Used when catalog prices need a USD ↔ AED
              conversion.
            </p>
          </div>
        </div>
        <DisplayFxSettings />
      </section>

      <section className="border-border mt-8 max-w-3xl space-y-4 border border-b-2 border-b-primary bg-card p-6">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-semibold tracking-tight">Payments</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Environment-driven payment provider configuration and webhook setup. Secrets are never shown here.
          </p>
        </div>
        <PaymentsSettings />
      </section>
    </AdminShell>
  );
}

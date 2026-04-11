import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { adminAuth } from "@/lib/admin-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { withAdminDbActor } from "@/lib/db/actor-context";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/admin/sign-in?callbackUrl=%2Fadmin%2Fcatalog");
  }

  const view = await withAdminDbActor(session.user.id, async ({ tx, permissions }) => {
    if (!permissions.includes("catalog.read")) {
      return { kind: "forbidden" as const };
    }
    const nationalities = await tx
      .select()
      .from(schema.nationality)
      .orderBy(schema.nationality.name);
    const services = await tx
      .select()
      .from(schema.visaService)
      .orderBy(desc(schema.visaService.createdAt));
    return { kind: "ok" as const, nationalities, services };
  });

  if (view.kind === "forbidden") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Catalog & pricing</h1>
              <p className="text-muted-foreground text-sm">
                You do not have permission to view catalog data.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/admin"
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Admin home
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
              <CardDescription>
                This page requires the <span className="font-mono">catalog.read</span> admin
                permission. Ask an administrator to grant it, or return to the admin dashboard.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  const { nationalities, services } = view;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Catalog & pricing</h1>
            <p className="text-muted-foreground text-sm">
              Nationalities and visa services (admin APIs under{" "}
              <code className="text-xs">/api/admin/catalog/*</code> and{" "}
              <code className="text-xs">/api/admin/pricing/*</code>).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Admin home
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Nationalities</CardTitle>
            <CardDescription>
              {nationalities.length} row(s). Public list:{" "}
              <Link className="text-primary underline" href="/api/catalog/nationalities">
                GET /api/catalog/nationalities
              </Link>
            </CardDescription>
          </CardHeader>
          <div className="border-t border-border px-6 py-4">
            <ul className="text-sm">
              {nationalities.map((n) => (
                <li key={n.code}>
                  <span className="font-mono">{n.code}</span> — {n.name}{" "}
                  {!n.enabled ? (
                    <span className="text-muted-foreground">(disabled)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Visa services</CardTitle>
            <CardDescription>
              {services.length} row(s). Use admin APIs to create or update services,
              eligibility, margins, and reference prices.
            </CardDescription>
          </CardHeader>
          <div className="border-t border-border px-6 py-4">
            <ul className="text-sm">
              {services.map((s) => (
                <li key={s.id}>
                  {s.name}{" "}
                  <span className="text-muted-foreground font-mono text-xs">{s.id}</span>{" "}
                  {!s.enabled ? (
                    <span className="text-muted-foreground">(disabled)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </main>
    </div>
  );
}

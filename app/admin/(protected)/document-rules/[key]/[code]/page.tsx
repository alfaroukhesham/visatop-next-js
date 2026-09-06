import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";
import { DocumentRulesCountryServices } from "@/components/admin/document-rules-country-services";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogDocumentType } from "@/lib/admin/catalog/document-type";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import * as schema from "@/lib/db/schema";

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | {
      kind: "ok";
      canWrite: boolean;
      documentKey: string;
      documentLabel: string;
      countryCode: string;
      countryName: string;
    };

export default async function AdminDocumentRuleCountryPage({
  params,
}: {
  params: Promise<{ key: string; code: string }>;
}) {
  const [{ key: rawKey, code: rawCode }, adminUserId] = await Promise.all([
    params,
    getAdminUserId(),
  ]);
  const key = decodeURIComponent(rawKey);
  const code = decodeURIComponent(rawCode).toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) notFound();

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const document = await getCatalogDocumentType(tx, key);
    if (!document) return { kind: "missing" };
    const [nationality] = await tx
      .select({
        code: schema.nationality.code,
        name: schema.nationality.name,
      })
      .from(schema.nationality)
      .where(eq(schema.nationality.code, code))
      .limit(1);
    if (!nationality) return { kind: "missing" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      documentKey: document.key,
      documentLabel: document.label,
      countryCode: nationality.code,
      countryName: nationality.name,
    };
  });

  if (view.kind === "missing") notFound();

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Document rule"
        active="document-rules"
        subtitle="You do not have catalog.read."
      >
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              This workspace requires <span className="font-mono">catalog.read</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={`${view.countryName} · ${view.documentLabel}`}
      active="document-rules"
      subtitle="Edit which services need this document in this country."
    >
      <DocumentRulesCountryServices
        documentKey={view.documentKey}
        documentLabel={view.documentLabel}
        countryCode={view.countryCode}
        countryName={view.countryName}
        canWrite={view.canWrite}
      />
    </AdminShell>
  );
}

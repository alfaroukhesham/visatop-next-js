import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { DocumentRulesDocumentView } from "@/components/admin/document-rules-document-view";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCatalogDocumentType,
  type TCatalogDocumentType,
} from "@/lib/admin/catalog/document-type";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | { kind: "ok"; canWrite: boolean; document: TCatalogDocumentType };

export default async function AdminDocumentRulePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const [{ key: rawKey }, adminUserId] = await Promise.all([params, getAdminUserId()]);
  const key = decodeURIComponent(rawKey);

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const document = await getCatalogDocumentType(tx, key);
    if (!document) return { kind: "missing" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      document,
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
      title={view.document.label}
      active="document-rules"
      subtitle="Countries that need this document. Open a country to edit services, or add another country."
    >
      <DocumentRulesDocumentView document={view.document} canWrite={view.canWrite} />
    </AdminShell>
  );
}

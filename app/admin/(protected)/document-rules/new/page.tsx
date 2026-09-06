import { AdminShell } from "@/components/admin/admin-shell";
import { DocumentRulesNewForm } from "@/components/admin/document-rules-new-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";

export const metadata = {
  title: "Add document | Admin",
};

type TView = { kind: "forbidden" } | { kind: "ok"; canWrite: boolean };

export default async function AdminDocumentRulesNewPage() {
  const adminUserId = await getAdminUserId();
  const view = await withAdminDbActor(adminUserId, async ({ permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
    };
  });

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Add document"
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
      title="Add document"
      active="document-rules"
      subtitle="Name the extra document, then assign it to countries for the first time."
    >
      <DocumentRulesNewForm canWrite={view.canWrite} />
    </AdminShell>
  );
}

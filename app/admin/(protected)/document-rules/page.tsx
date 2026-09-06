import { AdminShell } from "@/components/admin/admin-shell";
import { DocumentRulesWorkspace } from "@/components/admin/document-rules-workspace";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";

export const metadata = {
  title: "Document rules | Admin",
};

type TDocumentRulesPageView =
  | { kind: "forbidden" }
  | { kind: "ok"; canWrite: boolean };

export default async function AdminDocumentRulesPage() {
  const adminUserId = await getAdminUserId();
  const view = await withAdminDbActor(adminUserId, async ({ permissions }): Promise<TDocumentRulesPageView> => {
    if (!permissions.includes("catalog.read")) {
      return { kind: "forbidden" };
    }
    const canWrite =
      permissions.includes("catalog.write") && permissions.includes("audit.write");
    return { kind: "ok", canWrite };
  });

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Document rules"
        active="document-rules"
        subtitle="You do not have catalog.read. Ask a super admin to grant RBAC, or return to the overview."
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
      title="Document rules"
      active="document-rules"
      subtitle="Extra documents you can assign. Open a document to set who needs it. Passport and personal photo stay required on every application."
    >
      <DocumentRulesWorkspace canWrite={view.canWrite} />
    </AdminShell>
  );
}

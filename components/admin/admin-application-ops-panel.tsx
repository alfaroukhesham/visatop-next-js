"use client";

import { AdminApplicationCustomerExport } from "@/components/admin/admin-application-customer-export";
import { AdminApplicationOpsControls } from "@/components/admin/admin-application-ops-controls";
import { useAdminApplicationOps } from "@/components/admin/use-admin-application-ops";

export type AdminDocRow = {
  id: string;
  documentType: string | null;
  status: string | null;
  createdAt: string;
  originalFilename: string | null;
  byteLength: number | null;
};

export function AdminApplicationOpsPanel({
  applicationId,
  paymentStatus,
  applicationStatus,
  documents,
}: {
  applicationId: string;
  paymentStatus: string;
  applicationStatus: string;
  documents: AdminDocRow[];
}) {
  const ops = useAdminApplicationOps({
    applicationId,
    paymentStatus,
    applicationStatus,
    documents,
  });

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <AdminApplicationCustomerExport applicationId={applicationId} />
      {ops.opsLocked ? (
        <p className="text-muted-foreground text-sm">{ops.opsLockedMessage}</p>
      ) : (
        <AdminApplicationOpsControls ops={ops} />
      )}
    </div>
  );
}

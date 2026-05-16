import { headers } from "next/headers";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { cleanupOrphanCatalogData } from "@/lib/admin/catalog/cleanup-orphan-catalog";
import { jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const result = await cleanupOrphanCatalogData(tx);

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.orphan_cleanup",
        entityType: "catalog",
        entityId: null,
        afterJson: JSON.stringify(result),
      });

      return jsonOk(result, { requestId });
    },
  );
}

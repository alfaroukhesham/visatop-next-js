import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["pricing.read", "pricing.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const deleted = await tx
        .delete(schema.affiliateReferencePrice)
        .where(eq(schema.affiliateReferencePrice.id, id))
        .returning();
      const row = deleted[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Reference price not found", { status: 404, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "pricing.reference_price.delete",
        entityType: "affiliate_reference_price",
        entityId: row.id,
        beforeJson: JSON.stringify({
          id: row.id,
          siteId: row.siteId,
          serviceId: row.serviceId,
          amount: row.amount,
          currency: row.currency,
        }),
      });
      return jsonOk({ deleted: { id: row.id } }, { requestId });
    },
  );
}

import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import { zIso4217Alpha3 } from "@/lib/validation/currency";

export const dynamic = "force-dynamic";

const referenceAmountSchema = z.union([
  z
    .string()
    .regex(/^\d+$/)
    .refine((s) => {
      try {
        return BigInt(s) <= BigInt(Number.MAX_SAFE_INTEGER);
      } catch {
        return false;
      }
    }, "amount too large")
    .transform((s) => Number(s)),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
]);

const postBody = z.object({
  siteId: z.string().min(1),
  serviceId: z.string().min(1),
  amount: referenceAmountSchema,
  currency: zIso4217Alpha3.optional(),
  sourceUrl: z.string().max(2048).optional().nullable(),
});

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId")?.trim();

  return runAdminDbJson(requestId, ["pricing.read"], async ({ tx }) => {
    const rows = serviceId
      ? await tx
          .select()
          .from(schema.affiliateReferencePrice)
          .where(eq(schema.affiliateReferencePrice.serviceId, serviceId))
          .orderBy(desc(schema.affiliateReferencePrice.observedAt))
      : await tx
          .select()
          .from(schema.affiliateReferencePrice)
          .orderBy(desc(schema.affiliateReferencePrice.observedAt));
    return jsonOk({ referencePrices: rows }, { requestId });
  });
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["pricing.read", "pricing.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, postBody, requestId);
      if (!parsed.ok) return parsed.response;

      const inserted = await tx
        .insert(schema.affiliateReferencePrice)
        .values({
          siteId: parsed.data.siteId,
          serviceId: parsed.data.serviceId,
          amount: parsed.data.amount,
          currency: parsed.data.currency ?? "USD",
          sourceUrl: parsed.data.sourceUrl ?? null,
          rawJson: "{}",
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        return jsonError("INTERNAL_ERROR", "Insert failed", { status: 500, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "pricing.reference_price.create",
        entityType: "affiliate_reference_price",
        entityId: row.id,
        afterJson: JSON.stringify({
          id: row.id,
          siteId: row.siteId,
          serviceId: row.serviceId,
          amount: row.amount,
          currency: row.currency,
        }),
      });
      return jsonOk({ referencePrice: row }, { status: 201, requestId });
    },
  );
}

import { headers } from "next/headers";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import { zIso4217Alpha3 } from "@/lib/validation/currency";

export const dynamic = "force-dynamic";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const postBody = z
  .object({
    scope: z.enum(["global", "service"]),
    serviceId: z.string().min(1).nullable().optional(),
    mode: z.enum(["percent", "fixed"]),
    value: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim()),
    currency: zIso4217Alpha3.optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === "service" && !val.serviceId) {
      ctx.addIssue({
        code: "custom",
        message: "serviceId is required when scope is service",
        path: ["serviceId"],
      });
    }
    if (val.scope === "global" && val.serviceId) {
      ctx.addIssue({
        code: "custom",
        message: "serviceId must be null when scope is global",
        path: ["serviceId"],
      });
    }
    if (!val.value.length || val.value.length > 64) {
      ctx.addIssue({
        code: "custom",
        message: "value must be 1–64 characters",
        path: ["value"],
      });
      return;
    }
    if (val.mode === "percent") {
      if (!/^\d+(\.\d+)?$/.test(val.value)) {
        ctx.addIssue({
          code: "custom",
          message: "percent value must be a non-negative decimal number",
          path: ["value"],
        });
        return;
      }
      const n = Number(val.value);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        ctx.addIssue({
          code: "custom",
          message: "percent value must be between 0 and 100",
          path: ["value"],
        });
      }
    } else {
      if (!/^\d+$/.test(val.value)) {
        ctx.addIssue({
          code: "custom",
          message: "fixed value must be a non-negative integer (minor units)",
          path: ["value"],
        });
        return;
      }
      try {
        if (BigInt(val.value) > MAX_SAFE) {
          ctx.addIssue({
            code: "custom",
            message: "fixed value exceeds maximum supported amount",
            path: ["value"],
          });
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "fixed value must be a valid integer",
          path: ["value"],
        });
      }
    }
  });

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["pricing.read"], async ({ tx }) => {
    const rows = await tx
      .select()
      .from(schema.marginPolicy)
      .orderBy(desc(schema.marginPolicy.updatedAt));
    return jsonOk({ marginPolicies: rows }, { requestId });
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
        .insert(schema.marginPolicy)
        .values({
          scope: parsed.data.scope,
          serviceId: parsed.data.scope === "service" ? parsed.data.serviceId! : null,
          mode: parsed.data.mode,
          value: parsed.data.value,
          currency: parsed.data.currency ?? "USD",
          enabled: parsed.data.enabled ?? true,
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        return jsonError("INTERNAL_ERROR", "Insert failed", { status: 500, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "pricing.margin_policy.create",
        entityType: "margin_policy",
        entityId: row.id,
        afterJson: JSON.stringify({
          id: row.id,
          scope: row.scope,
          serviceId: row.serviceId,
          mode: row.mode,
          currency: row.currency,
        }),
      });
      return jsonOk({ marginPolicy: row }, { status: 201, requestId });
    },
  );
}

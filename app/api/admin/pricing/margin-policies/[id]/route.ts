import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import { zIso4217Alpha3 } from "@/lib/validation/currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const patchBody = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(["percent", "fixed"]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    currency: zIso4217Alpha3.optional(),
  })
  .refine(
    (v) =>
      v.enabled !== undefined ||
      v.mode !== undefined ||
      v.value !== undefined ||
      v.currency !== undefined,
    { message: "At least one field is required" },
  );

function normalizeValue(
  mode: "percent" | "fixed",
  raw: string | number,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = String(raw).trim();
  if (!value.length || value.length > 64) {
    return { ok: false, message: "value must be 1–64 characters" };
  }
  if (mode === "percent") {
    if (!/^\d+(\.\d+)?$/.test(value)) {
      return { ok: false, message: "percent value must be a non-negative decimal number" };
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, message: "percent value must be between 0 and 100" };
    }
    return { ok: true, value };
  }
  if (!/^\d+$/.test(value)) {
    return { ok: false, message: "fixed value must be a non-negative integer (minor units)" };
  }
  try {
    if (BigInt(value) > MAX_SAFE) {
      return { ok: false, message: "fixed value exceeds maximum supported amount" };
    }
  } catch {
    return { ok: false, message: "fixed value must be a valid integer" };
  }
  return { ok: true, value };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["pricing.read", "pricing.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, patchBody, requestId);
      if (!parsed.ok) return parsed.response;

      const existing = await tx
        .select()
        .from(schema.marginPolicy)
        .where(eq(schema.marginPolicy.id, id))
        .limit(1);
      const before = existing[0];
      if (!before) {
        return jsonError("NOT_FOUND", "Margin policy not found", { status: 404, requestId });
      }

      const nextMode = (parsed.data.mode ?? before.mode) as "percent" | "fixed";
      let nextValue: string | undefined;
      if (parsed.data.value !== undefined) {
        const checked = normalizeValue(nextMode, parsed.data.value);
        if (!checked.ok) {
          return jsonError("VALIDATION_ERROR", checked.message, { status: 400, requestId });
        }
        nextValue = checked.value;
      }

      const updated = await tx
        .update(schema.marginPolicy)
        .set({
          ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
          ...(parsed.data.mode !== undefined ? { mode: parsed.data.mode } : {}),
          ...(nextValue !== undefined ? { value: nextValue } : {}),
          ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
        })
        .where(eq(schema.marginPolicy.id, id))
        .returning();
      const row = updated[0];
      if (!row) {
        return jsonError("INTERNAL_ERROR", "Update failed", { status: 500, requestId });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "pricing.margin_policy.update",
        entityType: "margin_policy",
        entityId: row.id,
        beforeJson: JSON.stringify({
          id: before.id,
          scope: before.scope,
          serviceId: before.serviceId,
          mode: before.mode,
          value: String(before.value),
          currency: before.currency,
          enabled: before.enabled,
        }),
        afterJson: JSON.stringify({
          id: row.id,
          scope: row.scope,
          serviceId: row.serviceId,
          mode: row.mode,
          value: String(row.value),
          currency: row.currency,
          enabled: row.enabled,
        }),
      });
      return jsonOk({ marginPolicy: row }, { requestId });
    },
  );
}

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
        .delete(schema.marginPolicy)
        .where(eq(schema.marginPolicy.id, id))
        .returning();
      const row = deleted[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Margin policy not found", { status: 404, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "pricing.margin_policy.delete",
        entityType: "margin_policy",
        entityId: row.id,
        beforeJson: JSON.stringify({
          id: row.id,
          scope: row.scope,
          serviceId: row.serviceId,
          mode: row.mode,
          value: String(row.value),
          currency: row.currency,
          enabled: row.enabled,
        }),
      });
      return jsonOk({ deleted: { id: row.id } }, { requestId });
    },
  );
}

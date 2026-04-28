import { headers } from "next/headers";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const parsed = await parseJsonBody(req, bodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return jsonError("VALIDATION_ERROR", "New password must be different.", { status: 400, requestId });
  }

  // Better Auth owns password verification + hashing. We call its API surface directly.
  try {
    const api: any = auth.api as any;
    if (typeof api.changePassword !== "function") {
      return jsonError(
        "SERVICE_UNAVAILABLE",
        "Password change is not configured on this server.",
        { status: 503, requestId },
      );
    }

    const result = await api.changePassword({
      headers: hdrs,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
    });

    if (result?.ok === false) {
      return jsonError("VALIDATION_ERROR", result.error?.message ?? "Unable to change password.", {
        status: 400,
        requestId,
      });
    }

    return jsonOk({ changed: true }, { requestId });
  } catch (e) {
    return jsonError("INTERNAL_ERROR", "Unable to change password.", {
      status: 500,
      requestId,
      details: { code: "CHANGE_PASSWORD_FAILED" },
    });
  }
}


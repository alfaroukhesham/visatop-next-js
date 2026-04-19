import { jsonError } from "@/lib/api/response";
import { trustedOriginsForRequest } from "@/lib/api/trusted-request-origins";
import type { NextResponse } from "next/server";

/**
 * Require `Origin` on JSON POSTs and match the deployment allowlist.
 * On failure returns **403** with `details.code` **`INVALID_ORIGIN`** (not link-specific codes).
 */
export function assertTrustedJsonPostOrigin(
  request: Request,
  requestId: string | null,
): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return jsonError("FORBIDDEN", "Invalid request origin", {
      status: 403,
      requestId,
      details: { code: "INVALID_ORIGIN" },
    });
  }
  const trusted = trustedOriginsForRequest(request);
  if (!trusted.has(origin)) {
    return jsonError("FORBIDDEN", "Invalid request origin", {
      status: 403,
      requestId,
      details: { code: "INVALID_ORIGIN" },
    });
  }
  return null;
}

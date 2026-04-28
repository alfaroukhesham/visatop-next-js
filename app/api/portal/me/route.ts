import { headers } from "next/headers";

import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  type SessionUserShape = { name?: string | null; email?: string | null };
  const user = session.user as unknown as SessionUserShape;

  return jsonOk(
    {
      user: {
        id: session.user.id,
        name: user.name ?? null,
        email: user.email ?? null,
      },
    },
    { requestId },
  );
}


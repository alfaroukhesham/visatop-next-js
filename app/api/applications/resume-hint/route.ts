import { headers } from "next/headers";
import { jsonOk } from "@/lib/api/response";
import { loadResumeHintFromCookieHeader } from "@/lib/applications/resume-hint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const cookieHeader = hdrs.get("cookie");
  const hint = await loadResumeHintFromCookieHeader(cookieHeader);
  return jsonOk({ hint }, { requestId });
}

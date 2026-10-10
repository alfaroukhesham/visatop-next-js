import { headers } from "next/headers";
import { jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return jsonOk({ status: "ok" }, { requestId });
};

import { headers } from "next/headers";
import { listPublicServicesForNationality } from "@/lib/catalog/queries";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";

export const dynamic = "force-dynamic";

const ALPHA2 = /^[A-Z]{2}$/;

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  const nationality = url.searchParams.get("nationality")?.trim().toUpperCase();
  if (!nationality || !ALPHA2.test(nationality)) {
    return jsonError("VALIDATION_ERROR", "Query `nationality` (ISO 3166-1 alpha-2) is required.", {
      status: 400,
      requestId,
    });
  }
  const services = await withSystemDbActor(async (tx) =>
    listPublicServicesForNationality(tx, nationality),
  );
  return jsonOk({ nationality, services }, { requestId });
}

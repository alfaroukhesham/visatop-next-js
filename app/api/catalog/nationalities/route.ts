import { headers } from "next/headers";
import { listPublicNationalities } from "@/lib/catalog/queries";
import { jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const rows = await withSystemDbActor(async (tx) =>
    listPublicNationalities(tx),
  );
  return jsonOk({ nationalities: rows }, { requestId });
}

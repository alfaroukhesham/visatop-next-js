import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { loadCheckoutExtraCatalog } from "@/lib/checkout-extras/party-checkout-quote";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { buildPreApplicationSpeedQuote } from "@/lib/pricing/pre-application-speed-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readCount = (value: string | null): number | null | "invalid" => {
  if (value === null || value.trim() === "") return null;
  if (!/^\d+$/.test(value.trim())) return "invalid";
  const count = Number.parseInt(value.trim(), 10);
  if (count < 1 || count > 50) return "invalid";
  return count;
};

/** Fast Track unit price before an application exists. */
export const GET = async (req: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId")?.trim() ?? "";
  const nationality = url.searchParams.get("nationality")?.trim() ?? "";
  const currency = url.searchParams.get("currency")?.trim() ?? "";
  const travellerCount = readCount(url.searchParams.get("travellerCount"));
  if (!serviceId || !/^[A-Za-z]{2}$/.test(nationality) || !/^[A-Za-z]{3}$/.test(currency)) {
    return jsonError("VALIDATION_ERROR", "Choose a visa, nationality, and currency.", {
      status: 400,
      requestId,
    });
  }
  if (travellerCount === "invalid") {
    return jsonError("VALIDATION_ERROR", "Traveller count must be a whole number from 1 to 50.", {
      status: 400,
      requestId,
    });
  }
  const catalog = await withSystemDbActor((tx) => loadCheckoutExtraCatalog(tx));
  return jsonOk(
    buildPreApplicationSpeedQuote({
      serviceId,
      nationalityCode: nationality,
      currency,
      travellerCount,
      catalog,
    }),
    { requestId },
  );
};

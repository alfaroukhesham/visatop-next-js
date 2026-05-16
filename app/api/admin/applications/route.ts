import { headers } from "next/headers";
import {
  getAttentionRequiredCount,
  listAdminApplications,
} from "@/lib/applications/admin-queries";
import { parseAdminApplicationsListParams } from "@/lib/applications/admin-applications-list-params";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function paramsFromUrl(url: URL) {
  const get = (key: string) => {
    const value = url.searchParams.get(key);
    return value && value.length > 0 ? value : undefined;
  };
  return parseAdminApplicationsListParams({
    attention: get("attention"),
    page: get("page"),
    pageSize: get("pageSize"),
    q: get("q"),
    status: get("status"),
    payment: get("payment"),
    fulfillment: get("fulfillment"),
  });
}

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const listParams = paramsFromUrl(new URL(req.url));

  return runAdminDbJson(requestId, ["applications.read"], async ({ tx }) => {
    const [{ items, total }, attentionCount] = await Promise.all([
      listAdminApplications(tx, {
        attention: listParams.attention,
        status: listParams.status,
        paymentStatus: listParams.paymentStatus,
        fulfillmentStatus: listParams.fulfillmentStatus,
        search: listParams.search,
        limit: listParams.pageSize,
        offset: listParams.offset,
      }),
      getAttentionRequiredCount(tx),
    ]);

    return jsonOk(
      {
        items: items.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          draftExpiresAt: row.draftExpiresAt?.toISOString() ?? null,
          dateOfBirth: row.dateOfBirth ?? null,
          passportExpiryDate: row.passportExpiryDate ?? null,
          passportExtractionUpdatedAt:
            row.passportExtractionUpdatedAt?.toISOString() ?? null,
          passportExtractionStartedAt:
            row.passportExtractionStartedAt?.toISOString() ?? null,
          passportExtractionLeaseExpiresAt:
            row.passportExtractionLeaseExpiresAt?.toISOString() ?? null,
        })),
        total,
        page: listParams.page,
        pageSize: listParams.pageSize,
        attentionCount,
      },
      { requestId },
    );
  });
}

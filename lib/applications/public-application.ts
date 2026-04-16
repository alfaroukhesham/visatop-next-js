import type { InferSelectModel } from "drizzle-orm";
import type { application } from "@/lib/db/schema";

type ApplicationRow = InferSelectModel<typeof application>;

export function toPublicApplication(row: ApplicationRow) {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    applicationStatus: row.applicationStatus,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    draftExpiresAt: row.draftExpiresAt?.toISOString() ?? null,
    nationalityCode: row.nationalityCode,
    serviceId: row.serviceId,
    isGuest: row.isGuest,
  };
}

import type { InferSelectModel } from "drizzle-orm";
import type { application } from "@/lib/db/schema";

type ApplicationRow = InferSelectModel<typeof application>;

/**
 * Shape returned from public application endpoints. Fields surfaced here are
 * safe to render in the apply UI: lifecycle, applicant profile, passport
 * extraction summary, and the checkout-freeze gate. Raw provenance JSON is
 * intentionally omitted — callers only need to know whether a field was
 * auto-filled (server handles that internally).
 */
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
    guestEmail: row.guestEmail,
    checkoutState: row.checkoutState,
    adminAttentionRequired: row.adminAttentionRequired,

    applicant: {
      fullName: row.fullName,
      dateOfBirth: row.dateOfBirth,
      placeOfBirth: row.placeOfBirth,
      nationality: row.applicantNationality,
      passportNumber: row.passportNumber,
      passportExpiryDate: row.passportExpiryDate,
      profession: row.profession,
      address: row.address,
      phone: row.phone,
    },

    passportExtraction: {
      status: row.passportExtractionStatus,
      updatedAt: row.passportExtractionUpdatedAt?.toISOString() ?? null,
      documentId: row.passportExtractionDocumentId,
      sha256: row.passportExtractionSha256,
    },
  };
}

export type PublicApplication = ReturnType<typeof toPublicApplication>;

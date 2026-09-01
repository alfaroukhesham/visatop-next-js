import type { InferSelectModel } from "drizzle-orm";
import type { application } from "@/lib/db/schema";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { minorUnitsToMajor } from "@/lib/pricing/format-minor-units";

type ApplicationRow = InferSelectModel<typeof application>;

export type TApplicationCharge = {
  amountMinor: bigint;
  currency: string;
};

/**
 * Shape returned from public application endpoints. Fields surfaced here are
 * safe to render in the apply UI: lifecycle, applicant profile, passport
 * extraction summary, and the checkout-freeze gate. Raw provenance JSON is
 * intentionally omitted — callers only need to know whether a field was
 * auto-filled (server handles that internally).
 */
export function toPublicApplication(row: ApplicationRow, charge?: TApplicationCharge | null) {
  const clientTracking = computeClientApplicationTracking({
    applicationStatus: row.applicationStatus,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    adminAttentionRequired: row.adminAttentionRequired,
  });

  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    applicationStatus: row.applicationStatus,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    clientTracking,
    draftExpiresAt: row.draftExpiresAt?.toISOString() ?? null,
    nationalityCode: row.nationalityCode,
    serviceId: row.serviceId,
    catalogCurrency: row.catalogCurrency,
    isGuest: row.isGuest,
    guestEmail: row.guestEmail,
    checkoutState: row.checkoutState,
    adminAttentionRequired: row.adminAttentionRequired,
    chargedAmountMajor: charge ? minorUnitsToMajor(charge.amountMinor) : null,
    chargedCurrency: charge?.currency?.trim().toUpperCase() || null,

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

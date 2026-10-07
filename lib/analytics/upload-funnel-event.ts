import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";

export const DOCUMENT_UPLOAD_FAILED = "document_upload_failed";
export const DOCUMENT_UPLOAD_CANCELLED = "document_upload_cancelled";

const isTrackedUploadDocType = (docType: string): boolean =>
  docType === "passport_copy" || docType === "personal_photo";

export const persistableUploadFunnelEventName = (
  docType: string,
  success: boolean,
): string | null => {
  if (!success) return null;
  if (docType === "passport_copy") return APPLY_FUNNEL_EVENTS.passportUploaded;
  if (docType === "personal_photo") return APPLY_FUNNEL_EVENTS.photoUploaded;
  return null;
};

export const uploadAnalyticsEventName = (input: {
  docType: string;
  outcome: "success" | "failed" | "cancelled";
}): string | null => {
  if (input.outcome === "success") {
    return persistableUploadFunnelEventName(input.docType, true);
  }
  if (!isTrackedUploadDocType(input.docType)) return null;
  return input.outcome === "cancelled" ? DOCUMENT_UPLOAD_CANCELLED : DOCUMENT_UPLOAD_FAILED;
};

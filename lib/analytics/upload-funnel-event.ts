import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";

export const persistableUploadFunnelEventName = (
  docType: string,
  success: boolean,
): string | null => {
  if (!success) return null;
  if (docType === "passport_copy") return APPLY_FUNNEL_EVENTS.passportUploaded;
  if (docType === "personal_photo") return APPLY_FUNNEL_EVENTS.photoUploaded;
  return null;
};

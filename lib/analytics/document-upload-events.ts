"use client";

import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { analyticsDeviceType } from "@/lib/analytics/device-type";
import { trackEvent } from "@/lib/analytics/gtag-client";
import type { TUploadFailureReason } from "@/lib/analytics/upload-failure";

export type TDocumentUploadSource = "camera" | "file";

export const trackDocumentUploadAnalytics = (input: {
  docType: string;
  applicationId: string;
  success: boolean;
  source?: TDocumentUploadSource;
  failureReason?: TUploadFailureReason;
}): void => {
  const eventName =
    input.docType === "passport_copy"
      ? APPLY_FUNNEL_EVENTS.passportUploaded
      : input.docType === "personal_photo"
        ? APPLY_FUNNEL_EVENTS.photoUploaded
        : null;
  if (!eventName) return;
  trackEvent(eventName, {
    application_id: input.applicationId,
    success: input.success,
    device_type: analyticsDeviceType(),
    upload_source: input.source,
    failure_reason: input.failureReason,
  });
};
